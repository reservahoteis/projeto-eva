/**
 * Testes para ChannelRouter, MessengerAdapter e InstagramAdapter
 *
 * TDD: RED -> GREEN -> REFACTOR
 *
 * Cobre:
 * - ChannelRouter: roteamento para adapter correto por canal
 * - ChannelRouter: degradacao automatica de sendList, sendTemplate, markAsRead
 * - MessengerAdapter: sendText, sendMedia, sendButtons, erros
 * - InstagramAdapter: sendText, sendMedia (nativo vs degradado), sendButtons (degradado)
 *
 * MULTI-TENANT SECURITY:
 * - TODA query Prisma DEVE incluir tenantId na WHERE clause
 * - Adapters buscam credenciais via prisma.tenant.findUnique com { where: { id: tenantId } }
 */

import { ChannelRouter } from '@/services/channels/channel-router';
import { MessengerAdapter } from '@/services/channels/messenger.adapter';
import { InstagramAdapter } from '@/services/channels/instagram.adapter';
import { prisma } from '@/config/database';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import type {
  SendResult,
  MediaPayload,
  ButtonPayload,
  ListSection,
} from '@/services/channels/channel-send.interface';

// ============================================
// Module-level mocks
// Devem ser declarados antes dos imports que os usam.
// ============================================

