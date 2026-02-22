// ============================================
// EVA Orchestrator
// Central AI engine — replaces N8N for Instagram
// ============================================

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenAIClient } from './config/openai.client';
import { EVA_CONFIG, HUMAN_REQUEST_KEYWORDS } from './config/eva.constants';
import {
  getCommercialSystemPrompt,
  getAfterHoursSystemPrompt,
  FALLBACK_MESSAGE,
  AUDIO_NOT_SUPPORTED_MESSAGE,
} from './config/prompts';
import { detectInjection, sanitizeOutput, stripPII } from './security/prompt-guard';
import { getConversationHistory, addMessage, clearMemory } from './memory/memory.service';
import { EVA_TOOLS } from './tools/tool-definitions';
import { executeToolCall } from './tools/tool-handlers';
import { isWithinBusinessHours, getNextBusinessHoursMessage } from './utils/business-hours';
import { channelRouter } from '@/services/channels/channel-router';
import { prisma } from '@/config/database';
import { getSocketIO } from '@/config/socket';
import { hashPII } from '@/events/ai-event-bus';
import { emitLLMCall, emitEscalation } from '@/events/ai-event-bus';
import logger from '@/config/logger';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface EvaProcessParams {
  tenantId: string;
  conversationId: string;
  contactId: string;
  contactName: string | null;
  senderId: string;
  channel: 'instagram' | 'messenger' | 'whatsapp';
  messageType: string;
  content: string;
  metadata: Record<string, unknown>;
  isNewConversation: boolean;
}

type ChannelUpperCase = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM';

// ============================================
// Orchestrator
// ============================================

class EvaOrchestrator {
  /**
   * Process an incoming message through the EVA AI pipeline.
   * This replaces the N8N fire-and-forget approach.
   *
   * Flow:
   * 1. Input validation + prompt guard
   * 2. Special commands (menu, cancelar, ##memoria##)
   * 3. Human request detection
   * 4. Build context (memory + system prompt)
   * 5. Call OpenAI with tools (max 3 iterations)
   * 6. Process response (carousels, multi-message)
   * 7. Send via Channel Router
   * 8. Save outbound message + emit socket
   * 9. Fallback if any step fails
   */
  async processMessage(params: EvaProcessParams): Promise<void> {
    const sessionId = randomUUID();
    const channelUpper = params.channel.toUpperCase() as ChannelUpperCase;
    const startTime = Date.now();

    logger.info(
      {
        sessionId,
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        channel: params.channel,
        messageType: params.messageType,
        contentPreview: params.content.substring(0, 80),
      },
      '[EVA] Processing message'
    );

    try {
      // 1. PROMPT GUARD
      if (detectInjection(params.content)) {
        logger.warn(
          { sessionId, conversationId: params.conversationId },
          '[EVA] Prompt injection blocked'
        );
        // Respond normally as if it's a regular message (don't reveal detection)
        await this.sendAndSave(
          params,
          channelUpper,
          'Desculpe, nao entendi sua mensagem. Como posso ajudar voce hoje?',
          startTime
        );
        return;
      }

      // 2. AUDIO — Instagram nao suporta transcricao direta
      if (params.messageType === 'AUDIO' && params.channel === 'instagram') {
        await this.sendAndSave(params, channelUpper, AUDIO_NOT_SUPPORTED_MESSAGE, startTime);
        return;
      }

      // 3. SPECIAL COMMANDS
      const lowerContent = params.content.toLowerCase().trim();

      if (lowerContent === '##memoria##') {
        await clearMemory(params.conversationId);
        await this.sendAndSave(params, channelUpper, 'Memoria limpa! Como posso ajudar?', startTime);
        return;
      }

      if (lowerContent === 'cancelar') {
        await this.sendAndSave(
          params,
          channelUpper,
          'Tudo bem! Se precisar de algo, e so me chamar. Ate mais!',
          startTime
        );
        return;
      }

      // 4. HUMAN REQUEST DETECTION
      if (this.detectHumanRequest(params.content)) {
        await this.handleEscalation(params, channelUpper, 'user_requested', startTime, sessionId);
        return;
      }

      // 5. ADD USER MESSAGE TO MEMORY (truncate + strip PII for OpenAI)
      const contentForMemory = stripPII(params.content.substring(0, 1000));
      await addMessage(params.conversationId, 'user', contentForMemory);

      // 6. BUILD MESSAGES ARRAY
      const history = await getConversationHistory(params.conversationId);
      const systemPrompt = this.selectSystemPrompt(null); // TODO: detectar unidade do contexto

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      ];

      // 7. CALL OPENAI WITH TOOL LOOP
      const aiResponse = await this.callOpenAI(messages, params, sessionId);

      if (!aiResponse) {
        // OpenAI failed — fallback
        await this.handleFallback(params, channelUpper, startTime, sessionId);
        return;
      }

      // 8. SANITIZE OUTPUT
      const sanitized = sanitizeOutput(aiResponse);

      // 9. SAVE AI RESPONSE TO MEMORY
      await addMessage(params.conversationId, 'assistant', sanitized);

      // 10. PROCESS AND SEND RESPONSE
      await this.processAndSendResponse(params, channelUpper, sanitized, startTime);

      logger.info(
        {
          sessionId,
          conversationId: params.conversationId,
          durationMs: Date.now() - startTime,
        },
        '[EVA] Message processing complete'
      );
    } catch (err) {
      logger.error(
        {
          sessionId,
          conversationId: params.conversationId,
          err: err instanceof Error ? err.message : 'Unknown',
          durationMs: Date.now() - startTime,
        },
        '[EVA] Pipeline error, executing fallback'
      );

      try {
        await this.handleFallback(params, channelUpper, startTime, sessionId);
      } catch (fallbackErr) {
        logger.error(
          { conversationId: params.conversationId, err: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown' },
          '[EVA] Even fallback failed'
        );
      }
    }
  }

