package com.boiler;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BoilerMonitorApplication {
    public static void main(String[] args) {
        SpringApplication.run(BoilerMonitorApplication.class, args);
    }
}