// Mock do Prisma - sobrescreve o mock global do jest.setup.ts
jest.mock('@/config/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock do modulo de encriptacao
// A implementacao padrao e restaurada em cada beforeEach porque resetMocks: true
// apaga implementacoes inline; usamos mockImplementation no beforeEach.
jest.mock('@/utils/encryption', () => ({
  decrypt: jest.fn(),
}));

// Mock axios-retry (no-op em testes)
jest.mock('@/utils/axios-retry', () => ({
  addRetryInterceptor: jest.fn((instance: any) => instance),
}));

// Mock do logger
jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock dos tres adapters de canal para isolar o ChannelRouter da logica HTTP.
// Os testes de adapter (MessengerAdapter, InstagramAdapter) usam instancias
// frescas do construtor e testam a logica HTTP de forma independente.
jest.mock('@/services/channels/whatsapp.adapter', () => ({
  whatsappAdapter: {
    channel: 'WHATSAPP' as const,
    sendText: jest.fn(),
    sendMedia: jest.fn(),
    sendButtons: jest.fn(),
    sendList: jest.fn(),
    sendTemplate: jest.fn(),
    markAsRead: jest.fn(),
  },
}));

jest.mock('@/services/channels/messenger.adapter', () => ({
  // Exporta a classe real para uso nos testes de MessengerAdapter
  MessengerAdapter: jest.requireActual('@/services/channels/messenger.adapter').MessengerAdapter,
  // Exporta um singleton mockado para uso pelo ChannelRouter
  messengerAdapter: {
    channel: 'MESSENGER' as const,
    sendText: jest.fn(),
    sendMedia: jest.fn(),
    sendButtons: jest.fn(),
    sendQuickReplies: jest.fn(),
    // sendList NAO implementado - Messenger nao suporta lista nativa
    // sendTemplate NAO implementado - Messenger nao suporta template
    // markAsRead NAO implementado - Messenger nao suporta
  },
}));

jest.mock('@/services/channels/instagram.adapter', () => ({
  // Exporta a classe real para uso nos testes de InstagramAdapter
  InstagramAdapter: jest.requireActual('@/services/channels/instagram.adapter').InstagramAdapter,
  // Exporta um singleton mockado para uso pelo ChannelRouter
  instagramAdapter: {
    channel: 'INSTAGRAM' as const,
    sendText: jest.fn(),
    sendMedia: jest.fn(),
    sendButtons: jest.fn(),
    sendQuickReplies: jest.fn(),
    // sendList NAO implementado - Instagram nao suporta lista nativa
    // sendTemplate NAO implementado - Instagram nao suporta template
    // markAsRead NAO implementado - Instagram nao suporta
  },
}));

// Mock do axios.
// IMPORTANTE: resetMocks: true no jest.config apaga o mockReturnValue do axios.create
// entre testes. Por isso, cada beforeEach deve re-configurar axios.create.
jest.mock('axios', () => ({
  create: jest.fn(),
  post: jest.fn(),
  get: jest.fn(),
}));

// ============================================
// Imports pos-mock
// ============================================
import axios from 'axios';
import { whatsappAdapter } from '@/services/channels/whatsapp.adapter';
import { messengerAdapter } from '@/services/channels/messenger.adapter';
import { instagramAdapter } from '@/services/channels/instagram.adapter';
import { decrypt } from '@/utils/encryption';

// ============================================
// Type helpers - cast para mocks tipados
// ============================================
const mockPrismaTenant = prisma.tenant as jest.Mocked<typeof prisma.tenant>;
const mockWhatsappAdapter = whatsappAdapter as jest.Mocked<typeof whatsappAdapter>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

// Os singletons mockados do Messenger e Instagram usados pelo ChannelRouter.
// Sao diferentes das instancias usadas nos testes de adapter (MessengerAdapter, InstagramAdapter)
// que criam objetos via `new` para ter cache limpo.
// O cast via `unknown` e necessario porque TS ve o tipo declarado da classe real.
const mockMessengerSingleton = messengerAdapter as unknown as {
  channel: 'MESSENGER';
  sendText: jest.Mock;
  sendMedia: jest.Mock;
  sendButtons: jest.Mock;
  sendQuickReplies: jest.Mock;
};

const mockInstagramSingleton = instagramAdapter as unknown as {
  channel: 'INSTAGRAM';
  sendText: jest.Mock;
  sendMedia: jest.Mock;
  sendButtons: jest.Mock;
  sendQuickReplies: jest.Mock;
};

// ============================================
// Factories de dados de teste
// ============================================

function makeSendResult(id = 'ext-msg-001'): SendResult {
  return { externalMessageId: id, success: true };
}

function makeMessengerTenant() {
  return {
    messengerPageId: 'page-123',
    messengerAccessToken: 'encrypted-messenger-token',
  };
}

function makeInstagramTenant() {
  return {
    instagramAccountId: 'ig-account-456',
    instagramAccessToken: 'encrypted-instagram-token',
  };
}

function makeButtons(): ButtonPayload[] {
  return [
    { id: 'btn-1', title: 'Opcao 1' },
    { id: 'btn-2', title: 'Opcao 2' },
    { id: 'btn-3', title: 'Opcao 3' },
  ];
}

function makeListSections(): ListSection[] {
  return [
    {
      title: 'Categoria A',
      rows: [
        { id: 'row-1', title: 'Item 1', description: 'Descricao do item 1' },
        { id: 'row-2', title: 'Item 2' },
      ],
    },
    {
      title: 'Categoria B',
      rows: [
        { id: 'row-3', title: 'Item 3', description: 'Descricao do item 3' },
      ],
    },
  ];
}

function makeMediaPayload(type: MediaPayload['type'] = 'image'): MediaPayload {
  return {
    type,
    url: 'https://example.com/media.jpg',
    caption: 'Legenda da midia',
  };
}

/**
 * Cria um mock fresco de instancia axios e o registra em axios.create.
 * Retorna o mock de `post` para uso nas assertions.
 * Deve ser chamado no beforeEach de cada describe que usa adapters HTTP.
 */
function setupAxiosMock(defaultMessageId = 'default-msg-id'): jest.Mock {
  const mockPost = jest.fn().mockResolvedValue({ data: { message_id: defaultMessageId } });
  (axios.create as jest.Mock).mockReturnValue({ post: mockPost });
  return mockPost;
}

// ============================================
// ChannelRouter
// Usa os singletons MOCKADOS de cada adapter.
// Testa apenas logica de roteamento e degradacao do router.
// ============================================

describe('ChannelRouter', () => {
  let router: ChannelRouter;
  const tenantId = 'tenant-router-uuid';
  const to = '+5511999990000';

  beforeEach(() => {
    router = new ChannelRouter();
  });

  // -----------------------------------------------
  // sendText - roteamento por canal
  // -----------------------------------------------

  describe('sendText - roteamento por canal', () => {
    it('deve rotear sendText para whatsappAdapter quando canal e WHATSAPP', async () => {
      // Arrange
      const expectedResult = makeSendResult('wa-msg-001');
      mockWhatsappAdapter.sendText.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendText('WHATSAPP', tenantId, to, 'Ola WhatsApp');

      // Assert
      expect(mockWhatsappAdapter.sendText).toHaveBeenCalledWith(tenantId, to, 'Ola WhatsApp');
      expect(result).toEqual(expectedResult);
    });

    it('deve rotear sendText para messengerAdapter quando canal e MESSENGER', async () => {
      // Arrange
      const expectedResult = makeSendResult('fb-msg-001');
      mockMessengerSingleton.sendText.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendText('MESSENGER', tenantId, to, 'Ola Messenger');

      // Assert - roteou para Messenger com os argumentos corretos
      expect(mockMessengerSingleton.sendText).toHaveBeenCalledWith(tenantId, to, 'Ola Messenger');
      expect(mockWhatsappAdapter.sendText).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('deve rotear sendText para instagramAdapter quando canal e INSTAGRAM', async () => {
      // Arrange
      const expectedResult = makeSendResult('ig-msg-001');
      mockInstagramSingleton.sendText.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendText('INSTAGRAM', tenantId, to, 'Ola Instagram');

      // Assert - roteou para Instagram com os argumentos corretos
      expect(mockInstagramSingleton.sendText).toHaveBeenCalledWith(tenantId, to, 'Ola Instagram');
      expect(mockWhatsappAdapter.sendText).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  // -----------------------------------------------
  // sendButtons - roteamento e degradacao
  // -----------------------------------------------

  describe('sendButtons - roteamento e degradacao', () => {
    const buttons = makeButtons();

    it('deve rotear sendButtons para whatsappAdapter sem degradacao', async () => {
      // Arrange
      const expectedResult = makeSendResult('wa-btn-001');
      mockWhatsappAdapter.sendButtons.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendButtons(
        'WHATSAPP',
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons,
        'Titulo',
        'Rodape'
      );

      // Assert
      expect(mockWhatsappAdapter.sendButtons).toHaveBeenCalledWith(
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons,
        'Titulo',
        'Rodape'
      );
      expect(result).toEqual(expectedResult);
    });

    it('deve rotear sendButtons para messengerAdapter', async () => {
      // Arrange
      const expectedResult = makeSendResult('fb-btn-001');
      mockMessengerSingleton.sendButtons.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendButtons(
        'MESSENGER',
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons
      );

      // Assert - delega para messenger sem degradacao adicional (Messenger tem sendButtons)
      expect(mockMessengerSingleton.sendButtons).toHaveBeenCalledWith(
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons,
        undefined,
        undefined
      );
      expect(mockWhatsappAdapter.sendButtons).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar sendButtons para texto numerado no Instagram (Instagram sendButtons delega para sendText)', async () => {
      // Arrange - Instagram.sendButtons internamente chama sendText com texto numerado.
      // O mock do singleton recebe a chamada de sendButtons do router.
      const expectedResult = makeSendResult('ig-btn-001');
      mockInstagramSingleton.sendButtons.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendButtons(
        'INSTAGRAM',
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons
      );

      // Assert - router delega para instagram.sendButtons;
      // a degradacao para texto numerado e testada nos testes de InstagramAdapter
      expect(mockInstagramSingleton.sendButtons).toHaveBeenCalledWith(
        tenantId,
        to,
        'Escolha uma opcao:',
        buttons,
        undefined,
        undefined
      );
      expect(mockWhatsappAdapter.sendButtons).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  // -----------------------------------------------
  // sendList - degradacao por canal
  // -----------------------------------------------

  describe('sendList - degradacao por canal', () => {
    const sections = makeListSections();

    it('deve usar sendList nativo para WHATSAPP (adapter tem suporte)', async () => {
      // Arrange
      const expectedResult = makeSendResult('wa-list-001');
      mockWhatsappAdapter.sendList.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendList(
        'WHATSAPP',
        tenantId,
        to,
        'Veja nossas opcoes:',
        'Ver opcoes',
        sections,
        'Cabecalho',
        'Rodape'
      );

      // Assert - WhatsApp tem sendList nativo
      expect(mockWhatsappAdapter.sendList).toHaveBeenCalledWith(
        tenantId,
        to,
        'Veja nossas opcoes:',
        'Ver opcoes',
        sections,
        'Cabecalho',
        'Rodape'
      );
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar sendList para Quick Replies no MESSENGER (adapter nao tem sendList)', async () => {
      // Arrange - Messenger nao tem sendList; o router chama sendQuickReplies
      const expectedResult = makeSendResult('fb-list-degraded-001');
      mockMessengerSingleton.sendQuickReplies.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendList(
        'MESSENGER',
        tenantId,
        to,
        'Veja nossas opcoes:',
        'Ver opcoes',
        sections
      );

      // Assert - router degradou: chamou sendQuickReplies (max 13) em vez de sendButtons (max 3)
      expect(mockMessengerSingleton.sendQuickReplies).toHaveBeenCalledWith(
        tenantId,
        to,
        'Veja nossas opcoes:',
        expect.any(Array)
      );
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar lista do MESSENGER para Quick Replies com TODOS os itens (max 13)', async () => {
      // Arrange - secao com 5 linhas; Quick Replies suportam ate 13 itens
      const largeSections: ListSection[] = [
        {
          rows: [
            { id: 'r1', title: 'Item 1' },
            { id: 'r2', title: 'Item 2' },
            { id: 'r3', title: 'Item 3' },
            { id: 'r4', title: 'Item 4' },
            { id: 'r5', title: 'Item 5' },
          ],
        },
      ];

      mockMessengerSingleton.sendQuickReplies.mockResolvedValue(makeSendResult('fb-list-qr'));

      // Act
      await router.sendList('MESSENGER', tenantId, to, 'Opcoes:', 'Ver', largeSections);

      // Assert - Quick Replies devem ter TODOS os 5 itens (nao mais limitado a 3)
      const qrArg = mockMessengerSingleton.sendQuickReplies.mock.calls[0]?.[3] as Array<{ title: string; payload: string }> | undefined;
      expect(qrArg).toHaveLength(5);
      expect(qrArg?.[0]).toEqual({ title: 'Item 1', payload: 'r1' });
      expect(qrArg?.[4]).toEqual({ title: 'Item 5', payload: 'r5' });
    });

    it('deve flatten multi-secao e enviar todas as rows como Quick Replies no MESSENGER', async () => {
      // Arrange - duas secoes: 2 rows cada = 4 total
      const multiSections: ListSection[] = [
        {
          rows: [
            { id: 'row-1', title: 'Item 1' },
            { id: 'row-2', title: 'Item 2' },
          ],
        },
        {
          rows: [
            { id: 'row-3', title: 'Item 3' },
            { id: 'row-4', title: 'Item 4' },
          ],
        },
      ];

      mockMessengerSingleton.sendQuickReplies.mockResolvedValue(makeSendResult('fb-flatten-test'));

      // Act
      await router.sendList('MESSENGER', tenantId, to, 'Opcoes:', 'Ver', multiSections);

      // Assert - todas as 4 rows como Quick Replies (sem corte)
      const qrArg = mockMessengerSingleton.sendQuickReplies.mock.calls[0]?.[3] as Array<{ title: string; payload: string }> | undefined;
      expect(qrArg).toHaveLength(4);
      expect(qrArg?.[0]).toEqual({ title: 'Item 1', payload: 'row-1' });
      expect(qrArg?.[1]).toEqual({ title: 'Item 2', payload: 'row-2' });
      expect(qrArg?.[2]).toEqual({ title: 'Item 3', payload: 'row-3' });
      expect(qrArg?.[3]).toEqual({ title: 'Item 4', payload: 'row-4' });
    });

    it('deve degradar sendList para Quick Replies no INSTAGRAM (adapter nao tem sendList)', async () => {
      // Arrange - Instagram nao tem sendList; o router chama sendQuickReplies
      const expectedResult = makeSendResult('ig-list-qr-001');
      mockInstagramSingleton.sendQuickReplies.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendList(
        'INSTAGRAM',
        tenantId,
        to,
        'Veja nossas opcoes:',
        'Ver opcoes',
        sections
      );

      // Assert - router degradou para sendQuickReplies (max 13 itens)
      expect(mockInstagramSingleton.sendQuickReplies).toHaveBeenCalledWith(
        tenantId,
        to,
        'Veja nossas opcoes:',
        expect.any(Array)
      );
      const qrArg = mockInstagramSingleton.sendQuickReplies.mock.calls[0]?.[3] as Array<{ title: string; payload: string }> | undefined;
      expect(qrArg).toHaveLength(3); // 3 rows total from makeListSections
      expect(qrArg?.[0]).toEqual({ title: 'Item 1', payload: 'row-1' });
      expect(qrArg?.[1]).toEqual({ title: 'Item 2', payload: 'row-2' });
      expect(qrArg?.[2]).toEqual({ title: 'Item 3', payload: 'row-3' });
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar lista do INSTAGRAM para texto numerado quando mais de 13 itens', async () => {
      // Arrange - secao com 14 linhas; ultrapassa limite de Quick Replies
      const manyRows = Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, title: `Item ${i + 1}` }));
      const hugeSections: ListSection[] = [{ rows: manyRows }];
      mockInstagramSingleton.sendText.mockResolvedValue(makeSendResult('ig-text-fallback'));

      // Act
      await router.sendList('INSTAGRAM', tenantId, to, 'Escolha:', 'Ver', hugeSections);

      // Assert - fallback para texto numerado
      expect(mockInstagramSingleton.sendText).toHaveBeenCalled();
      const sentText = mockInstagramSingleton.sendText.mock.calls[0]?.[2] as string | undefined;
      expect(sentText).toContain('Escolha:');
      expect(sentText).toContain('1. Item 1');
      expect(sentText).toContain('14. Item 14');
    });
  });

  // -----------------------------------------------
  // sendTemplate - degradacao por canal
  // -----------------------------------------------

  describe('sendTemplate - degradacao por canal', () => {
    it('deve usar sendTemplate nativo para WHATSAPP', async () => {
      // Arrange
      const expectedResult = makeSendResult('wa-tmpl-001');
      mockWhatsappAdapter.sendTemplate.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendTemplate(
        'WHATSAPP',
        tenantId,
        to,
        'reserva_confirmada',
        ['Hotel Central', '2026-03-10'],
        'pt_BR'
      );

      // Assert
      expect(mockWhatsappAdapter.sendTemplate).toHaveBeenCalledWith(
        tenantId,
        to,
        'reserva_confirmada',
        ['Hotel Central', '2026-03-10'],
        'pt_BR'
      );
      expect(result).toEqual(expectedResult);
    });

    it('deve usar languageCode padrao pt_BR quando nao informado para WHATSAPP', async () => {
      // Arrange
      mockWhatsappAdapter.sendTemplate.mockResolvedValue(makeSendResult('wa-tmpl-ptbr'));

      // Act
      await router.sendTemplate('WHATSAPP', tenantId, to, 'reserva_confirmada', []);

      // Assert - languageCode deve ser 'pt_BR' por padrao
      expect(mockWhatsappAdapter.sendTemplate).toHaveBeenCalledWith(
        tenantId,
        to,
        'reserva_confirmada',
        [],
        'pt_BR'
      );
    });

    it('deve degradar template para texto simples no MESSENGER (adapter nao tem sendTemplate)', async () => {
      // Arrange - Messenger nao tem sendTemplate; router chama sendText com texto formatado
      const expectedResult = makeSendResult('fb-tmpl-text-001');
      mockMessengerSingleton.sendText.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendTemplate(
        'MESSENGER',
        tenantId,
        to,
        'reserva_confirmada',
        ['Hotel Central', '2026-03-10']
      );

      // Assert - router degradou para sendText
      expect(mockMessengerSingleton.sendText).toHaveBeenCalled();
      const sentText = mockMessengerSingleton.sendText.mock.calls[0]?.[2] as string | undefined;
      expect(sentText).toContain('[Template: reserva_confirmada]');
      expect(sentText).toContain('Hotel Central');
      expect(sentText).toContain('2026-03-10');
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar template para texto simples no INSTAGRAM (adapter nao tem sendTemplate)', async () => {
      // Arrange
      const expectedResult = makeSendResult('ig-tmpl-text-001');
      mockInstagramSingleton.sendText.mockResolvedValue(expectedResult);

      // Act
      const result = await router.sendTemplate(
        'INSTAGRAM',
        tenantId,
        to,
        'boas_vindas',
        ['Joao Silva']
      );

      // Assert
      expect(mockInstagramSingleton.sendText).toHaveBeenCalled();
      const sentText = mockInstagramSingleton.sendText.mock.calls[0]?.[2] as string | undefined;
      expect(sentText).toContain('[Template: boas_vindas]');
      expect(sentText).toContain('Joao Silva');
      expect(result).toEqual(expectedResult);
    });

    it('deve degradar template sem parametros para texto sem secao de parametros', async () => {
      // Arrange
      mockMessengerSingleton.sendText.mockResolvedValue(makeSendResult('fb-tmpl-noparams'));

      // Act
      await router.sendTemplate('MESSENGER', tenantId, to, 'template_simples', []);

      // Assert - sem parametros, texto deve ser apenas "[Template: nome]" sem newline extra
      const sentText = mockMessengerSingleton.sendText.mock.calls[0]?.[2] as string | undefined;
      expect(sentText).toBe('[Template: template_simples]');
    });
  });

  // -----------------------------------------------
  // markAsRead - suporte por canal
  // -----------------------------------------------

  describe('markAsRead - suporte por canal', () => {
    it('deve chamar markAsRead do whatsappAdapter quando canal e WHATSAPP', async () => {
      // Arrange
      mockWhatsappAdapter.markAsRead.mockResolvedValue(undefined);

      // Act
      await router.markAsRead('WHATSAPP', tenantId, 'wamid.abc123');

      // Assert
      expect(mockWhatsappAdapter.markAsRead).toHaveBeenCalledWith(tenantId, 'wamid.abc123');
    });

    it('deve silenciosamente ignorar markAsRead no MESSENGER (sem suporte nativo)', async () => {
      // Act - Nao deve lancar erro
      await expect(
        router.markAsRead('MESSENGER', tenantId, 'fb-msg-456')
      ).resolves.toBeUndefined();

      // Assert - WhatsApp nao e chamado
      expect(mockWhatsappAdapter.markAsRead).not.toHaveBeenCalled();
    });

    it('deve silenciosamente ignorar markAsRead no INSTAGRAM (sem suporte nativo)', async () => {
      // Act - Nao deve lancar erro
      await expect(
        router.markAsRead('INSTAGRAM', tenantId, 'ig-msg-789')
      ).resolves.toBeUndefined();

      // Assert - WhatsApp nao e chamado
      expect(mockWhatsappAdapter.markAsRead).not.toHaveBeenCalled();
    });

    it('deve retornar void ao chamar markAsRead no WhatsApp com sucesso', async () => {
      // Arrange
      mockWhatsappAdapter.markAsRead.mockResolvedValue(undefined);

      // Act
      const result = await router.markAsRead('WHATSAPP', tenantId, 'wamid.xyz');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // -----------------------------------------------
  // getAdapter - retorno correto
  // -----------------------------------------------

  describe('getAdapter - retorno correto por canal', () => {
    it('deve retornar whatsappAdapter para canal WHATSAPP', () => {
      const adapter = router.getAdapter('WHATSAPP');
      expect(adapter.channel).toBe('WHATSAPP');
    });

    it('deve retornar messengerAdapter para canal MESSENGER', () => {
      const adapter = router.getAdapter('MESSENGER');
      expect(adapter.channel).toBe('MESSENGER');
    });

    it('deve retornar instagramAdapter para canal INSTAGRAM', () => {
      const adapter = router.getAdapter('INSTAGRAM');
      expect(adapter.channel).toBe('INSTAGRAM');
    });
  });
});

// ============================================
// MessengerAdapter
// ============================================

describe('MessengerAdapter', () => {
  let adapter: MessengerAdapter;
  let mockAxiosPost: jest.Mock;
  const tenantId = 'tenant-messenger-uuid';
  const to = '98765432100';

  beforeEach(() => {
    // resetMocks:true apaga implementacoes de mocks entre testes.
    // Reconfigurar decrypt e axios.create aqui para cada teste.
    mockDecrypt.mockImplementation((value: string) => `decrypted:${value}`);
    mockAxiosPost = setupAxiosMock('fb-default-id');

    // Cria nova instancia a cada teste para limpar o axiosCache interno
    adapter = new MessengerAdapter();

    // Setup padrao do tenant com Messenger configurado
    mockPrismaTenant.findUnique.mockResolvedValue(makeMessengerTenant() as never);
  });

  // -----------------------------------------------
  // Configuracao de tenant (multi-tenant security)
  // -----------------------------------------------

  describe('getAxiosForTenant - Multi-Tenant Security', () => {
    it('deve buscar credenciais do tenant pelo tenantId correto', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'msg-1' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert - CRITICO: busca com WHERE id = tenantId e campos corretos
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        select: {
          messengerPageId: true,
          messengerAccessToken: true,
        },
      });
    });

    it('deve lancar BadRequestError quando tenant nao tem Messenger configurado', async () => {
      // Arrange - tenant inexistente
      mockPrismaTenant.findUnique.mockResolvedValue(null as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);

      await expect(
        new MessengerAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow('Tenant não tem Messenger configurado');
    });

    it('deve lancar BadRequestError quando messengerPageId esta ausente', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue({
        messengerPageId: null,
        messengerAccessToken: 'encrypted-token',
      } as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lancar BadRequestError quando messengerAccessToken esta ausente', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue({
        messengerPageId: 'page-123',
        messengerAccessToken: null,
      } as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve descriptografar o accessToken antes de criar instancia axios', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'msg-decrypt-test' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert - decrypt foi chamado com o valor do campo encriptado
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-messenger-token');
    });

    it('deve lancar BadRequestError quando descriptografia falha', async () => {
      // Arrange - decrypt lanca excecao
      mockDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed: invalid key');
      });

      // Act & Assert - adapter fresco para garantir que cache nao interfere
      await expect(
        new MessengerAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);

      await expect(
        new MessengerAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow('Tenant não tem Messenger configurado');
    });

    it('deve criar instancia axios apontando para Graph API com access_token descriptografado', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'msg-axios-test' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert - axios.create chamado com configuracoes corretas
      // O token descriptografado e 'decrypted:encrypted-messenger-token'
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://graph.facebook.com/v21.0',
          params: { access_token: 'decrypted:encrypted-messenger-token' },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        })
      );
    });

    it('deve reutilizar instancia axios cacheada para o mesmo tenant', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'msg-cache' } });

      // Act - duas chamadas para o mesmo tenant na mesma instancia de adapter
      await adapter.sendText(tenantId, to, 'Mensagem 1');
      await adapter.sendText(tenantId, to, 'Mensagem 2');

      // Assert - prisma.tenant.findUnique chamado apenas 1 vez (cache hit na segunda)
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('deve buscar credenciais separadas para tenants distintos', async () => {
      // Arrange
      const tenantId2 = 'tenant-messenger-uuid-2';
      mockPrismaTenant.findUnique.mockResolvedValue(makeMessengerTenant() as never);
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'msg-multi-tenant' } });

      // Act
      await adapter.sendText(tenantId, to, 'Msg tenant 1');
      await adapter.sendText(tenantId2, to, 'Msg tenant 2');

      // Assert - findUnique chamado com tenantId correto para cada tenant
      expect(mockPrismaTenant.findUnique).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { id: tenantId } })
      );
      expect(mockPrismaTenant.findUnique).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { id: tenantId2 } })
      );
    });
  });

  // -----------------------------------------------
  // sendText
  // -----------------------------------------------

  describe('sendText', () => {
    it('deve chamar Graph API POST /me/messages com recipient e text corretos', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-text-001' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola, como posso ajudar?');

      // Assert
      expect(mockAxiosPost).toHaveBeenCalledWith('/me/messages', {
        recipient: { id: to },
        message: { text: 'Ola, como posso ajudar?' },
      });
    });

    it('deve retornar SendResult com externalMessageId e success=true', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-text-002' } });

      // Act
      const result = await adapter.sendText(tenantId, to, 'Mensagem de teste');

      // Assert
      expect(result).toEqual<SendResult>({
        externalMessageId: 'fb-text-002',
        success: true,
      });
    });

    it('deve retornar externalMessageId vazio quando Graph API nao retorna message_id', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: {} });

      // Act
      const result = await adapter.sendText(tenantId, to, 'Mensagem sem ID retornado');

      // Assert
      expect(result.externalMessageId).toBe('');
      expect(result.success).toBe(true);
    });

    it('deve lancar InternalServerError quando Graph API falha', async () => {
      // Arrange
      mockAxiosPost.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Mensagem que vai falhar')
      ).rejects.toThrow(InternalServerError);
    });

    it('deve incluir mensagem de erro original ao lancar InternalServerError', async () => {
      // Arrange
      mockAxiosPost.mockRejectedValue(new Error('Request failed with status 400'));

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Mensagem')
      ).rejects.toThrow('Falha ao enviar mensagem Messenger: Request failed with status 400');
    });
  });

  // -----------------------------------------------
  // sendMedia
  // -----------------------------------------------

  describe('sendMedia', () => {
    it('deve enviar attachment de imagem para Graph API', async () => {
      // Arrange
      const media = makeMediaPayload('image');
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-img-001' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - primeira chamada e o upload da midia
      expect(mockAxiosPost).toHaveBeenNthCalledWith(1, '/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'image',
            payload: { url: media.url, is_reusable: true },
          },
        },
      });
    });

    it('deve enviar attachment de video para Graph API', async () => {
      // Arrange
      const media = makeMediaPayload('video');
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-vid-001' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert
      const firstCallBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { attachment?: { type?: string } };
      } | undefined;
      expect(firstCallBody?.message?.attachment?.type).toBe('video');
    });

    it('deve converter tipo document para file (compatibilidade Messenger)', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'document',
        url: 'https://example.com/doc.pdf',
        filename: 'contrato.pdf',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-doc-001' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - Messenger usa 'file' em vez de 'document'
      const firstCallBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { attachment?: { type?: string } };
      } | undefined;
      expect(firstCallBody?.message?.attachment?.type).toBe('file');
    });

    it('deve enviar caption como mensagem de texto separada quando presente', async () => {
      // Arrange
      const media = makeMediaPayload('image'); // tem caption: 'Legenda da midia'
      mockAxiosPost
        .mockResolvedValueOnce({ data: { message_id: 'fb-media-001' } }) // upload midia
        .mockResolvedValueOnce({ data: { message_id: 'fb-caption-001' } }); // caption

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - Duas chamadas POST: upload + caption
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
      const captionCallBody = mockAxiosPost.mock.calls[1]?.[1] as {
        message?: { text?: string };
      } | undefined;
      expect(captionCallBody?.message?.text).toBe('Legenda da midia');
    });

    it('deve enviar apenas midia quando caption e ausente', async () => {
      // Arrange
      const mediaWithoutCaption: MediaPayload = {
        type: 'audio',
        url: 'https://example.com/audio.mp3',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-audio-001' } });

      // Act
      await adapter.sendMedia(tenantId, to, mediaWithoutCaption);

      // Assert - apenas 1 chamada POST (sem caption)
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('deve retornar externalMessageId da primeira chamada (upload da midia)', async () => {
      // Arrange
      const media = makeMediaPayload('image');
      mockAxiosPost
        .mockResolvedValueOnce({ data: { message_id: 'fb-media-primary' } })
        .mockResolvedValueOnce({ data: { message_id: 'fb-caption-secondary' } });

      // Act
      const result = await adapter.sendMedia(tenantId, to, media);

      // Assert - ID e da mensagem de midia, nao da caption
      expect(result.externalMessageId).toBe('fb-media-primary');
      expect(result.success).toBe(true);
    });

    it('deve lancar InternalServerError quando upload de midia falha', async () => {
      // Arrange
      const media = makeMediaPayload('video');
      mockAxiosPost.mockRejectedValue(new Error('Media upload failed'));

      // Act & Assert
      await expect(
        adapter.sendMedia(tenantId, to, media)
      ).rejects.toThrow(InternalServerError);

      await expect(
        new MessengerAdapter().sendMedia(tenantId, to, media)
      ).rejects.toThrow('Falha ao enviar mídia Messenger');
    });
  });

  // -----------------------------------------------
  // sendButtons
  // -----------------------------------------------

  describe('sendButtons', () => {
    const buttons = makeButtons();

    it('deve enviar button template para Graph API com formato correto', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-btn-template-001' } });

      // Act
      await adapter.sendButtons(tenantId, to, 'Escolha uma opcao:', buttons);

      // Assert
      expect(mockAxiosPost).toHaveBeenCalledWith('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: 'Escolha uma opcao:',
              buttons: [
                { type: 'postback', title: 'Opcao 1', payload: 'btn-1' },
                { type: 'postback', title: 'Opcao 2', payload: 'btn-2' },
                { type: 'postback', title: 'Opcao 3', payload: 'btn-3' },
              ],
            },
          },
        },
      });
    });

    it('deve truncar titulos de botao para 20 caracteres (limite Messenger)', async () => {
      // Arrange
      const longTitleButtons: ButtonPayload[] = [
        { id: 'btn-long', title: 'Este titulo e muito longo para caber' },
      ];
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-btn-truncated' } });

      // Act
      await adapter.sendButtons(tenantId, to, 'Texto:', longTitleButtons);

      // Assert - titulo deve ser truncado em 20 chars (substring(0, 20))
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { attachment?: { payload?: { buttons?: Array<{ title: string }> } } };
      } | undefined;
      const sentTitle = postedBody?.message?.attachment?.payload?.buttons?.[0]?.title ?? '';
      expect(sentTitle.length).toBeLessThanOrEqual(20);
      expect(sentTitle).toBe('Este titulo e muito ');
    });

    it('deve usar o id do botao como payload postback', async () => {
      // Arrange
      const singleButton: ButtonPayload[] = [{ id: 'action-confirm', title: 'Confirmar' }];
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-btn-payload' } });

      // Act
      await adapter.sendButtons(tenantId, to, 'Confirme sua reserva:', singleButton);

      // Assert
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { attachment?: { payload?: { buttons?: Array<{ payload: string }> } } };
      } | undefined;
      expect(postedBody?.message?.attachment?.payload?.buttons?.[0]?.payload).toBe('action-confirm');
    });

    it('deve retornar SendResult com externalMessageId e success=true', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-btn-result' } });

      // Act
      const result = await adapter.sendButtons(tenantId, to, 'Escolha:', buttons);

      // Assert
      expect(result).toEqual<SendResult>({
        externalMessageId: 'fb-btn-result',
        success: true,
      });
    });

    it('deve ignorar headerText e footerText (Messenger button template nao suporta)', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'fb-btn-no-header' } });

      // Act - passar header e footer nao deve lancar erro
      await expect(
        adapter.sendButtons(tenantId, to, 'Texto:', buttons, 'Header ignorado', 'Footer ignorado')
      ).resolves.toBeDefined();
    });

    it('deve lancar InternalServerError quando Graph API retorna erro', async () => {
      // Arrange
      mockAxiosPost.mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(
        adapter.sendButtons(tenantId, to, 'Texto:', buttons)
      ).rejects.toThrow(InternalServerError);

      await expect(
        new MessengerAdapter().sendButtons(tenantId, to, 'Texto:', buttons)
      ).rejects.toThrow('Falha ao enviar botões Messenger');
    });
  });
});

