package com.syncline.notifier.controller;

import com.syncline.notifier.model.Notification;
import com.syncline.notifier.model.NotificationResponse;
import com.syncline.notifier.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Notification Controller
 * REST API endpoints for the notification service
 */
@RestController
@RequestMapping("/")
@CrossOrigin(origins = "*")  // Allow CORS for development
public class NotificationController {
    
    @Autowired
    private NotificationService notificationService;
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("service", "Syncline Notifier");
        response.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(response);
    }
    
    /**
     * Root endpoint - API info
     */
    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> root() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", "Syncline Notification Service");
        response.put("version", "1.0.0");
        response.put("endpoints", Map.of(
            "health", "GET /health",
            "notify", "POST /notify",
            "test", "POST /test"
        ));
        return ResponseEntity.ok(response);
    }
    
    /**
     * Main notification endpoint
     * Receives notifications from the Python worker
     */
    @PostMapping("/notify")
    public ResponseEntity<NotificationResponse> notify(@Valid @RequestBody Notification notification) {
        try {
            // Validate notification
            if (!notificationService.isValidNotification(notification)) {
                return ResponseEntity
                        .badRequest()
                        .body(new NotificationResponse(
                                false, 
                                "Invalid notification data"
                        ));
            }
            
            // Send notification
            notificationService.sendNotification(notification);
            
            // Return success response
            NotificationResponse response = new NotificationResponse(
                    true,
                    "Notification sent successfully",
                    notification.getType(),
                    notification.getTaskId()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error sending notification: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new NotificationResponse(
                            false,
                            "Failed to send notification: " + e.getMessage()
                    ));
        }
    }
    
    /**
     * Test endpoint - send a test notification
     */
    @PostMapping("/test")
    public ResponseEntity<NotificationResponse> test() {
        try {
            // Create a test notification
            Notification testNotification = new Notification();
            testNotification.setType("test");
            testNotification.setTaskId(999);
            testNotification.setTitle("Test Notification");
            testNotification.setAssigneeId(1);
            testNotification.setMessage("This is a test notification from the Syncline Notifier");
            
            notificationService.sendNotification(testNotification);
            
            return ResponseEntity.ok(new NotificationResponse(
                    true,
                    "Test notification sent successfully",
                    "test",
                    999
            ));
            
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new NotificationResponse(
                            false,
                            "Failed to send test notification: " + e.getMessage()
                    ));
        }
    }
    
    /**
     * Get notification stats (for monitoring)
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("status", "running");
        stats.put("uptime", "N/A"); 
        stats.put("notifications_sent", "N/A");
        stats.put("last_notification", "N/A");
        return ResponseEntity.ok(stats);
    }
}
