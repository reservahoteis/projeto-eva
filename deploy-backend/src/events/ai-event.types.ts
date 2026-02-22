/**
 * AI Event Pipeline - Type Definitions
 *
 * All AI interactions are captured as typed events for future ML consumption.
 * Every event is multi-tenant aware and PII-safe by design.
 *
 * Design principles:
 * - Discriminated union for compile-time exhaustiveness checks
 * - ML-friendly flat structure (no deeply nested objects)
 * - Anonymization hooks built into the type system
 * - LGPD-compliant: PII fields are optional and hashed separately
 */

// ============================================
// BASE EVENT
// ============================================

/**
 * All AI events share this base structure.
 * Designed for PostgreSQL JSONB storage and Python Pandas consumption.
 */
export interface BaseAIEvent {
  /** UUID v4 - primary key in ai_events table */
  eventId: string;

  /** Tenant isolation - MANDATORY on every event */
  tenantId: string;

  /** Hashed tenant slug for cross-tenant ML comparison without exposing names */
  tenantSlugHash: string;

  /** Conversation this event belongs to */
  conversationId: string;

  /** Message that triggered this event (nullable for derived events) */
  messageId: string | null;

  /** ISO-8601 with milliseconds precision */
  occurredAt: string;

  /** Processing session - groups events in a single N8N/AI call chain */
  sessionId: string;

  /** Channel: whatsapp | messenger | instagram */
  channel: 'whatsapp' | 'messenger' | 'instagram';

  /**
   * Hashed contact identifier for ML training (SHA-256 of externalId + salt).
   * Never store raw phone numbers or PSIDs in events.
   */
  contactIdHash: string;

  /** Schema version for forward compatibility */
  schemaVersion: number;
}

// ============================================
// EVENT TYPES (Discriminated Union)
// ============================================

/** Client sent a message to the bot */
export interface MessageReceivedEvent extends BaseAIEvent {
  eventType: 'message_received';
  payload: {
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'button_reply' | 'list_reply';
    /** Character count only - never the raw content (PII) */
    contentLengthChars: number;
    /** Word count estimate for NLP feature engineering */
    wordCount: number;
    /** Whether this is a new conversation (first message) */
    isNewConversation: boolean;
    /** Hour of day (0-23) in UTC for time-pattern analysis */
    hourOfDay: number;
    /** Day of week (0=Sunday, 6=Saturday) */
    dayOfWeek: number;
    /** True if the message is a structured reply (button/list) vs free text */
    isStructuredReply: boolean;
  };
}

/** AI classified the intent of the message */
export interface IntentClassifiedEvent extends BaseAIEvent {
  eventType: 'intent_classified';
  payload: {
    /** The classified intent (e.g., "check_availability", "make_reservation") */
    intent: string;
    /** Confidence score [0.0 - 1.0] */
    confidence: number;
    /** Top-3 candidate intents with scores for ML analysis */
    candidates: Array<{ intent: string; confidence: number }>;
    /** How many messages in this conversation before classification */
    conversationTurnNumber: number;
    /** Model used for classification */
    classifierModel: string;
    /** Latency of the classification call in milliseconds */
    latencyMs: number;
  };
}

/** AI queried the knowledge base */
export interface KnowledgeQueriedEvent extends BaseAIEvent {
  eventType: 'knowledge_queried';
  payload: {
    /** The normalized query sent to the knowledge base (stripped of PII) */
    queryText: string;
    /** Number of results returned */
    resultsCount: number;
    /** Top result similarity score [0.0 - 1.0] */
    topScore: number;
    /** Knowledge base collection/namespace queried */
    collection: string;
    /** Vector search latency in milliseconds */
    latencyMs: number;
    /** Hotel unit that filtered the search (if applicable) */
    hotelUnit: string | null;
  };
}

/** AI queried knowledge base but found no relevant answer */
export interface KnowledgeNotFoundEvent extends BaseAIEvent {
  eventType: 'knowledge_not_found';
  payload: {
    /** Normalized query text that had no good match (PII-stripped) */
    queryText: string;
    /** Best score that was still below threshold */
    bestScore: number;
    /** Threshold that was not met */
    threshold: number;
    /** Collection that was searched */
    collection: string;
    /** Hotel unit context */
    hotelUnit: string | null;
  };
}

