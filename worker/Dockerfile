# worker/Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY .env .env

# Create __init__.py files
RUN touch src/__init__.py && \
    touch src/config/__init__.py && \
    touch src/tasks/__init__.py

# Health check (check if process is running)
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD pgrep -f "python src/scheduler.py" || exit 1

# Start the worker
CMD ["python", "src/scheduler.py"]
