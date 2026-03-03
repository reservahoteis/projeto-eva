"""
ML Pipeline Configuration

Reads database and Redis connection settings from environment variables.
Falls back to Docker Compose service names for containerized deployment.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL (reads from the same DB as the Express backend)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://crm_user:CrmSecurePass2024!@postgres:5432/crm_whatsapp_saas",
)

# Redis (same instance as BullMQ / Event Bus)
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

REDIS_URL = os.getenv(
    "REDIS_URL",
    f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0"
    if REDIS_PASSWORD
    else f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
)

# Redis Streams config
STREAM_KEY = "ai_events:stream"
CONSUMER_GROUP = "ml_pipeline"
CONSUMER_NAME = os.getenv("ML_CONSUMER_NAME", "consumer-1")

# Model storage
MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