  // ============================================
  // OpenAI Integration
  // ============================================

  /**
   * Call OpenAI with tool calling loop.
   * Max iterations to prevent infinite tool loops.
   */
  private async callOpenAI(
    messages: ChatCompletionMessageParam[],
    params: EvaProcessParams,
    sessionId: string
  ): Promise<string | null> {
    const openai = getOpenAIClient();
    let currentMessages = [...messages];

    for (let i = 0; i < EVA_CONFIG.MAX_TOOL_ITERATIONS; i++) {
      const completion = await openai.chat.completions.create({
        model: EVA_CONFIG.COMMERCIAL_MODEL,
        messages: currentMessages,
        tools: EVA_TOOLS,
        temperature: EVA_CONFIG.TEMPERATURE,
        max_tokens: 1024,
      });

      const choice = completion.choices[0];
      if (!choice) return null;

      // Emit LLM call event
      emitLLMCall({
        tenantId: params.tenantId,
        tenantSlugHash: hashPII(params.tenantId),
        conversationId: params.conversationId,
        messageId: null,
        channel: params.channel,
        contactIdHash: hashPII(params.senderId),
        sessionId,
        provider: 'openai',
        model: EVA_CONFIG.COMMERCIAL_MODEL,
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        hasKnowledgeContext: false,
        contextTurns: currentMessages.length,
        temperature: EVA_CONFIG.TEMPERATURE,
      });

      // If no tool calls, return the text response
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
        return choice.message.content ?? '';
      }

      // Process tool calls
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        // OpenAI SDK v6: tool calls can be 'function' type
        if (toolCall.type !== 'function') continue;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const toolResult = await executeToolCall(
          toolCall.function.name,
          args,
          {
            tenantId: params.tenantId,
            conversationId: params.conversationId,
            contactId: params.contactId,
            senderId: params.senderId,
            channel: params.channel,
          }
        );

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // If we exhausted iterations, get final response without tools
    const finalCompletion = await openai.chat.completions.create({
      model: EVA_CONFIG.COMMERCIAL_MODEL,
      messages: currentMessages,
      temperature: EVA_CONFIG.TEMPERATURE,
      max_tokens: 1024,
    });

    return finalCompletion.choices[0]?.message.content ?? null;
  }

  // ============================================
  // Response Processing
  // ============================================

  /**
   * Process AI response: detect carousel tags, split multi-messages, send.
   */
  private async processAndSendResponse(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    response: string,
    startTime: number
  ): Promise<void> {
    // Check for carousel tags
    const carouselMatch = response.match(/\|\s*#CARROSSEL-(GERAL|INDIVIDUAL)\s*(.*)?$/);

    if (carouselMatch) {
      const textBeforeTag = response.replace(/\|\s*#CARROSSEL-.*$/, '').trim();

      // Send text portion first
      if (textBeforeTag) {
        await this.sendAndSave(params, channelUpper, textBeforeTag, startTime);
      }

      // TODO: implement carousel sending when KB tables are connected
      // For now, log that carousel was requested
      logger.info(
        { conversationId: params.conversationId, carouselType: carouselMatch[1], rooms: carouselMatch[2] },
        '[EVA] Carousel tag detected (sending text only for MVP)'
      );
      return;
    }

    // Split multi-line responses (EVA can return multiple messages separated by \n)
    const lines = response.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length <= 3) {
      // Send as single message
      await this.sendAndSave(params, channelUpper, response, startTime);
    } else {
      // Send as multiple messages (max 3 to avoid spam)
      const chunks = this.chunkMessages(lines, 3);
      for (const chunk of chunks) {
        await this.sendAndSave(params, channelUpper, chunk, startTime);
      }
    }
  }

  /**
   * Groups lines into max N chunks
   */
  private chunkMessages(lines: string[], maxChunks: number): string[] {
    if (lines.length <= maxChunks) {
      return lines;
    }

    const linesPerChunk = Math.ceil(lines.length / maxChunks);
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += linesPerChunk) {
      chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
    }
    return chunks;
  }

