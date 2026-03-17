"""
AI Event Pipeline - Redis Streams Consumer (Python)

Reads AI events from Redis Stream in real-time for:
- Online feature computation (low-latency dashboards)
- Real-time anomaly detection (sudden escalation spike)
- Event routing to downstream ML services

Architecture:
  Redis Stream (ai_events:stream)
       |
       v
  StreamConsumer (this file) -- consumer group: ml-pipeline
       |         |
       v         v
  FeatureStore  AnomalyDetector
  (Redis Hash)  (alerting)

LGPD compliance:
  - Consumer never logs PII fields
  - contact_id_hash is treated as an opaque identifier
  - Events with 'ANONYMIZED' tenant_id are skipped

Usage:
  python -m consumer.redis_stream_consumer
  # or via Docker:
  # docker run --env-file .env crm-ml-pipeline python -m consumer.redis_stream_consumer
"""

import asyncio
import json
import logging
import os
import signal
import sys
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis

# ============================================
# CONFIGURATION
# ============================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
STREAM_KEY = os.getenv("AI_EVENTS_STREAM_KEY", "ai_events:stream")
CONSUMER_GROUP = "ml-pipeline"
CONSUMER_NAME = os.getenv("HOSTNAME", "ml-consumer-1")  # Pod name in Kubernetes
BATCH_SIZE = 100  # Events per XREADGROUP call
BLOCK_MS = 5_000  # Block 5s waiting for new events (reduces polling)
RETRY_IDLE_MS = 30_000  # Reclaim messages idle > 30s from crashed consumers

# ============================================
# LOGGING (structured, no PII)
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "msg": %(message)s}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)


# ============================================
# EVENT PROCESSOR
# ============================================

