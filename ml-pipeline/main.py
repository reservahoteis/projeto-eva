"""
ML Pipeline Entrypoint

Commands:
    python main.py train      — Train escalation model from production data
    python main.py consume    — Start Redis Streams consumer (real-time events)
    python main.py report     — Generate KB gap report from historical data
    python main.py stats      — Show dataset statistics
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from config import LOG_LEVEL

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ml-pipeline")


def cmd_train(args: argparse.Namespace) -> None:
    """Train escalation prediction model."""
    from training.escalation_model import EscalationModel

    model = EscalationModel()
    metrics = model.train(tenant_id=args.tenant)

    if args.save:
        path = model.save(args.output)
        logger.info(f"Model saved to: {path}")

    print(json.dumps(metrics, indent=2))


def cmd_consume(args: argparse.Namespace) -> None:
    """Start Redis Streams real-time consumer."""
    import asyncio
    from consumer.redis_stream_consumer import StreamConsumer

    logger.info("Starting Redis Streams consumer...")
    consumer = StreamConsumer()
    asyncio.run(consumer.run())


def cmd_report(args: argparse.Namespace) -> None:
    """Generate dataset report."""
    from features.historical_features import build_conversation_dataset, get_dataset_stats

    df = build_conversation_dataset(tenant_id=args.tenant)
    stats = get_dataset_stats(df)

    print("\n" + "=" * 60)
    print("DATASET REPORT")
    print("=" * 60)
    print(f"Total conversations:  {stats['total_samples']}")
    print(f"Features:             {stats['features']}")
    print(f"Escalation rate:      {stats['escalation_rate']:.1%}")
    print(f"  Escalated:          {stats['escalated_count']}")
    print(f"  Not escalated:      {stats['not_escalated_count']}")
    print(f"Missing data:         {stats['missing_pct']:.1%}")
    print("=" * 60)

    if args.csv:
        df.to_csv(args.csv, index=False)
        print(f"\nDataset exported to: {args.csv}")


def cmd_stats(args: argparse.Namespace) -> None:
    """Show quick database statistics."""
    from sqlalchemy import create_engine, text
    from config import DATABASE_URL

    engine = create_engine(DATABASE_URL)

    queries = {
        "Messages": "SELECT COUNT(*) as count FROM messages",
        "Conversations": "SELECT COUNT(*) as count FROM conversations",
        "Contacts": "SELECT COUNT(*) as count FROM contacts",
        "Escalated (iaLocked)": 'SELECT COUNT(*) as count FROM conversations WHERE "iaLocked" = true',
        "AI Events": "SELECT COUNT(*) as count FROM ai_events",
    }

    print("\n" + "=" * 40)
    print("DATABASE STATISTICS")
    print("=" * 40)

    for label, query in queries.items():
        try:
            with engine.connect() as conn:
                result = conn.execute(text(query)).fetchone()
                print(f"  {label:25s} {result[0]:>8,}")
        except Exception as e:
            print(f"  {label:25s} ERROR: {e}")

    engine.dispose()
    print("=" * 40)


def main():
    parser = argparse.ArgumentParser(description="CRM Hoteis ML Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # train
    train_parser = subparsers.add_parser("train", help="Train escalation model")
    train_parser.add_argument("--tenant", help="Filter by tenant ID")
    train_parser.add_argument("--save", action="store_true", default=True, help="Save model after training")
    train_parser.add_argument("--output", help="Output directory for model")
    train_parser.set_defaults(func=cmd_train)

    # consume
    consume_parser = subparsers.add_parser("consume", help="Start real-time consumer")
    consume_parser.set_defaults(func=cmd_consume)

    # report
    report_parser = subparsers.add_parser("report", help="Generate dataset report")
    report_parser.add_argument("--tenant", help="Filter by tenant ID")
    report_parser.add_argument("--csv", help="Export dataset to CSV")
    report_parser.set_defaults(func=cmd_report)

    # stats
    stats_parser = subparsers.add_parser("stats", help="Show database statistics")
    stats_parser.set_defaults(func=cmd_stats)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