  // ============================================
  // Send + Save
  // ============================================

  /**
   * Send message via Channel Router, save to DB, emit socket.
   */
  private async sendAndSave(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    text: string,
    startTime: number
  ): Promise<void> {
    // 1. Send via channel
    const sendResult = await channelRouter.sendText(
      channelUpper,
      params.tenantId,
      params.senderId,
      text
    );

    // 2. Save outbound message
    const savedMsg = await prisma.message.create({
      data: {
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        externalMessageId: sendResult.externalMessageId || null,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: text,
        metadata: { source: 'eva', channel: params.channel },
        status: sendResult.success ? 'SENT' : 'FAILED',
        timestamp: new Date(),
      },
    });

    // 3. Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: params.conversationId, tenantId: params.tenantId },
      data: { lastMessageAt: savedMsg.timestamp },
    });

    // 4. Emit socket
    try {
      const io = getSocketIO();
      io.to(`tenant:${params.tenantId}`).emit('message:new', {
        conversationId: params.conversationId,
        message: {
          id: savedMsg.id,
          conversationId: params.conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: text,
          status: sendResult.success ? 'SENT' : 'FAILED',
          createdAt: savedMsg.createdAt,
        },
      });
    } catch (socketErr) {
      logger.warn(
        { conversationId: params.conversationId, err: socketErr instanceof Error ? socketErr.message : 'Unknown' },
        '[EVA] Socket emit failed (non-critical)'
      );
    }

    logger.info(
      {
        conversationId: params.conversationId,
        messageId: savedMsg.id,
        channel: params.channel,
        textPreview: text.substring(0, 60),
        e2eMs: Date.now() - startTime,
      },
      '[EVA] Message sent and saved'
    );
  }

  // ============================================
  // Escalation + Fallback
  // ============================================

  private async handleEscalation(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    reason: 'user_requested' | 'ai_unable',
    startTime: number,
    sessionId: string
  ): Promise<void> {
    // 1. Lock IA
    await prisma.conversation.update({
      where: { id: params.conversationId, tenantId: params.tenantId },
      data: { iaLocked: true, status: 'OPEN' },
    });

    // 2. Create escalation
    const escalationReason = reason === 'user_requested' ? 'USER_REQUESTED' : 'AI_UNABLE';
    await prisma.escalation.create({
      data: {
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        reason: escalationReason as 'USER_REQUESTED' | 'AI_UNABLE',
        reasonDetail: reason === 'user_requested'
          ? 'Cliente solicitou atendente humano'
          : 'IA nao conseguiu processar a mensagem',
        status: 'PENDING',
      },
    });

    // 3. Send humanized message
    const message = reason === 'user_requested'
      ? 'Claro! Vou transferir voce para um de nossos atendentes. Aguarde um momento, por favor!'
      : FALLBACK_MESSAGE;

    await this.sendAndSave(params, channelUpper, message, startTime);

    // 4. Notify via socket
    try {
      const io = getSocketIO();
      io.to(`tenant:${params.tenantId}`).emit('conversation:escalated', {
        conversationId: params.conversationId,
        reason: escalationReason,
      });
    } catch { /* non-critical */ }

    // 5. Emit AI event
    emitEscalation({
      tenantId: params.tenantId,
      tenantSlugHash: hashPII(params.tenantId),
      conversationId: params.conversationId,
      messageId: null,
      channel: params.channel,
      contactIdHash: hashPII(params.senderId),
      sessionId,
      reason: reason,
      turnsBeforeEscalation: 0,
      triggerIntent: null,
      isAutomatic: reason !== 'user_requested',
      hotelUnit: null,
    });

    logger.info(
      { conversationId: params.conversationId, reason },
      '[EVA] Escalation handled'
    );
  }

  private async handleFallback(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    startTime: number,
    sessionId: string
  ): Promise<void> {
    await this.handleEscalation(params, channelUpper, 'ai_unable', startTime, sessionId);
  }

  // ============================================
  // Helpers
  // ============================================

  private detectHumanRequest(content: string): boolean {
    const lower = content.toLowerCase().trim();
    return HUMAN_REQUEST_KEYWORDS.some((kw) => lower.includes(kw));
  }

  /**
   * Select the appropriate system prompt based on context.
   */
  private selectSystemPrompt(hotelUnit: string | null): string {
    if (!isWithinBusinessHours()) {
      const nextAvailable = getNextBusinessHoursMessage();
      return getAfterHoursSystemPrompt(hotelUnit, nextAvailable);
    }

    // Default to commercial prompt
    // TODO: detect guest vs commercial based on IA_SDR_CAMPOS.fluxo_atual
    return getCommercialSystemPrompt(hotelUnit);
  }
}

// ============================================
// Singleton Export
// ============================================

export const evaOrchestrator = new EvaOrchestrator();
