package spike;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import spike.core.Engine;
import javax.sql.DataSource;

@SpringBootApplication
@EnableScheduling
public class SpikeApplication {
    public static void main(String[] args) { SpringApplication.run(SpikeApplication.class, args); }
    @Bean Engine engine(DataSource source, Faults faults) {
        Engine engine = new Engine(source);
        engine.initializeSchema();
        engine.setHook(faults::hit);
        return engine;
    }
}
