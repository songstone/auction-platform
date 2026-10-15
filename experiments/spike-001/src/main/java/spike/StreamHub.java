package spike;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import spike.core.Engine;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Durable events are read independently by each instance; local cursors are caches. */
@Component
public class StreamHub {
    record Message(String name,String id,Object data){}
    final Engine engine; final Faults faults;
    final ConcurrentMap<String,Client> clients=new ConcurrentHashMap<>();
    final ConcurrentMap<Integer,Long> cursors=new ConcurrentHashMap<>();
    final ConcurrentMap<String,Map<String,Object>> corruption=new ConcurrentHashMap<>();
    final ExecutorService writers=Executors.newVirtualThreadPerTaskExecutor();
    final AtomicLong sent=new AtomicLong(), dropped=new AtomicLong(), overflows=new AtomicLong(), total=new AtomicLong(), maxQueue=new AtomicLong(), errors=new AtomicLong();
    volatile boolean paused;
    volatile Map<String,Object> heartbeat=Map.of("versions",Map.of(),"serverMs",0);
    class Client {
        final String id; final SseEmitter emitter=new SseEmitter(0L);
        final BlockingQueue<Message> queue=new ArrayBlockingQueue<>(64);
        volatile boolean closed; Message reorder;
        Client(String id){this.id=id;}
        void close(){closed=true;clients.remove(id,this);emitter.complete();}
        void offer(Message m){if(!queue.offer(m)){overflows.incrementAndGet();close();}else maxQueue.accumulateAndGet(queue.size(),Math::max);}
    }
    public StreamHub(Engine engine,Faults faults){this.engine=engine;this.faults=faults;}
    public SseEmitter connect(String id){
        Client client=new Client(id);Client old=clients.put(id,client);if(old!=null)old.close();total.incrementAndGet();
        client.emitter.onCompletion(()->{client.closed=true;clients.remove(id,client);});
        client.emitter.onTimeout(client::close);
        client.emitter.onError(t->{client.closed=true;clients.remove(id,client);});
        client.offer(new Message("ready",null,Map.of("serverMs",engine.now())));
        writers.submit(()->write(client));return client.emitter;
    }
    void write(Client client){
        try {
            while(!client.closed){
                Message m=client.queue.poll(1,TimeUnit.SECONDS);
                if(m==null)m=new Message("heartbeat",null,heartbeat);
                Map<String,Object> c=corruption.get(client.id);
                if(c!=null && c.get("delayMs") instanceof Number n && n.longValue()>0)Thread.sleep(n.longValue());
                SseEmitter.SseEventBuilder event=SseEmitter.event().name(m.name()).data(m.data());
                if(m.id()!=null)event.id(m.id());
                Object laneValue=m.data() instanceof Map<?,?> data?data.get("lane"):null;
                Map<String,Object> context=Map.of("lane",laneValue==null?0:laneValue,"key",client.id);
                if(m.name().equals("state"))faults.hit("before_event_send",context);
                client.emitter.send(event);sent.incrementAndGet();
                if(m.name().equals("state"))faults.hit("after_event_send",context);
            }
        }catch(Exception e){errors.incrementAndGet();client.close();}
    }
    @Scheduled(fixedDelay=40)
    public synchronized void poll(){
        if(paused)return;
        try{
            for(int lane=1;lane<=4;lane++){
                long cursor=cursors.getOrDefault(lane,0L);
                List<Map<String,Object>> events=engine.events(lane,cursor,128);
                for(Map<String,Object> event:events){
                    long version=((Number)event.get("version")).longValue();
                    Map<String,Object> payload=new LinkedHashMap<>((Map<String,Object>)event.get("payload"));
                    if(event.get("committedMs")!=null)payload.put("committedMs",event.get("committedMs"));
                    payload.put("eventCreatedMs",event.get("createdMs"));
                    Map<String,Object> context=Map.of("lane",lane,"version",version,"key","");
                    faults.hit("before_event_enqueue",context);
                    Message m=new Message("state",lane+":"+version,payload);
                    for(Client client:clients.values())deliver(client,m);
                    faults.hit("after_event_enqueue",context);
                    engine.markPublished(((Number)event.get("id")).longValue());
                    cursors.put(lane,version);
                }
            }
        }catch(Exception e){errors.incrementAndGet();}
    }
    void deliver(Client client,Message m){
        Map<String,Object> config=corruption.get(client.id);
        if(config!=null){synchronized(config){
            int drop=((Number)config.getOrDefault("dropNext",0)).intValue();
            if(drop>0){config.put("dropNext",drop-1);dropped.incrementAndGet();return;}
            if(Boolean.TRUE.equals(config.get("reorderNext")) && client.reorder==null){client.reorder=m;config.put("reorderNext",false);return;}
            client.offer(m);
            int dup=((Number)config.getOrDefault("duplicateNext",0)).intValue();
            if(dup>0){config.put("duplicateNext",dup-1);client.offer(m);}
            if(client.reorder!=null){client.offer(client.reorder);client.reorder=null;}
            return;
        }}client.offer(m);
    }
    @Scheduled(fixedDelay=1000)
    public void beat(){
        if(paused)return;
        try{
            Map<String,Long> versions=new LinkedHashMap<>();
            for(Map<String,Object> s:engine.snapshots()){
                int lane=((Number)s.get("lane")).intValue();long v=((Number)s.get("version")).longValue();
                versions.put(String.valueOf(lane),v);
                if(cursors.getOrDefault(lane,0L)>v)cursors.put(lane,0L);
            }
            heartbeat=Map.of("versions",versions,"serverMs",engine.now());
            for(Client c:clients.values())c.offer(new Message("heartbeat",null,heartbeat));
        }catch(Exception e){errors.incrementAndGet();}
    }
    public synchronized void reset(){for(Client c:clients.values())c.close();cursors.clear();corruption.clear();sent.set(0);dropped.set(0);overflows.set(0);total.set(0);maxQueue.set(0);errors.set(0);}
    public Map<String,Object> metrics(){return Map.of("activeConnections",clients.size(),"totalConnections",total.get(),"sent",sent.get(),"dropped",dropped.get(),"overflows",overflows.get(),"maxQueue",maxQueue.get(),"streamErrors",errors.get(),"paused",paused);}
}
