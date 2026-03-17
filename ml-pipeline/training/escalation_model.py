"""
Escalation Prediction Model

Predicts whether a conversation will require human escalation (iaLocked=true)
based on message patterns, temporal features, and contact history.

Model: Gradient Boosting Classifier (scikit-learn)
Target: was_escalated (binary classification)
Training data: 2300+ conversations from production (Nov 2025 - Mar 2026)

Usage:
    from training.escalation_model import EscalationModel

    model = EscalationModel()
    model.train()                    # Train from production data
    model.save("models/escalation")  # Save trained model
    model.predict(features_dict)     # Predict escalation probability
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

from config import MODEL_DIR
from features.historical_features import build_conversation_dataset, get_dataset_stats

logger = logging.getLogger(__name__)

# Features to exclude from training (identifiers, leaky features)
EXCLUDE_FEATURES = {
    "was_escalated",  # target variable
    "is_opportunity",  # could leak if set after escalation
}


class EscalationModel:
    """Binary classifier for conversation escalation prediction."""

    def __init__(self):
        self.model: Optional[GradientBoostingClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.feature_names: list[str] = []
        self.metrics: dict = {}
        self.trained_at: Optional[str] = None

    def train(self, tenant_id: Optional[str] = None) -> dict:
        """
        Train escalation model from production data.

        Returns dict with training metrics.
        """
        logger.info("=" * 60)
        logger.info("ESCALATION MODEL TRAINING")
        logger.info("=" * 60)

        # 1. Load data
        df = build_conversation_dataset(tenant_id=tenant_id)
        stats = get_dataset_stats(df)
        logger.info(f"Dataset stats: {json.dumps(stats, indent=2)}")

        if stats["total_samples"] < 50:
            raise ValueError(
                f"Insufficient data: {stats['total_samples']} samples. Need at least 50."
            )

        # 2. Prepare X, y
        target = "was_escalated"
        feature_cols = [
            c for c in df.columns
            if c not in EXCLUDE_FEATURES and df[c].dtype in ("int64", "float64", "bool")
        ]
        self.feature_names = feature_cols

        X = df[feature_cols].fillna(0).values
        y = df[target].values

        logger.info(f"Features ({len(feature_cols)}): {feature_cols}")
        logger.info(f"Target distribution: {np.bincount(y.astype(int))}")

        # 3. Train/test split (stratified to preserve class balance)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 4. Scale features
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # 5. Train model
        # GradientBoosting handles class imbalance well with subsample
        # Moderate hyperparameters to avoid overfitting on ~2k samples
        self.model = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            min_samples_split=10,
            min_samples_leaf=5,
            max_features="sqrt",
            random_state=42,
        )

        logger.info("Training GradientBoostingClassifier...")
        self.model.fit(X_train_scaled, y_train)

        # 6. Evaluate
        y_pred = self.model.predict(X_test_scaled)
        y_proba = self.model.predict_proba(X_test_scaled)[:, 1]

        self.metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, y_proba)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "escalation_rate_train": float(y_train.mean()),
            "escalation_rate_test": float(y_test.mean()),
        }

        # 7. Cross-validation for robustness check
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(
            self.model, X_train_scaled, y_train, cv=cv, scoring="roc_auc"
        )
        self.metrics["cv_roc_auc_mean"] = float(cv_scores.mean())
        self.metrics["cv_roc_auc_std"] = float(cv_scores.std())

        # 8. Feature importance
        importances = self.model.feature_importances_
        importance_pairs = sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1],
            reverse=True,
        )
        self.metrics["top_features"] = [
            {"feature": name, "importance": float(imp)}
            for name, imp in importance_pairs[:15]
        ]

        self.trained_at = datetime.utcnow().isoformat()

        # Log results
        logger.info("=" * 60)
        logger.info("TRAINING RESULTS")
        logger.info("=" * 60)
        logger.info(f"Accuracy:  {self.metrics['accuracy']:.3f}")
        logger.info(f"Precision: {self.metrics['precision']:.3f}")
        logger.info(f"Recall:    {self.metrics['recall']:.3f}")
        logger.info(f"F1 Score:  {self.metrics['f1']:.3f}")
        logger.info(f"ROC AUC:   {self.metrics['roc_auc']:.3f}")
        logger.info(f"CV AUC:    {self.metrics['cv_roc_auc_mean']:.3f} (+/- {self.metrics['cv_roc_auc_std']:.3f})")
        logger.info("")
        logger.info("Confusion Matrix:")
        cm = self.metrics["confusion_matrix"]
        logger.info(f"  TN={cm[0][0]}  FP={cm[0][1]}")
        logger.info(f"  FN={cm[1][0]}  TP={cm[1][1]}")
        logger.info("")
        logger.info("Top 10 Features:")
        for feat in self.metrics["top_features"][:10]:
            logger.info(f"  {feat['feature']:30s} {feat['importance']:.4f}")
        logger.info("")
        logger.info(classification_report(y_test, y_pred, target_names=["not_escalated", "escalated"]))

        return self.metrics

    def save(self, path: Optional[str] = None) -> str:
        """Save trained model, scaler, and metadata to disk."""
        import joblib

        if self.model is None:
            raise ValueError("Model not trained yet. Call train() first.")

        save_dir = Path(path or MODEL_DIR) / "escalation"
        save_dir.mkdir(parents=True, exist_ok=True)

        # Save model
        joblib.dump(self.model, save_dir / "model.joblib")
        joblib.dump(self.scaler, save_dir / "scaler.joblib")

        # Save metadata
        metadata = {
            "trained_at": self.trained_at,
            "feature_names": self.feature_names,
            "metrics": self.metrics,
            "model_type": "GradientBoostingClassifier",
            "scikit_learn_version": pd.__version__,
        }
        with open(save_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Model saved to {save_dir}")
        return str(save_dir)

    def load(self, path: Optional[str] = None) -> None:
        """Load a previously saved model."""
        import joblib

        load_dir = Path(path or MODEL_DIR) / "escalation"

        self.model = joblib.load(load_dir / "model.joblib")
        self.scaler = joblib.load(load_dir / "scaler.joblib")

        with open(load_dir / "metadata.json") as f:
            metadata = json.load(f)

        self.feature_names = metadata["feature_names"]
        self.metrics = metadata["metrics"]
        self.trained_at = metadata["trained_at"]

        logger.info(f"Model loaded from {load_dir} (trained at {self.trained_at})")

    def predict(self, features: dict) -> dict:
        """
        Predict escalation probability for a single conversation.

        Args:
            features: dict with feature names as keys

        Returns:
            {"probability": float, "will_escalate": bool, "confidence": str}
        """
        if self.model is None:
            raise ValueError("Model not loaded. Call load() or train() first.")

        # Build feature vector in correct order
        X = np.array([[features.get(f, 0) for f in self.feature_names]])
        X_scaled = self.scaler.transform(X)

        proba = self.model.predict_proba(X_scaled)[0][1]
        prediction = proba >= 0.5

        confidence = "low"
        if proba > 0.8 or proba < 0.2:
            confidence = "high"
        elif proba > 0.65 or proba < 0.35:
            confidence = "medium"

        return {
            "probability": float(proba),
            "will_escalate": bool(prediction),
            "confidence": confidence,
        }
