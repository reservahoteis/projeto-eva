// ============================================
// EVA Orchestrator
// Central AI engine — replaces N8N for Instagram
// ============================================

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenAIClient } from './config/openai.client';
import {
  EVA_CONFIG,
  HUMAN_REQUEST_KEYWORDS,
  UNIDADES_MAP,
  HBOOK_COMPANY_IDS,
  UNIT_SELECTION_SECTIONS,
  MAIN_MENU_SECTIONS,
  MAIN_MENU_BODY_TEXT,
  MAIN_MENU_BUTTON_TEXT,
  CONTEXTUAL_QUICK_REPLIES,
  FAQ_CATEGORY_QUICK_REPLIES,
  FAQ_CATEGORIES,
  WELCOME_TEXT,
  UNIT_LIST_BODY_TEXT,
  UNIT_LIST_BUTTON_TEXT,
} from './config/eva.constants';
import {
  getCommercialSystemPrompt,
  getAfterHoursSystemPrompt,
  FALLBACK_MESSAGE,
  AUDIO_NOT_SUPPORTED_MESSAGE,
} from './config/prompts';
import { VALID_HOTEL_UNITS, HOTEL_UNIT_ALIASES, UNIT_DISPLAY_NAMES } from './config/eva.constants';
import { detectInjection, sanitizeOutput, stripPII } from './security/prompt-guard';
import { getConversationHistory, addMessage, clearMemory, setUnit, getUnit } from './memory/memory.service';
import { EVA_TOOLS } from './tools/tool-definitions';
import { executeToolCall } from './tools/tool-handlers';
import { getKBClient } from './config/kb-database';
import { isWithinBusinessHours, getNextBusinessHoursMessage } from './utils/business-hours';
import { channelRouter } from '@/services/channels/channel-router';
import { instagramAdapter } from '@/services/channels/instagram.adapter';
import { messengerAdapter } from '@/services/channels/messenger.adapter';
import type { QuickReplyPayload } from '@/services/channels/channel-send.interface';
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
   * 0. Intercept interactive postbacks/quick_replies
   * 1. Input validation + prompt guard
   * 2. Special commands (menu, cancelar, ##memoria##)
   * 3. Human request detection
   * 4. Unit detection (Redis + history)
   * 5. If no unit: send interactive unit selection menu
   * 6. Build context (memory + system prompt)
   * 7. Call OpenAI with tools (max 3 iterations)
   * 8. Process response (carousels, multi-message)
   * 9. Send via Channel Router + Quick Replies
   * 10. Save outbound message + emit socket
   * 11. Fallback if any step fails
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
      // 0. INTERCEPT INTERACTIVE CLICKS (postbacks / quick_replies)
      const buttonId = this.extractButtonId(params.metadata);
      let effectiveContent = params.content;

      if (buttonId) {
        const result = await this.handleInteractiveClick(
          buttonId, params, channelUpper, startTime, sessionId
        );
        if (result.handled) return;
        // Use overridden content if provided (e.g. orcar_reserva, tenho_reserva)
        if (result.contentOverride) effectiveContent = result.contentOverride;
      }

      // 1. PROMPT GUARD
      if (detectInjection(effectiveContent)) {
        logger.warn(
          { sessionId, conversationId: params.conversationId },
          '[EVA] Prompt injection blocked'
        );
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
      const lowerContent = effectiveContent.toLowerCase().trim();

      if (lowerContent === '##memoria##') {
        await clearMemory(params.conversationId);
        await this.sendAndSave(params, channelUpper, 'Memoria limpa!', startTime);
        await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
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
      if (this.detectHumanRequest(effectiveContent)) {
        const cachedUnit = await getUnit(params.conversationId);
        await this.handleEscalation(params, channelUpper, 'user_requested', startTime, sessionId, cachedUnit);
        return;
      }

      // 5. UNIT DETECTION (Redis first, then history scan)
      let detectedUnit = await getUnit(params.conversationId);
      let history = await getConversationHistory(params.conversationId);

      if (!detectedUnit) {
        detectedUnit = this.detectUnitFromHistory(history, effectiveContent);

        if (detectedUnit) {
          await setUnit(params.conversationId, detectedUnit);
        }
      }

      // 6. NO UNIT → SEND WELCOME + UNIT SELECTION MENU
      if (!detectedUnit) {
        await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
        return;
      }

      // 7. ADD USER MESSAGE TO MEMORY (truncate + strip PII for OpenAI)
      const contentForMemory = stripPII(effectiveContent.substring(0, 1000));
      await addMessage(params.conversationId, 'user', contentForMemory);

      // 8. BUILD MESSAGES ARRAY (re-fetch after addMessage so it includes the new user msg)
      history = await getConversationHistory(params.conversationId);
      const systemPrompt = this.selectSystemPrompt(detectedUnit, params.contactName);

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      ];

      // 9. CALL OPENAI WITH TOOL LOOP
      const aiResponse = await this.callOpenAI(messages, params, sessionId);

      if (!aiResponse) {
        await this.handleFallback(params, channelUpper, startTime, sessionId, detectedUnit);
        return;
      }

      // 10. SANITIZE OUTPUT
      const sanitized = sanitizeOutput(aiResponse);

      // 11. SAVE AI RESPONSE TO MEMORY
      await addMessage(params.conversationId, 'assistant', sanitized);

      // 12. PROCESS AND SEND RESPONSE (includes carousel handling)
      await this.processAndSendResponse(params, channelUpper, sanitized, startTime, detectedUnit);

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
        const fallbackUnit = await getUnit(params.conversationId).catch(() => null);
        await this.handleFallback(params, channelUpper, startTime, sessionId, fallbackUnit);
      } catch (fallbackErr) {
        logger.error(
          { conversationId: params.conversationId, err: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown' },
          '[EVA] Even fallback failed'
        );
      }
    }
  }

  // ============================================
  // Interactive Click Processing
  // ============================================

  /**
   * Extract button ID from metadata (postback or quick_reply).
   * Instagram worker puts these at metadata.button.id.
   */
  private extractButtonId(metadata: Record<string, unknown>): string | null {
    const button = metadata.button as Record<string, unknown> | undefined;
    if (button?.id) return String(button.id);

    const quickReply = metadata.quick_reply as Record<string, unknown> | undefined;
    if (quickReply?.payload) return String(quickReply.payload);

    return null;
  }

  /**
   * Handle interactive clicks (postbacks / quick_replies).
   * Returns { handled, contentOverride } — never mutates params.
   */
  private async handleInteractiveClick(
    buttonId: string,
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    startTime: number,
    sessionId: string
  ): Promise<{ handled: boolean; contentOverride?: string }> {
    logger.info(
      { conversationId: params.conversationId, buttonId, channel: params.channel },
      '[EVA] Interactive click received'
    );

    // MENU INICIAL → re-send welcome + unit list
    if (buttonId === 'menu_inicial') {
      await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
      return { handled: true };
    }

    // UNIT SELECTION (info_ilhabela, info_campos, etc.)
    if (UNIDADES_MAP[buttonId]) {
      const unit = UNIDADES_MAP[buttonId];
      await setUnit(params.conversationId, unit);

      // Add to memory so OpenAI knows the unit
      await addMessage(params.conversationId, 'user', `Escolhi a unidade ${unit}`);

      // Send confirmation + main menu list (replicating N8N)
      const confirmText = `Otimo! Voce escolheu a unidade ${this.formatUnitName(unit)}. Como posso ajudar?`;
      await this.sendAndSave(params, channelUpper, confirmText, startTime);
      await addMessage(params.conversationId, 'assistant', confirmText);
      await this.sendMainMenu(params, channelUpper);

      return { handled: true };
    }

    // FAQ CATEGORIES (cat_checkin, cat_acesso, etc.)
    if (buttonId.startsWith('cat_')) {
      await this.handleFaqCategory(params, channelUpper, buttonId, startTime, sessionId);
      return { handled: true };
    }

    // DUVIDAS FREQUENTES → FAQ category menu
    if (buttonId === 'duvidas_frequentes') {
      const faqIntro = 'Sobre qual assunto voce tem duvida?';
      await addMessage(params.conversationId, 'user', 'Duvidas frequentes');
      await this.sendAndSave(params, channelUpper, faqIntro, startTime);
      await addMessage(params.conversationId, 'assistant', faqIntro);
      await this.sendQuickReplies(params, channelUpper, 'Escolha o tema:', FAQ_CATEGORY_QUICK_REPLIES);
      return { handled: true };
    }

    // JA ESTOU HOSPEDADO → ask for room number (same as N8N)
    if (buttonId === 'hospedado_ajuda') {
      await addMessage(params.conversationId, 'user', 'Ja estou hospedado e quero ajuda');
      const guestMsg = 'Para que eu possa ajuda-lo da melhor maneira, poderia me informar o numero da sua suite e qual e a sua duvida ou necessidade?\n\nEstou aqui para oferecer o suporte que voce precisar durante a sua estadia!';
      await this.sendAndSave(params, channelUpper, guestMsg, startTime);
      await addMessage(params.conversationId, 'assistant', guestMsg);
      return { handled: true };
    }

    // QUERO ORCAR → fall through to OpenAI with overridden content
    if (buttonId === 'orcar_reserva') {
      const unit = await getUnit(params.conversationId);
      if (unit) {
        await addMessage(params.conversationId, 'user', 'Quero orcar uma reserva');
        return { handled: false, contentOverride: 'Quero orcar uma reserva, me mostre os quartos disponiveis' };
      }
      await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
      return { handled: true };
    }

    // JA TENHO RESERVA → fall through to OpenAI with overridden content
    if (buttonId === 'tenho_reserva') {
      await addMessage(params.conversationId, 'user', 'Ja tenho uma reserva');
      return { handled: false, contentOverride: 'Ja tenho uma reserva e preciso de ajuda' };
    }

    // ALTERAR UNIDADE → back to unit selection
    if (buttonId === 'alterar_unidade') {
      await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
      return { handled: true };
    }

    // MENU PRINCIPAL → resend main menu (after AI responses)
    if (buttonId === 'menu_principal') {
      await this.sendMainMenu(params, channelUpper);
      return { handled: true };
    }

    // FALAR HUMANO → escalation
    if (buttonId === 'falar_humano') {
      const unit = await getUnit(params.conversationId);
      await this.handleEscalation(params, channelUpper, 'user_requested', startTime, sessionId, unit);
      return { handled: true };
    }

    // Unrecognized button — log and fall through
    logger.warn(
      { conversationId: params.conversationId, buttonId },
      '[EVA] Unrecognized interactive button, falling through to normal flow'
    );
    return { handled: false };
  }

  // ============================================
  // Welcome + Unit Selection
  // ============================================

  /**
   * Send welcome message + interactive unit selection list.
   * On Instagram/Messenger: degrades to Quick Replies (5 items = perfect).
   * On WhatsApp: sends native interactive list.
   */
  private async sendWelcomeAndUnitMenu(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    startTime: number
  ): Promise<void> {
    const contactName = params.contactName;
    const greeting = contactName
      ? `Ola, ${contactName}! ${WELCOME_TEXT.replace('Ola! ', '')}`
      : WELCOME_TEXT;

    // Send welcome text + persist to memory
    await this.sendAndSave(params, channelUpper, greeting, startTime);
    await addMessage(params.conversationId, 'assistant', greeting);

    // Send interactive unit list (degrades to Quick Replies on Instagram)
    await channelRouter.sendList(
      channelUpper,
      params.tenantId,
      params.senderId,
      UNIT_LIST_BODY_TEXT,
      UNIT_LIST_BUTTON_TEXT,
      UNIT_SELECTION_SECTIONS
    );

    logger.info(
      { conversationId: params.conversationId, channel: params.channel },
      '[EVA] Welcome + unit selection menu sent'
    );
  }

  // ============================================
  // Main Menu (after unit selection)
  // ============================================

  /**
   * Send main menu list after unit selection (replicating N8N).
   * Options: Duvidas Frequentes, Ja Estou Hospedado, Quero Orcar, Ja Tenho Reserva, Alterar Unidade.
   */
  private async sendMainMenu(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase
  ): Promise<void> {
    await channelRouter.sendList(
      channelUpper,
      params.tenantId,
      params.senderId,
      MAIN_MENU_BODY_TEXT,
      MAIN_MENU_BUTTON_TEXT,
      MAIN_MENU_SECTIONS
    );

    logger.info(
      { conversationId: params.conversationId, channel: params.channel },
      '[EVA] Main menu sent'
    );
  }

  // ============================================
  // FAQ Category Handling
  // ============================================

  /**
   * Handle FAQ category selection (cat_checkin, cat_acesso, etc.)
   * Queries KB directly and sends result without calling OpenAI.
   */
  private async handleFaqCategory(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    categoryId: string,
    startTime: number,
    _sessionId: string
  ): Promise<void> {
    const unit = await getUnit(params.conversationId);
    if (!unit) {
      await this.sendWelcomeAndUnitMenu(params, channelUpper, startTime);
      return;
    }

    // Validate category against known allowlist (prevent SQL injection via crafted payload)
    const category = FAQ_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) {
      logger.warn(
        { conversationId: params.conversationId, categoryId },
        '[EVA] Unknown FAQ category, ignoring'
      );
      await this.sendAndSave(params, channelUpper, 'Categoria nao reconhecida. Posso ajudar com outra coisa?', startTime);
      return;
    }
    const categoryLabel = category.title;

    // Query KB for FAQs — catSearch is safe (validated above against FAQ_CATEGORIES allowlist)
    const kb = getKBClient();
    const catSearch = categoryId.replace('cat_', '');

    const rows = await kb.$queryRawUnsafe(
      `SELECT "Pergunta", "Resposta" FROM infos_faq
       WHERE UPPER("Unidade") = $1 AND LOWER("Categoria") LIKE $2
       LIMIT 10`,
      unit,
      `%${catSearch}%`
    ) as Array<{ Pergunta: string; Resposta: string }>;

    await addMessage(params.conversationId, 'user', `FAQ: ${categoryLabel}`);

    if (rows.length === 0) {
      const noResultMsg = `Nao encontrei informacoes sobre "${categoryLabel}" para esta unidade. Posso ajudar com outra coisa?`;
      await this.sendAndSave(params, channelUpper, noResultMsg, startTime);
      await addMessage(params.conversationId, 'assistant', noResultMsg);
    } else {
      const faqText = rows.slice(0, 3).map((r) =>
        `*${r.Pergunta}*\n${r.Resposta}`
      ).join('\n\n');

      await this.sendAndSave(params, channelUpper, faqText, startTime);
      await addMessage(params.conversationId, 'assistant', faqText);
    }

    // Send commercial quick replies for navigation
    await this.sendQuickReplies(params, channelUpper, 'Como posso ajudar mais?', CONTEXTUAL_QUICK_REPLIES);
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
    // Enforce global timeout (CRIT-3: prevents OpenAI from hanging forever)
    return new Promise<string | null>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('OpenAI timeout')),
        EVA_CONFIG.PROCESSING_TIMEOUT_MS
      );

      this.callOpenAIInternal(messages, params, sessionId)
        .then((result) => { clearTimeout(timer); resolve(result); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  private async callOpenAIInternal(
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
   * Now also sends contextual quick replies after the AI response.
   */
  private async processAndSendResponse(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    response: string,
    startTime: number,
    detectedUnit: string | null
  ): Promise<void> {
    // Check for carousel tags (trimEnd to handle trailing newlines from OpenAI)
    const carouselMatch = response.trimEnd().match(/\|\s*#CARROSSEL-(GERAL|INDIVIDUAL)\s*(.*)$/);

    if (carouselMatch) {
      const textBeforeTag = response.replace(/\|\s*#CARROSSEL-.*$/, '').trim();
      const carouselType = carouselMatch[1] as 'GERAL' | 'INDIVIDUAL';
      const roomNames = carouselMatch[2]?.trim() || '';

      // Send text portion first
      if (textBeforeTag) {
        await this.sendAndSave(params, channelUpper, textBeforeTag, startTime);
      }

      // Send carousel
      if (detectedUnit) {
        await this.sendCarouselCards(params, channelUpper, carouselType, roomNames, detectedUnit, startTime);
      } else {
        logger.warn(
          { conversationId: params.conversationId, carouselType },
          '[EVA] Carousel requested but no unit detected'
        );
      }

      // Send contextual quick replies after carousel
      await this.sendQuickReplies(params, channelUpper, 'Como posso ajudar mais?', CONTEXTUAL_QUICK_REPLIES);
      return;
    }

    // Split long responses by character limit (Instagram ~1000 chars max)
    const MAX_MSG_LENGTH = 950;
    const messages = response.length <= MAX_MSG_LENGTH
      ? [response]
      : this.splitByCharLimit(response, MAX_MSG_LENGTH);

    for (const msg of messages) {
      await this.sendAndSave(params, channelUpper, msg, startTime);
    }

    // Send contextual quick replies after AI response
    await this.sendQuickReplies(params, channelUpper, 'Como posso ajudar mais?', CONTEXTUAL_QUICK_REPLIES);
  }

  /**
   * Split text into chunks respecting a character limit.
   * Splits at paragraph boundaries (\n\n), then line boundaries (\n).
   */
  private splitByCharLimit(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      // Try splitting at paragraph boundary
      let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
      if (splitIdx <= 0) {
        // Try line boundary
        splitIdx = remaining.lastIndexOf('\n', maxLength);
      }
      if (splitIdx <= 0) {
        // Hard cut at last space
        splitIdx = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIdx <= 0) {
        // Absolute fallback
        splitIdx = maxLength;
      }

      chunks.push(remaining.substring(0, splitIdx).trim());
      remaining = remaining.substring(splitIdx).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }

  // ============================================
  // Carousel Sending
  // ============================================

  /**
   * Send carousel cards via Instagram/Messenger Generic Template.
   * Queries KB for room data and builds card elements.
   */
  private async sendCarouselCards(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    carouselType: 'GERAL' | 'INDIVIDUAL',
    roomNames: string,
    unit: string,
    startTime: number
  ): Promise<void> {
    try {
      const kb = getKBClient();
      let rows: Array<Record<string, unknown>>;

      if (carouselType === 'INDIVIDUAL' && roomNames) {
        // Individual carousel: specific rooms by name
        const names = roomNames.split(',').map((n) => n.trim()).filter(Boolean);
        if (names.length === 0) {
          logger.warn({ conversationId: params.conversationId }, '[EVA] Individual carousel with no room names');
          return;
        }

        // Build parameterized query
        const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
        rows = await kb.$queryRawUnsafe(
          `SELECT "Tipo", "Categoria", "Descricao", "linkImage"
           FROM infos_carrossel_individual
           WHERE "Categoria" IN (${placeholders})
           LIMIT 10`,
          ...names
        ) as Array<Record<string, unknown>>;
      } else {
        // General carousel: all rooms for the unit
        rows = await kb.$queryRawUnsafe(
          `SELECT "Tipo", "Categoria", "Descricao", "linkImage"
           FROM infos_quartos
           WHERE UPPER("Unidade") = $1
           ORDER BY "Categoria"
           LIMIT 10`,
          unit
        ) as Array<Record<string, unknown>>;
      }

      if (rows.length === 0) {
        await this.sendAndSave(
          params, channelUpper,
          'Nao encontrei quartos disponiveis para esta unidade no momento.',
          startTime
        );
        return;
      }

      // Build HBook reservation link
      const companyId = HBOOK_COMPANY_IDS[unit] || '';
      const reserveUrl = companyId
        ? `https://reserva.hoteis.app/${companyId}?utm_source=eva&utm_medium=instagram`
        : 'https://hoteisreserva.com.br';

      // Build card elements for Generic Template
      const elements = rows.map((row) => ({
        title: String(row.Tipo || row.Categoria || 'Quarto'),
        subtitle: String(row.Descricao || '').substring(0, 80),
        imageUrl: row.linkImage ? String(row.linkImage) : undefined,
        buttons: [
          { id: 'ver_quartos', title: 'Ver detalhes', url: reserveUrl },
        ],
      }));

      // Instagram/Messenger: use Generic Template (real carousel)
      if (channelUpper === 'INSTAGRAM' || channelUpper === 'MESSENGER') {
        const adapter = channelUpper === 'INSTAGRAM' ? instagramAdapter : messengerAdapter;

        if ('sendGenericTemplate' in adapter) {
          await (adapter as typeof instagramAdapter).sendGenericTemplate(
            params.tenantId,
            params.senderId,
            elements
          );

          logger.info(
            { conversationId: params.conversationId, cardCount: elements.length, carouselType, unit },
            '[EVA] Carousel sent via Generic Template'
          );
          return;
        }
      }

      // WhatsApp/fallback: send text list with image links
      const textCards = elements.map((el, i) =>
        `${i + 1}. *${el.title}*\n${el.subtitle}\n${reserveUrl}`
      ).join('\n\n');

      await this.sendAndSave(params, channelUpper, textCards, startTime);

      logger.info(
        { conversationId: params.conversationId, cardCount: elements.length, carouselType },
        '[EVA] Carousel sent as text (WhatsApp fallback)'
      );
    } catch (err) {
      logger.error(
        { conversationId: params.conversationId, err: err instanceof Error ? err.message : 'Unknown', carouselType },
        '[EVA] Carousel send failed'
      );
      await this.sendAndSave(
        params, channelUpper,
        'Nao consegui carregar os quartos no momento. Tente novamente ou fale com um atendente.',
        startTime
      );
    }
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

  /**
   * Send Quick Replies via Channel Router (fire-and-forget, not saved to DB).
   * Quick Replies are ephemeral UI elements, not persistent messages.
   */
  private async sendQuickReplies(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    text: string,
    quickReplies: QuickReplyPayload[]
  ): Promise<void> {
    try {
      await channelRouter.sendQuickReplies(
        channelUpper,
        params.tenantId,
        params.senderId,
        text,
        quickReplies
      );
    } catch (err) {
      logger.warn(
        { conversationId: params.conversationId, err: err instanceof Error ? err.message : 'Unknown' },
        '[EVA] Quick Replies send failed (non-critical)'
      );
    }
  }

  // ============================================
  // Escalation + Fallback
  // ============================================

  private async handleEscalation(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    reason: 'user_requested' | 'ai_unable',
    startTime: number,
    sessionId: string,
    hotelUnit?: string | null
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

    // 5. Emit AI event (pass actual hotelUnit when known)
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
      hotelUnit: hotelUnit ?? null,
    });

    logger.info(
      { conversationId: params.conversationId, reason },
      '[EVA] Escalation handled'
    );
  }

  /**
   * Fallback on technical errors (OpenAI timeout, API key missing, etc.)
   * IMPORTANT: Does NOT set iaLocked=true — the next message should retry.
   */
  private async handleFallback(
    params: EvaProcessParams,
    channelUpper: ChannelUpperCase,
    startTime: number,
    sessionId: string,
    hotelUnit?: string | null
  ): Promise<void> {
    await this.sendAndSave(params, channelUpper, FALLBACK_MESSAGE, startTime);

    emitEscalation({
      tenantId: params.tenantId,
      tenantSlugHash: hashPII(params.tenantId),
      conversationId: params.conversationId,
      messageId: null,
      channel: params.channel,
      contactIdHash: hashPII(params.senderId),
      sessionId,
      reason: 'ai_unable',
      turnsBeforeEscalation: 0,
      triggerIntent: null,
      isAutomatic: true,
      hotelUnit: hotelUnit ?? null,
    });

    logger.warn(
      { conversationId: params.conversationId, reason: 'ai_unable' },
      '[EVA] Fallback sent (conversation NOT locked — next message will retry)'
    );
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
  private selectSystemPrompt(hotelUnit: string | null, contactName: string | null): string {
    if (!isWithinBusinessHours()) {
      const nextAvailable = getNextBusinessHoursMessage();
      return getAfterHoursSystemPrompt(hotelUnit, nextAvailable, contactName);
    }

    return getCommercialSystemPrompt(hotelUnit, contactName);
  }

  /**
   * Detect hotel unit from conversation history and current message.
   */
  private detectUnitFromHistory(
    history: Array<{ role: string; content: string }>,
    currentContent: string
  ): string | null {
    const textsToScan = [
      currentContent,
      ...history.slice().reverse().map((h) => h.content),
    ];

    for (const text of textsToScan) {
      const lower = text.toLowerCase();

      for (const unit of VALID_HOTEL_UNITS) {
        const needle = unit.toLowerCase();
        const regex = new RegExp(`(?<![a-zA-ZÀ-ÿ])${this.escapeRegex(needle)}(?![a-zA-ZÀ-ÿ])`, 'i');
        if (regex.test(lower)) {
          return this.normalizeUnitKey(unit.toUpperCase());
        }
      }

      for (const [alias, displayName] of Object.entries(HOTEL_UNIT_ALIASES)) {
        const needle = alias.replace(/_/g, ' ');
        const regex = new RegExp(`(?<![a-zA-ZÀ-ÿ])${this.escapeRegex(needle)}(?![a-zA-ZÀ-ÿ])`, 'i');
        if (regex.test(lower)) {
          return this.normalizeUnitKey(displayName.toUpperCase());
        }
      }
    }

    return null;
  }

  /** Format unit key to display name (uses canonical UNIT_DISPLAY_NAMES) */
  private formatUnitName(key: string): string {
    return UNIT_DISPLAY_NAMES[key] || key;
  }

  /** Normalize display name to DB key */
  private normalizeUnitKey(upper: string): string {
    if (upper === 'CAMPOS DO JORDAO') return 'CAMPOS';
    if (upper === 'SANTO ANTONIO DO PINHAL') return 'SANTO ANTONIO';
    if (upper === 'SANTA SMART HOTEL') return 'SANTA';
    return upper;
  }

  /** Escape string for use in RegExp */
  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================
// Singleton Export
// ============================================

export const evaOrchestrator = new EvaOrchestrator();
