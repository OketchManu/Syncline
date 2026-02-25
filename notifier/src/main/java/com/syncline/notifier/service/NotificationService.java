package com.syncline.notifier.service;

import com.syncline.notifier.model.Notification;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Notification Service
 * Handles the business logic for sending notifications
 * In a real system, this would integrate with email/SMS/Slack/etc.
 */
@Service
public class NotificationService {
    
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    
    /**
     * Process and send a notification
     * Currently logs to console - can be extended to send emails, SMS, webhooks, etc.
     */
    public void sendNotification(Notification notification) {
        String timestamp = LocalDateTime.now().format(formatter);
        
        System.out.println("\n📬 ═══════════════════════════════════════════");
        System.out.println("   NOTIFICATION SENT");
        System.out.println("═══════════════════════════════════════════");
        System.out.println("⏰ Time:     " + timestamp);
        System.out.println("📋 Type:     " + notification.getType());
        System.out.println("🆔 Task ID:  " + notification.getTaskId());
        System.out.println("📝 Title:    " + notification.getTitle());
        System.out.println("👤 Assignee: User #" + notification.getAssigneeId());
        
        // Type-specific information
        switch (notification.getType().toLowerCase()) {
            case "deadline_missed":
            case "overdue":
                if (notification.getOverdueHours() != null) {
                    System.out.println("⚠️  Overdue:  " + String.format("%.1f", notification.getOverdueHours()) + " hours");
                }
                break;
                
            case "task_stuck":
                if (notification.getStuckHours() != null) {
                    System.out.println("🔒 Stuck:    " + String.format("%.1f", notification.getStuckHours()) + " hours");
                }
                if (notification.getStatus() != null) {
                    System.out.println("📊 Status:   " + notification.getStatus());
                }
                break;
                
            default:
                System.out.println("ℹ️  Message:  " + notification.getMessage());
                break;
        }
        
        System.out.println("═══════════════════════════════════════════\n");
        
        // - sendEmail(notification)
        // - sendSlackMessage(notification)
        // - sendSMS(notification)
        // - callWebhook(notification)
    }
    
    /**
     * Validate notification data
     */
    public boolean isValidNotification(Notification notification) {
        return notification != null
                && notification.getType() != null && !notification.getType().isEmpty()
                && notification.getTaskId() != null
                && notification.getTitle() != null && !notification.getTitle().isEmpty()
                && notification.getAssigneeId() != null;
    }
    
    /**
     * Format notification for email (example)
     */
    public String formatEmailBody(Notification notification) {
        StringBuilder body = new StringBuilder();
        body.append("Hello,\n\n");
        body.append("You have a notification about task: ").append(notification.getTitle()).append("\n\n");
        
        switch (notification.getType().toLowerCase()) {
            case "deadline_missed":
            case "overdue":
                body.append("⚠️ This task is overdue!\n");
                if (notification.getOverdueHours() != null) {
                    body.append("Overdue by: ").append(String.format("%.1f", notification.getOverdueHours())).append(" hours\n");
                }
                break;
                
            case "task_stuck":
                body.append("🔒 This task appears to be stuck.\n");
                if (notification.getStuckHours() != null) {
                    body.append("No updates for: ").append(String.format("%.1f", notification.getStuckHours())).append(" hours\n");
                }
                break;
        }
        
        body.append("\nPlease take action as soon as possible.\n\n");
        body.append("Best regards,\nSyncline Team");
        
        return body.toString();
    }
}
