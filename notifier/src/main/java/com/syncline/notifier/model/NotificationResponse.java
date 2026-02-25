package com.syncline.notifier.model;

import java.time.LocalDateTime;

/**
 * Standardized response for notification endpoints
 */
public class NotificationResponse {
    
    private boolean success;
    private String message;
    private String notificationType;
    private Integer taskId;
    private LocalDateTime timestamp;
    
    public NotificationResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }
    
    public NotificationResponse(boolean success, String message, String notificationType, Integer taskId) {
        this.success = success;
        this.message = message;
        this.notificationType = notificationType;
        this.taskId = taskId;
        this.timestamp = LocalDateTime.now();
    }
    
    // Getters and Setters
    public boolean isSuccess() {
        return success;
    }
    
    public void setSuccess(boolean success) {
        this.success = success;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public String getNotificationType() {
        return notificationType;
    }
    
    public void setNotificationType(String notificationType) {
        this.notificationType = notificationType;
    }
    
    public Integer getTaskId() {
        return taskId;
    }
    
    public void setTaskId(Integer taskId) {
        this.taskId = taskId;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
