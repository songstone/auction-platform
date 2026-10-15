package spike;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.ResponseEntity;
import spike.core.Engine;
import java.util.*;
import java.lang.management.ManagementFactory;

@RestController
public class ExperimentController {
    final Engine engine;final ExperimentRuntime runtime;final Faults faults;final StreamHub hub;
    public ExperimentController(Engine e,ExperimentRuntime r,Faults f,StreamHub h){engine=e;runtime=r;faults=f;hub=h;}
    static long number(Map<String,Object> m,String key,long def){return m.get(key) instanceof Number n?n.longValue():def;}
    static String string(Map<String,Object> m,String key,String def){return m.get(key)==null?def:String.valueOf(m.get(key));}
    Long time(Map<String,Object> m){Object t=m.getOrDefault("nowMs",m.get("time"));return t instanceof Number n?n.longValue():runtime.clock.get();}
    @GetMapping("/health") Object health(){return Map.of("ready",true,"pid",ProcessHandle.current().pid(),"manual",runtime.manual.get());}
    @GetMapping("/clock") Object clock(){return Map.of("serverMs",engine.now());}
    @PostMapping("/admin/reset") Object reset(@RequestBody Map<String,Object> m){
        runtime.manual.set(true);faults.release();hub.reset();runtime.continuityLost.set(false);runtime.laneCount=(int)number(m,"lanes",4);
        Long start=m.get("startMs") instanceof Number n?n.longValue():null;runtime.clock.set(start);
        Engine.Fixture f=new Engine.Fixture((int)number(m,"lanes",4),(int)number(m,"itemsPerLane",20),start==null?engine.now():start,number(m,"prepMs",0),number(m,"initialMs",10000),number(m,"followMs",5000),number(m,"startPrice",10000),number(m,"increment",1000),number(m,"reserve",10000));
        Object result=engine.reset(f);runtime.workerErrors.set(0);runtime.lastError="";runtime.manual.set(!Boolean.FALSE.equals(m.get("manual")));return result;
    }
    @PostMapping("/admin/mode") Object mode(@RequestBody Map<String,Object> m){runtime.manual.set(!Boolean.FALSE.equals(m.get("manual")));if(Boolean.TRUE.equals(m.get("realClock")))runtime.clock.set(null);return health();}
    @PostMapping("/admin/clock") Object setClock(@RequestBody Map<String,Object> m){runtime.clock.set(m.get("nowMs") instanceof Number n?n.longValue():null);return Map.of("clock",runtime.clock.get()==null?"DB_REAL_TIME":runtime.clock.get());}
    @PostMapping("/intents") Object intent(@RequestBody Map<String,Object> m){return engine.registerIntent(string(m,"actor",""),string(m,"key",""),string(m,"auction",""),number(m,"amount",0));}
    @GetMapping("/intents/current") Object currentIntent(@RequestParam String actor,@RequestParam String auction){return engine.currentIntent(actor,auction);}
    @PostMapping("/ack") Object acknowledge(@RequestBody Map<String,Object> m){return engine.acknowledge(string(m,"actor",""),string(m,"key",""));}
    @PostMapping({"/bids","/commands"}) Object command(@RequestBody Map<String,Object> m){
        Engine.Command c=new Engine.Command(string(m,"actor",""),string(m,"key",""),string(m,"kind","BID"),(int)number(m,"lane",1),string(m,"auction",null),m.get("amount") instanceof Number n?n.longValue():null,string(m,"reason",null),string(m,"stopId",null));
        return engine.submit(c,time(m));
    }
    @GetMapping("/requests") Object request(@RequestParam String actor,@RequestParam String key){return engine.request(actor,key);}
    @GetMapping("/snapshot") Object snapshot(){return Map.of("lanes",engine.snapshots(),"serverMs",engine.now());}
    @PostMapping({"/admin/process","/admin/drain"}) Object process(@RequestBody Map<String,Object> m){return engine.drain((int)number(m,"lane",1),time(m),(int)number(m,"max",100));}
    @PostMapping("/admin/tick") Object tick(@RequestBody Map<String,Object> m){return engine.tick((int)number(m,"lane",1),time(m));}
    @GetMapping("/admin/audit") Object audit(@RequestParam(defaultValue="1") int lane){return engine.audit(lane);}
    @GetMapping("/admin/requests") Object requests(@RequestParam(defaultValue="1") int lane){return engine.requests(lane);}
    @GetMapping("/admin/events") Object events(@RequestParam(defaultValue="1") int lane,@RequestParam(defaultValue="0") long afterVersion){return engine.events(lane,afterVersion,10000);}
    @PostMapping({"/admin/fault","/admin/hooks"}) Object fault(@RequestBody Map<String,Object> m){return faults.configure(m);}
    @PostMapping({"/admin/fault/release","/admin/hooks/release"}) Object release(){return faults.release();}
    @GetMapping({"/admin/fault/status","/admin/hooks"}) Object faultStatus(){return faults.status();}
    @PostMapping("/admin/recover") Object recover(@RequestBody Map<String,Object> m){List<Integer> lanes=((List<?>)m.getOrDefault("lanes",List.of(1,2,3,4))).stream().map(v->((Number)v).intValue()).toList();return engine.recover(lanes,string(m,"reason","INJECTED_FAILURE"),!Boolean.FALSE.equals(m.get("historyComplete")),time(m));}
    @PostMapping({"/admin/confirm","/admin/confirm-recovery"}) Object confirm(@RequestBody Map<String,Object> m){return engine.confirmRecovery((int)number(m,"lane",1));}
    @PostMapping("/admin/dispatcher") Object dispatcher(@RequestBody Map<String,Object> m){hub.paused=Boolean.TRUE.equals(m.get("paused"));return hub.metrics();}
    @PostMapping("/admin/stream-fault") Object streamFault(@RequestBody Map<String,Object> m){String client=string(m,"client","");hub.corruption.put(client,new HashMap<>(m));return Map.of("client",client,"configured",true);}
    @GetMapping(path="/events",produces="text/event-stream") SseEmitter events(@RequestParam(defaultValue="") String client){return hub.connect(client.isBlank()?UUID.randomUUID().toString():client);}
    @GetMapping("/metrics") Object metrics(){Map<String,Object> m=new LinkedHashMap<>(hub.metrics());m.put("workerErrors",runtime.workerErrors.get());m.put("lastWorkerError",runtime.lastError);m.put("heapUsed",ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed());m.put("processCpuNs",((com.sun.management.OperatingSystemMXBean)ManagementFactory.getOperatingSystemMXBean()).getProcessCpuTime());m.put("liveThreads",ManagementFactory.getThreadMXBean().getThreadCount());m.put("serverMs",engine.now());return m;}
    @ExceptionHandler(Exception.class) ResponseEntity<?> error(Exception e){return ResponseEntity.status(e instanceof IllegalArgumentException?400:409).body(Map.of("error",e.getClass().getSimpleName(),"message",Objects.toString(e.getMessage(),"error")));}
}