/** AI called an LLM API (OpenAI, Anthropic, Groq, etc.) */
export interface LLMCalledEvent extends BaseAIEvent {
  eventType: 'llm_called';
  payload: {
    provider: 'openai' | 'anthropic' | 'groq' | 'gemini' | 'other';
    model: string;
    /** Input tokens consumed */
    promptTokens: number;
    /** Whether knowledge base context was injected */
    hasKnowledgeContext: boolean;
    /** Number of conversation turns in the context window */
    contextTurns: number;
    /** Temperature used for generation */
    temperature: number;
  };
}

/** LLM returned a response */
export interface LLMResponseEvent extends BaseAIEvent {
  eventType: 'llm_response';
  payload: {
    provider: 'openai' | 'anthropic' | 'groq' | 'gemini' | 'other';
    model: string;
    /** Completion tokens generated */
    completionTokens: number;
    /** Total tokens (prompt + completion) */
    totalTokens: number;
    /** End-to-end latency including API call */
    latencyMs: number;
    /** Whether the response was truncated due to max_tokens */
    wasTruncated: boolean;
    /** Response character count (not content for privacy) */
    responseLengthChars: number;
    /** Finish reason: stop | length | content_filter */
    finishReason: 'stop' | 'length' | 'content_filter' | 'error';
    /** Estimated USD cost of this LLM call (for billing analytics) */
    estimatedCostUsd: number;
  };
}

/** AI called an external tool/function */
export interface ToolCalledEvent extends BaseAIEvent {
  eventType: 'tool_called';
  payload: {
    toolName: string;
    /** Tool category for aggregation */
    toolCategory: 'booking' | 'availability' | 'pricing' | 'crm' | 'notification' | 'other';
    /** Whether the tool call succeeded */
    success: boolean;
    /** Tool execution latency in milliseconds */
    latencyMs: number;
    /** Error type if failed (not error message to avoid PII) */
    errorType: string | null;
  };
}

/** AI sent a message to the client */
export interface MessageSentEvent extends BaseAIEvent {
  eventType: 'message_sent';
  payload: {
    messageType: 'text' | 'buttons' | 'list' | 'template' | 'carousel' | 'media';
    /** Character count of the response */
    contentLengthChars: number;
    /** Whether the message contained a booking CTA */
    hasBookingCta: boolean;
    /** Whether the message contained a follow-up question */
    hasFollowUpQuestion: boolean;
    /** End-to-end latency from message received to message sent */
    e2eLatencyMs: number;
  };
}

/** AI decided to escalate to a human attendant */
export interface EscalatedToHumanEvent extends BaseAIEvent {
  eventType: 'escalated_to_human';
  payload: {
    reason: 'user_requested' | 'ai_unable' | 'complex_query' | 'complaint' | 'sales_opportunity' | 'urgency' | 'confidence_low' | 'other';
    /** How many AI turns happened before escalation */
    turnsBeforeEscalation: number;
    /** Intent that triggered the escalation (if classifiable) */
    triggerIntent: string | null;
    /** Was escalation triggered automatically by the AI or by user keyword? */
    isAutomatic: boolean;
    hotelUnit: string | null;
  };
}

/** A human attendant took over the conversation */
export interface HumanTookOverEvent extends BaseAIEvent {
  eventType: 'human_took_over';
  payload: {
    /** Minutes from escalation request to human pickup */
    responseTimeMinutes: number;
    /** Was there an active human from before or a new one? */
    isNewAssignment: boolean;
    hotelUnit: string | null;
  };
}

/** Human attendant sent a reply */
export interface HumanRespondedEvent extends BaseAIEvent {
  eventType: 'human_responded';
  payload: {
    /** Minutes from last client message to human response */
    responseTimeMinutes: number;
    /** Character count (not content) */
    contentLengthChars: number;
    /** Turn number in the human-handled section */
    humanTurnNumber: number;
  };
}

/** AI was reactivated after human handling */
export interface IaReactivatedEvent extends BaseAIEvent {
  eventType: 'ia_reactivated';
  payload: {
    /** Minutes the AI was locked before reactivation */
    lockDurationMinutes: number;
    /** Who/what triggered reactivation: 'auto_timeout' | 'attendant_manual' | 'follow_up_sent' */
    trigger: 'auto_timeout' | 'attendant_manual' | 'follow_up_sent';
    /** How many human turns happened during the lock period */
    humanTurnsDuringLock: number;
  };
}

