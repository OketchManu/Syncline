# Syncline Java Notifier

Enterprise-grade notification service for the Syncline task management system.

## What It Does

The Java notifier receives notification requests from the Python worker and:

- **Logs notifications** to console (current implementation)
- **Validates** incoming notification data
- **Provides REST API** for notification delivery
- **Ready to extend** with email, SMS, Slack, webhooks, etc.

## Prerequisites

- **Java 17 or higher** (JDK)
- **Maven 3.6+** (for building)

Check your versions:
```bash
java -version
mvn -version
```

## Project Structure

```
notifier/
├── src/
│   └── main/
│       ├── java/
│       │   └── com/
│       │       └── syncline/
│       │           └── notifier/
│       │               ├── NotifierApplication.java      # Main entry point
│       │               ├── controller/
│       │               │   └── NotificationController.java  # REST endpoints
│       │               ├── service/
│       │               │   └── NotificationService.java     # Business logic
│       │               └── model/
│       │                   ├── Notification.java            # Notification model
│       │                   └── NotificationResponse.java    # Response model
│       └── resources/
│           ├── application.properties  # Configuration
│           └── banner.txt              # Startup banner
├── pom.xml                             # Maven dependencies
└── README.md                           # This file
```

## Setup

### 1. Install Java

**Windows:**
- Download from https://adoptium.net/
- Install and verify: `java -version`

**Mac:**
```bash
brew install openjdk@17
```

**Linux:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

### 2. Install Maven

**Windows:**
- Download from https://maven.apache.org/download.cgi
- Extract and add to PATH

**Mac:**
```bash
brew install maven
```

**Linux:**
```bash
sudo apt install maven
```

## Running the Service

### Option 1: Using Maven (Development)

```bash
cd notifier
.\mvnw spring-boot:run
```

The service will start on **http://localhost:8080**

### Option 2: Build JAR and Run (Production)

```bash
# Build the JAR
mvn clean package

# Run the JAR
java -jar target/syncline-notifier-1.0.0.jar
```

### Option 3: Using IDE

Open the project in IntelliJ IDEA or Eclipse and run `NotifierApplication.java`

## Testing the Service

### 1. Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "service": "Syncline Notifier",
  "timestamp": "2026-01-27T..."
}
```

### 2. Send Test Notification

```bash
curl -X POST http://localhost:8080/test
```

### 3. Send Real Notification

```bash
curl -X POST http://localhost:8080/notify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "deadline_missed",
    "taskId": 123,
    "title": "Important Task",
    "assigneeId": 1,
    "overdueHours": 5.5
  }'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /        | Service info |
| GET    | /health  | Health check |
| POST   | /notify  | Send notification |
| POST   | /test    | Send test notification |
| GET    | /stats   | Service statistics |

## Configuration

Edit `src/main/resources/application.properties`:

```properties
# Change port (default: 8080)
server.port=8080

# Logging level
logging.level.com.syncline.notifier=DEBUG
```

## Extending with Real Notifications

To add email/SMS/Slack support, modify `NotificationService.java`:

```java
@Service
public class NotificationService {
    
    @Autowired
    private JavaMailSender emailSender;  // For email
    
    public void sendNotification(Notification notification) {
        // Log to console (current)
        logNotification(notification);
        
        // Send email
        sendEmail(notification);
        
        // Send to Slack
        sendSlack(notification);
        
        // Call webhook
        callWebhook(notification);
    }
    
    private void sendEmail(Notification notification) {
        // TODO: Implement email sending
    }
}
```

## Troubleshooting

### Java version error

Make sure you have Java 17+:
```bash
java -version
```

If you have multiple Java versions, set `JAVA_HOME`:
```bash
export JAVA_HOME=/path/to/java17
```

### Port already in use

Change the port in `application.properties`:
```properties
server.port=8081
```

### Maven not found

Install Maven or use the Maven wrapper (if provided):
```bash
./mvnw spring-boot:run  # Mac/Linux
mvnw.cmd spring-boot:run  # Windows
```

## Integration with Python Worker

The Python worker sends notifications to this service automatically when:
- Tasks become overdue
- Tasks get stuck (no updates for 48+ hours)

The Python worker is configured to call:
```
POST http://localhost:8080/notify
```

If this service is not running, the Python worker will log a message and continue (graceful degradation).

## Production Deployment

For production:

1. **Build the JAR:**
```bash
mvn clean package -DskipTests
```

2. **Run as a service:**
```bash
java -jar target/syncline-notifier-1.0.0.jar
```

3. **Or use Docker** (see main project README)

## Monitoring

Check service health:
```bash
curl http://localhost:8080/health
```

View stats:
```bash
curl http://localhost:8080/stats
```

## License

Part of the Syncline project.
