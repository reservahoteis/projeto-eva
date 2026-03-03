FROM python:3.12-slim

WORKDIR /app

# System dependencies for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Model storage directory
RUN mkdir -p /app/models

# Default: train on startup, then start consumer
CMD ["python", "main.py", "train"]