/** AI sent an automated follow-up message */
export interface FollowupSentEvent extends BaseAIEvent {
  eventType: 'followup_sent';
  payload: {
    /** Hours since the last client message */
    hoursSinceLastMessage: number;
    /** Follow-up sequence number (1st, 2nd, 3rd follow-up) */
    followupSequence: number;
    messageType: 'text' | 'buttons' | 'template';
    hotelUnit: string | null;
  };
}

/** Client expressed satisfaction or rated the interaction */
export interface SatisfactionReceivedEvent extends BaseAIEvent {
  eventType: 'satisfaction_received';
  payload: {
    /** Numeric score if applicable [1-5 or 1-10] */
    score: number | null;
    /** Sentiment if derived from free text: positive | neutral | negative */
    sentiment: 'positive' | 'neutral' | 'negative' | null;
    /** Collection method: csat_survey | nps | free_text_inference */
    method: 'csat_survey' | 'nps' | 'free_text_inference';
    /** Was this conversation handled by AI, human, or both? */
    handledBy: 'ai_only' | 'human_only' | 'ai_then_human' | 'human_then_ai';
  };
}

/** AI created a booking link for the client */
export interface BookingLinkCreatedEvent extends BaseAIEvent {
  eventType: 'booking_link_created';
  payload: {
    hotelUnit: string;
    /** Check-in date as YYYY-MM-DD (no names, no personal data) */
    checkInDate: string;
    /** Check-out date as YYYY-MM-DD */
    checkOutDate: string;
    /** Number of nights */
    nights: number;
    /** Number of guests */
    guests: number;
    /** Whether the link was pre-filled with specific room type */
    hasRoomPreSelection: boolean;
  };
}

/** A booking was confirmed (webhook from booking engine) */
export interface BookingConfirmedEvent extends BaseAIEvent {
  eventType: 'booking_confirmed';
  payload: {
    hotelUnit: string;
    /** Length of stay in nights */
    nights: number;
    /** Number of guests */
    guests: number;
    /** Revenue tier: low | medium | high (not exact amount for privacy) */
    revenueTier: 'low' | 'medium' | 'high';
    /** Days from first contact to booking confirmation */
    daysToConversion: number;
    /** How many AI turns led to this booking */
    aiTurnsBeforeBooking: number;
    /** Did the booking come through AI or human handling? */
    attributedTo: 'ai' | 'human' | 'mixed';
  };
}

// ============================================
// UNION TYPE
// ============================================

export type AIEvent =
  | MessageReceivedEvent
  | IntentClassifiedEvent
  | KnowledgeQueriedEvent
  | KnowledgeNotFoundEvent
  | LLMCalledEvent
  | LLMResponseEvent
  | ToolCalledEvent
  | MessageSentEvent
  | EscalatedToHumanEvent
  | HumanTookOverEvent
  | HumanRespondedEvent
  | IaReactivatedEvent
  | FollowupSentEvent
  | SatisfactionReceivedEvent
  | BookingLinkCreatedEvent
  | BookingConfirmedEvent;

export type AIEventType = AIEvent['eventType'];

// ============================================
// HELPER TYPES
// ============================================

/** Type guard for extracting payload based on event type */
export type EventPayload<T extends AIEventType> = Extract<AIEvent, { eventType: T }>['payload'];

/** For batch inserts */
export type AIEventInsertRow = {
  event_id: string;
  tenant_id: string;
  tenant_slug_hash: string;
  conversation_id: string;
  message_id: string | null;
  event_type: AIEventType;
  channel: string;
  contact_id_hash: string;
  session_id: string;
  occurred_at: Date;
  schema_version: number;
  payload: Record<string, unknown>;
  // Retention / archival
  retain_until: Date;
};

/** Anonymized version for ML export (removes all tenant linkage) */
export type AnonymizedAIEvent = Omit<AIEventInsertRow, 'tenant_id' | 'contact_id_hash' | 'conversation_id'> & {
  tenant_cohort: string; // bucketed by plan+size, not id
  contact_cohort: string; // bucketed by interaction frequency
  conversation_cohort: string; // anonymized session token
};
