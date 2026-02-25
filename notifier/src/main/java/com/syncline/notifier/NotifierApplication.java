package com.syncline.notifier;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Syncline Notification Service
 * Handles sending notifications for task events
 */
@SpringBootApplication
public class NotifierApplication {

    public static void main(String[] args) {
        System.out.println("\n╔════════════════════════════════════════════╗");
        System.out.println("║    Syncline Notification Service          ║");
        System.out.println("╚════════════════════════════════════════════╝\n");
        
        SpringApplication.run(NotifierApplication.class, args);
    }
}