// ============================================
// InstagramAdapter
// ============================================

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;
  let mockAxiosPost: jest.Mock;
  const tenantId = 'tenant-instagram-uuid';
  const to = 'ig-user-handle-456';

  beforeEach(() => {
    // resetMocks:true apaga implementacoes; reconfigurar aqui
    mockDecrypt.mockImplementation((value: string) => `decrypted:${value}`);
    mockAxiosPost = setupAxiosMock('ig-default-id');

    // Nova instancia por teste para limpar axiosCache interno
    adapter = new InstagramAdapter();

    // Setup padrao do tenant com Instagram configurado
    mockPrismaTenant.findUnique.mockResolvedValue(makeInstagramTenant() as never);
  });

  // -----------------------------------------------
  // Configuracao de tenant (multi-tenant security)
  // -----------------------------------------------

  describe('getAxiosForTenant - Multi-Tenant Security', () => {
    it('deve buscar credenciais do tenant pelo tenantId correto', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-msg-1' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert - CRITICO: busca com WHERE id = tenantId e campos de Instagram
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        select: {
          instagramAccountId: true,
          instagramAccessToken: true,
        },
      });
    });

    it('deve lancar BadRequestError quando tenant nao tem Instagram configurado', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(null as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);

      await expect(
        new InstagramAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow('Tenant não tem Instagram configurado');
    });

    it('deve lancar BadRequestError quando instagramAccountId esta ausente', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue({
        instagramAccountId: null,
        instagramAccessToken: 'encrypted-token',
      } as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lancar BadRequestError quando instagramAccessToken esta ausente', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue({
        instagramAccountId: 'ig-account-456',
        instagramAccessToken: null,
      } as never);

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve descriptografar o accessToken antes de criar instancia axios', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-decrypt-test' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-instagram-token');
    });

    it('deve lancar BadRequestError quando descriptografia falha', async () => {
      // Arrange - decrypt lanca excecao para simular chave invalida
      mockDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // Act & Assert - adapter fresco para garantir que cache nao interfere
      await expect(
        new InstagramAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow(BadRequestError);

      await expect(
        new InstagramAdapter().sendText(tenantId, to, 'Ola')
      ).rejects.toThrow('Tenant não tem Instagram configurado');
    });

    it('deve criar instancia axios apontando para Graph API v21.0 com access_token descriptografado', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-axios-cfg' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola');

      // Assert - token descriptografado e 'decrypted:encrypted-instagram-token'
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://graph.facebook.com/v21.0',
          params: { access_token: 'decrypted:encrypted-instagram-token' },
          timeout: 30000,
        })
      );
    });

    it('deve reutilizar instancia axios cacheada para o mesmo tenant', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-cache' } });

      // Act
      await adapter.sendText(tenantId, to, 'Msg 1');
      await adapter.sendText(tenantId, to, 'Msg 2');

      // Assert - findUnique chamado apenas uma vez (segunda usa cache)
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('deve criar instancias separadas para tenants distintos', async () => {
      // Arrange
      const tenantId2 = 'tenant-instagram-uuid-2';
      mockPrismaTenant.findUnique.mockResolvedValue(makeInstagramTenant() as never);
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-multi' } });

      // Act
      await adapter.sendText(tenantId, to, 'Msg tenant 1');
      await adapter.sendText(tenantId2, to, 'Msg tenant 2');

      // Assert - findUnique chamado 2x com tenantIds distintos
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaTenant.findUnique).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { id: tenantId } })
      );
      expect(mockPrismaTenant.findUnique).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { id: tenantId2 } })
      );
    });
  });

  // -----------------------------------------------
  // sendText
  // -----------------------------------------------

  describe('sendText', () => {
    it('deve chamar Graph API POST /me/messages com recipient e text corretos', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-text-001' } });

      // Act
      await adapter.sendText(tenantId, to, 'Ola pelo Instagram!');

      // Assert
      expect(mockAxiosPost).toHaveBeenCalledWith('/me/messages', {
        recipient: { id: to },
        message: { text: 'Ola pelo Instagram!' },
      });
    });

    it('deve retornar SendResult com externalMessageId e success=true', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-text-002' } });

      // Act
      const result = await adapter.sendText(tenantId, to, 'Mensagem de teste');

      // Assert
      expect(result).toEqual<SendResult>({
        externalMessageId: 'ig-text-002',
        success: true,
      });
    });

    it('deve retornar externalMessageId vazio quando Graph API nao retorna message_id', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: {} });

      // Act
      const result = await adapter.sendText(tenantId, to, 'Mensagem');

      // Assert
      expect(result.externalMessageId).toBe('');
      expect(result.success).toBe(true);
    });

    it('deve lancar InternalServerError quando Graph API falha', async () => {
      // Arrange
      mockAxiosPost.mockRejectedValue(new Error('Connection refused'));

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Mensagem')
      ).rejects.toThrow(InternalServerError);
    });

    it('deve incluir mensagem de erro original ao lancar InternalServerError', async () => {
      // Arrange
      mockAxiosPost.mockRejectedValue(new Error('503 Service Unavailable'));

      // Act & Assert
      await expect(
        adapter.sendText(tenantId, to, 'Mensagem')
      ).rejects.toThrow('Falha ao enviar mensagem Instagram: 503 Service Unavailable');
    });
  });

  // -----------------------------------------------
  // sendMedia
  // -----------------------------------------------

  describe('sendMedia', () => {
    it('deve enviar imagem como attachment nativo via Graph API', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-img-001' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - imagem enviada nativamente
      expect(mockAxiosPost).toHaveBeenCalledWith('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'image',
            payload: { url: media.url },
          },
        },
      });
    });

    it('deve enviar caption como mensagem de texto separada apos imagem', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        caption: 'Foto do quarto deluxe',
      };
      mockAxiosPost
        .mockResolvedValueOnce({ data: { message_id: 'ig-img-002' } })
        .mockResolvedValueOnce({ data: { message_id: 'ig-caption-002' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - duas chamadas: imagem + caption
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
      const captionCallBody = mockAxiosPost.mock.calls[1]?.[1] as {
        message?: { text?: string };
      } | undefined;
      expect(captionCallBody?.message?.text).toBe('Foto do quarto deluxe');
    });

    it('deve enviar apenas imagem quando caption e ausente', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-img-003' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - apenas 1 chamada POST
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('deve degradar VIDEO para texto+link (Instagram nao suporta video por URL)', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'video',
        url: 'https://example.com/video.mp4',
        caption: 'Video tour do hotel',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-video-degraded' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - deve enviar como texto (nao como attachment)
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { text?: string; attachment?: unknown };
      } | undefined;
      expect(postedBody?.message?.attachment).toBeUndefined();
      expect(postedBody?.message?.text).toContain('https://example.com/video.mp4');
    });

    it('deve incluir caption junto com URL ao degradar VIDEO para texto', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'video',
        url: 'https://example.com/video.mp4',
        caption: 'Tour virtual do quarto',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-video-caption' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - caption + URL no mesmo texto (caption\nURL)
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { text?: string };
      } | undefined;
      const sentText = postedBody?.message?.text ?? '';
      expect(sentText).toContain('Tour virtual do quarto');
      expect(sentText).toContain('https://example.com/video.mp4');
    });

    it('deve degradar AUDIO para texto com URL apenas quando caption esta ausente', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'audio',
        url: 'https://example.com/audio.mp3',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-audio-degraded' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert - URL enviada como texto puro
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { text?: string };
      } | undefined;
      expect(postedBody?.message?.text).toBe('https://example.com/audio.mp3');
    });

    it('deve degradar DOCUMENT para texto+link com caption', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'document',
        url: 'https://example.com/reserva.pdf',
        caption: 'Contrato de reserva',
      };
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-doc-degraded' } });

      // Act
      await adapter.sendMedia(tenantId, to, media);

      // Assert
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { text?: string };
      } | undefined;
      const sentText = postedBody?.message?.text ?? '';
      expect(sentText).toContain('Contrato de reserva');
      expect(sentText).toContain('https://example.com/reserva.pdf');
    });

    it('deve retornar externalMessageId da primeira chamada ao enviar imagem com caption', async () => {
      // Arrange
      const media: MediaPayload = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        caption: 'Foto',
      };
      mockAxiosPost
        .mockResolvedValueOnce({ data: { message_id: 'ig-primary-id' } })
        .mockResolvedValueOnce({ data: { message_id: 'ig-caption-id' } });

      // Act
      const result = await adapter.sendMedia(tenantId, to, media);

      // Assert - ID e da mensagem de midia, nao da caption
      expect(result.externalMessageId).toBe('ig-primary-id');
      expect(result.success).toBe(true);
    });

    it('deve lancar InternalServerError quando upload de imagem falha', async () => {
      // Arrange
      const media = makeMediaPayload('image');
      mockAxiosPost.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(
        adapter.sendMedia(tenantId, to, media)
      ).rejects.toThrow(InternalServerError);

      await expect(
        new InstagramAdapter().sendMedia(tenantId, to, media)
      ).rejects.toThrow('Falha ao enviar mídia Instagram');
    });
  });

  // -----------------------------------------------
  // sendButtons - Button Template com fallback para texto
  // -----------------------------------------------

  describe('sendButtons - Button Template com fallback', () => {
    const buttons = makeButtons();

    it('deve enviar Button Template quando API aceita', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-btn-template-001' } });

      // Act
      const result = await adapter.sendButtons(tenantId, to, 'Escolha uma opcao:', buttons);

      // Assert - enviado como template com attachment
      expect(result.success).toBe(true);
      expect(result.externalMessageId).toBe('ig-btn-template-001');
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as {
        message?: { attachment?: { type: string; payload: { template_type: string; buttons: unknown[] } } };
      } | undefined;
      expect(postedBody?.message?.attachment?.type).toBe('template');
      expect(postedBody?.message?.attachment?.payload?.template_type).toBe('button');
    });

    it('deve mapear botoes com URL como web_url e sem URL como postback', async () => {
      // Arrange
      const urlButtons: ButtonPayload[] = [
        { id: 'btn1', title: 'Site', url: 'https://example.com' },
        { id: 'btn2', title: 'Menu' },
      ];
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-btn-mixed' } });

      // Act
      await adapter.sendButtons(tenantId, to, 'Opcoes:', urlButtons);

      // Assert
      const postedBody = mockAxiosPost.mock.calls[0]?.[1] as any;
      const btns = postedBody?.message?.attachment?.payload?.buttons;
      expect(btns[0].type).toBe('web_url');
      expect(btns[0].url).toBe('https://example.com');
      expect(btns[1].type).toBe('postback');
      expect(btns[1].payload).toBe('btn2');
    });

    it('deve fazer fallback para texto numerado quando Button Template falha', async () => {
      // Arrange - primeiro call falha (Button Template), segundo sucede (sendText fallback)
      mockAxiosPost
        .mockRejectedValueOnce(new Error('Template not supported'))
        .mockResolvedValueOnce({ data: { message_id: 'ig-fallback-text' } });

      // Act
      const result = await adapter.sendButtons(tenantId, to, 'Escolha:', buttons);

      // Assert - fallback para texto
      expect(result.success).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);
      const fallbackBody = mockAxiosPost.mock.calls[1]?.[1] as { message?: { text?: string } } | undefined;
      expect(fallbackBody?.message?.text).toContain('1. Opcao 1');
      expect(fallbackBody?.message?.text).toContain('2. Opcao 2');
    });

    it('deve retornar SendResult com success=true', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-btn-success' } });

      // Act
      const result = await adapter.sendButtons(tenantId, to, 'Texto:', buttons);

      // Assert
      expect(result.success).toBe(true);
      expect(result.externalMessageId).toBe('ig-btn-success');
    });

    it('deve aceitar headerText e footerText sem erro', async () => {
      // Arrange
      mockAxiosPost.mockResolvedValue({ data: { message_id: 'ig-btn-noheader' } });

      // Act - nao deve lancar erro com header/footer
      await expect(
        adapter.sendButtons(tenantId, to, 'Texto:', buttons, 'Header', 'Footer')
      ).resolves.toBeDefined();
    });
  });

  // -----------------------------------------------
  // Interface de canal - metodos opcionais ausentes
  // -----------------------------------------------

  describe('interface de canal - metodos opcionais', () => {
    it('deve ter channel igual a INSTAGRAM', () => {
      expect(adapter.channel).toBe('INSTAGRAM');
    });

    it('nao deve implementar sendList (Instagram nao tem lista nativa)', () => {
      expect((adapter as unknown as Record<string, unknown>)['sendList']).toBeUndefined();
    });

    it('nao deve implementar sendTemplate (Instagram nao tem templates)', () => {
      expect((adapter as unknown as Record<string, unknown>)['sendTemplate']).toBeUndefined();
    });

    it('nao deve implementar markAsRead (Instagram nao suporta)', () => {
      expect((adapter as unknown as Record<string, unknown>)['markAsRead']).toBeUndefined();
    });
  });
});
