/**
 * AI Event Pipeline - Public API
 *
 * This is the only import needed by consumers of the event pipeline.
 * Import from here, not from individual modules.
 */

export { aiEventBus, hashPII, stripPIIFromText, emitMessageReceived, emitLLMCall, emitEscalation } from './ai-event-bus';
export { startAISession, getOrCreateAISession, endAISession } from './ai-session';
export type { AIEvent, AIEventType, BaseAIEvent, AIEventInsertRow, AnonymizedAIEvent } from './ai-event.types';