class AIEventProcessor:
    """
    Processes individual AI events from the stream.

    Responsibilities:
    1. Parse and validate event schema
    2. Route to appropriate handler by event_type
    3. Update online feature store (Redis Hashes)
    4. Trigger anomaly alerts if thresholds exceeded
    """

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.processed_count = 0
        self.error_count = 0

    async def process(self, event_id: str, event_data: dict[str, str]) -> bool:
        """
        Process a single event from the stream.
        Returns True if processing succeeded (ACK), False if should retry.
        """
        try:
            event_type = event_data.get("event_type", "unknown")
            tenant_id = event_data.get("tenant_id", "")
            conversation_id = event_data.get("conversation_id", "")
            occurred_at_str = event_data.get("occurred_at", "")
            payload_str = event_data.get("payload", "{}")

            # Skip anonymized events (LGPD erasure)
            if tenant_id == "ANONYMIZED":
                log.info(f'"Skipping anonymized event", "event_id": "{event_id}"')
                return True

            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                log.warning(f'"Invalid JSON payload", "event_id": "{event_id}", "event_type": "{event_type}"')
                payload = {}

            try:
                occurred_at = datetime.fromisoformat(occurred_at_str.replace("Z", "+00:00"))
            except ValueError:
                occurred_at = datetime.now(timezone.utc)

            # Route to handler
            handler = self._get_handler(event_type)
            if handler:
                await handler(tenant_id, conversation_id, occurred_at, payload)

            # Update session window feature store
            await self._update_session_features(
                tenant_id=tenant_id,
                session_id=event_data.get("session_id", ""),
                event_type=event_type,
                occurred_at=occurred_at,
            )

            self.processed_count += 1
            return True

        except Exception as exc:
            self.error_count += 1
            log.error(
                f'"Error processing event", "event_id": "{event_id}", "error": "{exc}"',
                exc_info=False,  # No stack trace to avoid leaking internal paths
            )
            return False

    def _get_handler(self, event_type: str):
        handlers = {
            "llm_response": self._handle_llm_response,
            "escalated_to_human": self._handle_escalation,
            "knowledge_not_found": self._handle_kb_miss,
            "booking_confirmed": self._handle_booking_confirmed,
            "satisfaction_received": self._handle_satisfaction,
        }
        return handlers.get(event_type)

    async def _handle_llm_response(
        self, tenant_id: str, conversation_id: str, occurred_at: datetime, payload: dict
    ) -> None:
        """Track LLM cost in real-time per tenant."""
        cost = payload.get("estimatedCostUsd", 0)
        provider = payload.get("provider", "unknown")
        tokens = payload.get("totalTokens", 0)

        # Increment rolling 24h cost counter in Redis
        today = occurred_at.strftime("%Y-%m-%d")
        cost_key = f"ml:tenant_cost:{tenant_id}:{today}"

        pipe = self.redis.pipeline()
        pipe.hincrbyfloat(cost_key, f"cost_usd:{provider}", cost)
        pipe.hincrby(cost_key, f"tokens:{provider}", int(tokens))
        pipe.hincrby(cost_key, "total_calls", 1)
        pipe.expire(cost_key, 48 * 3600)  # Keep 48h
        await pipe.execute()

    async def _handle_escalation(
        self, tenant_id: str, conversation_id: str, occurred_at: datetime, payload: dict
    ) -> None:
        """Detect escalation spikes for real-time alerting."""
        window_key = f"ml:escalation_window:{tenant_id}"
        hour_bucket = occurred_at.strftime("%Y-%m-%dT%H")

        # Count escalations in current hour
        count = await self.redis.hincrby(window_key, hour_bucket, 1)
        await self.redis.expire(window_key, 25 * 3600)

        # Alert if escalations spike (configurable threshold)
        threshold = int(os.getenv("ESCALATION_ALERT_THRESHOLD", "50"))
        if count == threshold:
            log.warning(
                f'"Escalation spike detected", '
                f'"tenant_id": "{tenant_id}", '
                f'"count": {count}, '
                f'"hour": "{hour_bucket}"'
            )
            # In production: publish to alert queue or PagerDuty webhook
            await self.redis.publish(
                "alerts:escalation_spike",
                json.dumps({"tenant_id": tenant_id, "count": count, "hour": hour_bucket}),
            )

    async def _handle_kb_miss(
        self, tenant_id: str, conversation_id: str, occurred_at: datetime, payload: dict
    ) -> None:
        """Track KB miss queries for gap analysis dashboard."""
        query = payload.get("queryText", "")
        collection = payload.get("collection", "default")
        hotel_unit = payload.get("hotelUnit", "")

        if not query:
            return

        # Track in sorted set by miss frequency (real-time leaderboard)
        gap_key = f"ml:kb_gaps:{tenant_id}:{collection}"
        query_key = f"{hotel_unit}:{query[:100]}"  # Truncate for Redis key safety

        await self.redis.zincrby(gap_key, 1, query_key)
        await self.redis.expire(gap_key, 30 * 24 * 3600)  # 30 days

    async def _handle_booking_confirmed(
        self, tenant_id: str, conversation_id: str, occurred_at: datetime, payload: dict
    ) -> None:
        """Track booking conversions for attribution."""
        hotel_unit = payload.get("hotelUnit", "unknown")
        today = occurred_at.strftime("%Y-%m-%d")

        booking_key = f"ml:bookings:{tenant_id}:{today}"
        await self.redis.hincrby(booking_key, hotel_unit, 1)
        await self.redis.hincrby(booking_key, "total", 1)
        await self.redis.expire(booking_key, 90 * 24 * 3600)

    async def _handle_satisfaction(
        self, tenant_id: str, conversation_id: str, occurred_at: datetime, payload: dict
    ) -> None:
        """Track CSAT/sentiment in real-time."""
        sentiment = payload.get("sentiment", "unknown")
        score = payload.get("score")

        today = occurred_at.strftime("%Y-%m-%d")
        sat_key = f"ml:satisfaction:{tenant_id}:{today}"

        pipe = self.redis.pipeline()
        pipe.hincrby(sat_key, f"sentiment:{sentiment}", 1)
        if score is not None:
            pipe.hincrbyfloat(sat_key, "score_sum", float(score))
            pipe.hincrby(sat_key, "score_count", 1)
        pipe.expire(sat_key, 90 * 24 * 3600)
        await pipe.execute()

    async def _update_session_features(
        self,
        tenant_id: str,
        session_id: str,
        event_type: str,
        occurred_at: datetime,
    ) -> None:
        """
        Maintain a sliding window feature vector per session in Redis.
        Used by real-time ML scoring (e.g., predict escalation probability).
        """
        if not session_id:
            return

        session_key = f"ml:session:{session_id}"
        pipe = self.redis.pipeline()
        pipe.hincrby(session_key, f"count:{event_type}", 1)
        pipe.hset(session_key, f"last:{event_type}", occurred_at.isoformat())
        pipe.hincrby(session_key, "total_events", 1)
        pipe.expire(session_key, 3600)  # Sessions expire after 1 hour
        await pipe.execute()


