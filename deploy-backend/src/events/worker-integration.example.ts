/**
 * AI Event Bus - Worker Integration Example
 *
 * This file shows HOW to add event emission to the existing
 * process-incoming-message.worker.ts WITHOUT modifying its core logic.
 *
 * Pattern: Wrap existing calls with event emission.
 * The emit() calls are always non-blocking (fire-and-forget).
 * If the event bus fails, the main processing continues unaffected.
 *
 * IMPORTANT: Do NOT copy this file verbatim. It is a reference for
 * where to place emit() calls in the existing worker. Each TODO below
 * marks the insertion point in process-incoming-message.worker.ts.
 *
 * DO NOT import this file anywhere. It is documentation only.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { emitMessageReceived, emitEscalation, aiEventBus } from './index';
import { startAISession } from './ai-session';

// ============================================
// INTEGRATION POINTS IN process-incoming-message.worker.ts
// ============================================

/**
 * STEP 1: Add session start at the top of processIncomingMessage()
 * Location: after destructuring job.data, before try block
 *
 * const sessionId = await startAISession(conversation.id);
 * const contactIdHash = hashPII(message.from);  // hash the phone number
 * const tenantSlugHash = hashPII(tenantId);
 */

/**
 * STEP 2: After saving message to DB (after prisma.message.create)
 * Emit message_received event with structural features (never content)
 *
 * Example:
 */
export function _example_emitOnMessageReceived(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  messageId: string; // internal DB id
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  messageContent: string;
  messageType: string;
  isNewConversation: boolean;
}) {
  emitMessageReceived({
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: params.messageId,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    messageType: mapMessageType(params.messageType),
    // Structural features only - never the content itself
    contentLengthChars: params.messageContent.length,
    wordCount: params.messageContent.trim().split(/\s+/).filter(Boolean).length,
    isNewConversation: params.isNewConversation,
    isStructuredReply: ['button_reply', 'list_reply'].includes(params.messageType),
  });
}

/**
 * STEP 3: When N8N is called (in handleHumanRequest or escalation logic)
 * Emit escalated_to_human event
 *
 * Example - in handleHumanRequest():
 */
export async function _example_emitOnEscalation(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  messageCount: number;
  hotelUnit: string | null;
}) {
  emitEscalation({
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: null,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    reason: 'user_requested',
    turnsBeforeEscalation: params.messageCount,
    triggerIntent: null, // Will be populated when TS AI replaces N8N
    isAutomatic: false,
    hotelUnit: params.hotelUnit,
  });
}

/**
 * STEP 4: After N8N call resolves (in n8nService.forwardToN8N callback)
 * Emit message_sent event with latency
 *
 * Note: N8N sends the reply asynchronously, so we emit for the forward call,
 * not the actual delivery. When migrating to TypeScript AI, emit after send.
 *
 * Example:
 */
export function _example_emitOnMessageSent(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  e2eLatencyMs: number;
}) {
  // fire-and-forget, no await needed
  aiEventBus.emit('message_sent', {
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: null,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    payload: {
      messageType: 'text', // Will be richer when TS AI replaces N8N
      contentLengthChars: 0, // Not available at this point
      hasBookingCta: false, // Not available at this point
      hasFollowUpQuestion: false,
      e2eLatencyMs: params.e2eLatencyMs,
    },
  } as any);
}

/**
 * STEP 5: In process-ia-reactivation.worker.ts
 * Emit ia_reactivated when the IA lock is removed
 *
 * Example:
 */
export async function _example_emitOnIAReactivation(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  contactIdHash: string;
  lockDurationMinutes: number;
}) {
  const sessionId = await startAISession(params.conversationId);

  aiEventBus.emit('ia_reactivated', {
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: null,
    channel: 'whatsapp', // Worker doesn't know channel - could be stored on conversation
    contactIdHash: params.contactIdHash,
    sessionId,
    payload: {
      lockDurationMinutes: params.lockDurationMinutes,
      trigger: 'auto_timeout',
      humanTurnsDuringLock: 0, // Would need to query DB for this
    },
  } as any);
}

// ============================================
// HELPERS
// ============================================

function mapMessageType(type: string): 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'button_reply' | 'list_reply' {
  const map: Record<string, 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'button_reply' | 'list_reply'> = {
    TEXT: 'text',
    IMAGE: 'image',
    AUDIO: 'audio',
    VIDEO: 'video',
    DOCUMENT: 'document',
    LOCATION: 'location',
    button_reply: 'button_reply',
    list_reply: 'list_reply',
    INTERACTIVE: 'button_reply',
    TEMPLATE: 'text',
  };
  return map[type] ?? 'text';
}

// ============================================
// N8N CALLBACK ENDPOINT INTEGRATION
// ============================================

/**
 * When N8N finishes processing and calls back to the backend
 * (e.g., via POST /api/n8n/send-text), emit events for what happened:
 *
 * In n8n.routes.ts, after successful message send:
 *
 *   aiEventBus.emit('message_sent', {
 *     tenantId,
 *     tenantSlugHash: hashPII(tenantId),
 *     conversationId,
 *     messageId: null,
 *     channel: payload.channel ?? 'whatsapp',
 *     contactIdHash: hashPII(contact.externalId),
 *     sessionId: await getOrCreateAISession(conversationId),
 *     payload: {
 *       messageType: 'text',
 *       contentLengthChars: response.text?.length ?? 0,
 *       hasBookingCta: response.text?.includes('booking') ?? false,
 *       hasFollowUpQuestion: response.text?.includes('?') ?? false,
 *       e2eLatencyMs: Date.now() - requestStartTime,
 *     },
 *   });
 *
 * This gives us attribution between what N8N sent and the session.
 */

export {}; // Make this a module (prevents TypeScript errors on unused imports)
