package spike;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import spike.core.Engine;
import java.util.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.*;

@Component
public class ExperimentRuntime {
    final Engine engine;
    final AtomicBoolean manual = new AtomicBoolean(true);
    final AtomicReference<Long> clock = new AtomicReference<>();
    final AtomicLong workerErrors=new AtomicLong();
    final AtomicBoolean continuityLost=new AtomicBoolean(false);
    final AtomicBoolean recordingFailure=new AtomicBoolean(false);
    volatile int laneCount=4;
    volatile String lastError="";
    private final ScheduledExecutorService laneWorkers=Executors.newScheduledThreadPool(4);
    @Value("${spike.recover-on-start:false}") boolean recoverOnStart;
    public ExperimentRuntime(Engine engine){this.engine=engine;}
    @EventListener(ApplicationReadyEvent.class)
    public void startup(){
        if(recoverOnStart){
            List<Integer> lanes=engine.snapshots().stream().map(s->((Number)s.get("lane")).intValue()).toList();
            if(!lanes.isEmpty())engine.recover(lanes,"EXPERIMENT_PROCESS_RESTART",true,clock.get());
        }
        for(int lane=1;lane<=4;lane++){
            final int selected=lane;
            laneWorkers.scheduleWithFixedDelay(()->pumpLane(selected),0,10,TimeUnit.MILLISECONDS);
        }
    }
    public void pumpLane(int lane){
        if(manual.get() || continuityLost.get() || lane>laneCount)return;
        try { engine.drain(lane,clock.get(),32); engine.tick(lane,clock.get()); }
        catch(Exception e){workerErrors.incrementAndGet();lastError=e.getClass().getSimpleName()+": "+e.getMessage();continuityLost.set(true);manual.set(true);}
    }
    @Scheduled(fixedDelay=500)
    public void recordLostContinuity(){
        if(!continuityLost.get() || !recordingFailure.compareAndSet(false,true))return;
        try{
            List<Integer> lanes=new ArrayList<>();for(int lane=1;lane<=laneCount;lane++)lanes.add(lane);
            engine.recover(lanes,"WORKER_CONTINUITY_LOST",true,clock.get());
            continuityLost.set(false);
            // Persisted holds and manual=true survive automatic DB reconnection.
        }catch(Exception ignored){/* retry recording the hold when PostgreSQL is reachable */}
        finally{recordingFailure.set(false);}
    }
}
