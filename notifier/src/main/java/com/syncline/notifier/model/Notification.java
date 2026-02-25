package com.syncline.notifier.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Notification model
 * Represents a notification request from the Python worker
 */
public class Notification {
    
    @NotBlank(message = "Notification type is required")
    private String type;
    
    @NotNull(message = "Task ID is required")
    private Integer taskId;
    
    @NotBlank(message = "Task title is required")
    private String title;
    
    @NotNull(message = "Assignee ID is required")
    private Integer assigneeId;
    
    private String message;
    private Double overdueHours;
    private Double stuckHours;
    private String status;
    
    // Constructors
    public Notification() {}
    
    public Notification(String type, Integer taskId, String title, Integer assigneeId) {
        this.type = type;
        this.taskId = taskId;
        this.title = title;
        this.assigneeId = assigneeId;
    }
    
    // Getters and Setters
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public Integer getTaskId() {
        return taskId;
    }
    
    public void setTaskId(Integer taskId) {
        this.taskId = taskId;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public Integer getAssigneeId() {
        return assigneeId;
    }
    
    public void setAssigneeId(Integer assigneeId) {
        this.assigneeId = assigneeId;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public Double getOverdueHours() {
        return overdueHours;
    }
    
    public void setOverdueHours(Double overdueHours) {
        this.overdueHours = overdueHours;
    }
    
    public Double getStuckHours() {
        return stuckHours;
    }
    
    public void setStuckHours(Double stuckHours) {
        this.stuckHours = stuckHours;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    @Override
    public String toString() {
        return "Notification{" +
                "type='" + type + '\'' +
                ", taskId=" + taskId +
                ", title='" + title + '\'' +
                ", assigneeId=" + assigneeId +
                ", overdueHours=" + overdueHours +
                ", stuckHours=" + stuckHours +
                ", status='" + status + '\'' +
                '}';
    }
}