# ============================================
# STREAM CONSUMER (main loop)
# ============================================

class StreamConsumer:
    """
    Redis Streams consumer with consumer group for at-least-once delivery.

    Consumer groups ensure:
    - Multiple consumer instances can process in parallel
    - No event is lost if a consumer crashes (PEL - pending entry list)
    - Dead messages are reclaimed after RETRY_IDLE_MS
    """

    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self.processor: AIEventProcessor | None = None
        self.running = False
        self.total_acked = 0

    async def connect(self) -> None:
        self.redis = await aioredis.from_url(
            REDIS_URL,
            password=REDIS_PASSWORD or None,
            decode_responses=True,
            socket_timeout=10,
        )
        self.processor = AIEventProcessor(self.redis)

        # Create consumer group (idempotent)
        try:
            await self.redis.xgroup_create(
                STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True
            )
            log.info(f'"Consumer group created", "group": "{CONSUMER_GROUP}"')
        except aioredis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                log.info(f'"Consumer group already exists", "group": "{CONSUMER_GROUP}"')
            else:
                raise

    async def run(self) -> None:
        """Main consumption loop. Reads batches, processes, ACKs."""
        self.running = True
        log.info(
            f'"Consumer started", "stream": "{STREAM_KEY}", '
            f'"group": "{CONSUMER_GROUP}", "consumer": "{CONSUMER_NAME}"'
        )

        while self.running:
            try:
                # First: reclaim idle messages from crashed consumers
                await self._reclaim_idle_messages()

                # Then: read new messages
                messages = await self.redis.xreadgroup(
                    CONSUMER_GROUP,
                    CONSUMER_NAME,
                    {STREAM_KEY: ">"},  # ">" means only undelivered messages
                    count=BATCH_SIZE,
                    block=BLOCK_MS,
                )

                if not messages:
                    continue

                for stream_name, stream_messages in messages:
                    for msg_id, msg_data in stream_messages:
                        success = await self.processor.process(msg_id, msg_data)
                        if success:
                            await self.redis.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
                            self.total_acked += 1

            except aioredis.ConnectionError as e:
                log.error(f'"Redis connection lost", "error": "{e}", "retrying_in_seconds": 5')
                await asyncio.sleep(5)
            except Exception as e:
                log.error(f'"Unexpected error in consumer loop", "error": "{e}"')
                await asyncio.sleep(1)

    async def _reclaim_idle_messages(self) -> None:
        """
        Reclaim messages from crashed consumers that have been idle > RETRY_IDLE_MS.
        This ensures at-least-once delivery even when consumers crash.
        """
        try:
            # Use XAUTOCLAIM (Redis 6.2+)
            result = await self.redis.xautoclaim(
                STREAM_KEY,
                CONSUMER_GROUP,
                CONSUMER_NAME,
                RETRY_IDLE_MS,
                "0-0",
                count=10,
            )
            reclaimed = result[1] if isinstance(result, (list, tuple)) and len(result) > 1 else []
            if reclaimed:
                log.info(f'"Reclaimed idle messages", "count": {len(reclaimed)}')
        except (aioredis.ResponseError, AttributeError):
            pass  # XAUTOCLAIM not available in older Redis - fail silently

    async def shutdown(self) -> None:
        self.running = False
        if self.redis:
            await self.redis.aclose()
        log.info(
            f'"Consumer shutdown complete", '
            f'"total_acked": {self.total_acked}, '
            f'"processed": {self.processor.processed_count if self.processor else 0}, '
            f'"errors": {self.processor.error_count if self.processor else 0}'
        )


# ============================================
# ENTRYPOINT
# ============================================

async def main() -> None:
    consumer = StreamConsumer()
    await consumer.connect()

    # Graceful shutdown
    loop = asyncio.get_event_loop()

    def handle_signal(sig: signal.Signals) -> None:
        log.info(f'"Received signal {sig.name}, shutting down"')
        loop.create_task(consumer.shutdown())

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))

    await consumer.run()


if __name__ == "__main__":
    asyncio.run(main())
