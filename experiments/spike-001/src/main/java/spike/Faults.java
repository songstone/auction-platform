package spike;

import org.springframework.stereotype.Component;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.*;

/** Explicit loopback experiment fault injection; never product code. */
@Component
public class Faults {
    private volatile Map<String,Object> config = Map.of();
    private volatile CountDownLatch release = new CountDownLatch(0);
    private final AtomicBoolean armed = new AtomicBoolean(false);
    private final AtomicInteger hits = new AtomicInteger();
    private volatile Map<String,Object> last = Map.of();
    public synchronized Map<String,Object> configure(Map<String,Object> value) {
        release.countDown(); config = new HashMap<>(value); release = new CountDownLatch(1);
        hits.set(0); last=Map.of(); armed.set(true); return status();
    }
    public void hit(String point, Map<String,Object> context) {
        Map<String,Object> c=config;
        if (!point.equals(c.get("point"))) return;
        Object key=c.getOrDefault("key",c.get("matchKey"));
        if(key!=null && !Objects.equals(String.valueOf(key),String.valueOf(context.get("key"))))return;
        if(c.containsKey("lane") && !String.valueOf(c.get("lane")).equals(String.valueOf(context.get("lane"))))return;
        if(!armed.compareAndSet(true,false))return;
        hits.incrementAndGet(); last=new HashMap<>(context);
        String action=String.valueOf(c.getOrDefault("action","pause"));
        if(action.equals("halt"))Runtime.getRuntime().halt(71);
        if(action.equals("throw"))throw new IllegalStateException("INJECTED_"+point);
        try {
            if(action.equals("delay"))Thread.sleep(((Number)c.getOrDefault("delayMs",100)).longValue());
            else if(!release.await(60, TimeUnit.SECONDS))throw new IllegalStateException("INJECTED_PAUSE_TIMEOUT");
        } catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
    }
    public Map<String,Object> status(){return Map.of("armed",armed.get(),"hits",hits.get(),"hit",hits.get()>0,"point",config.getOrDefault("point",""),"context",last);}
    public Map<String,Object> release(){release.countDown();armed.set(false);return status();}
}
