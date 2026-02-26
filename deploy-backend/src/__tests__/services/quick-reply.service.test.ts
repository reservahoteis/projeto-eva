/**
 * Testes para QuickReplyService
 *
 * TDD: RED -> GREEN -> REFACTOR
 *
 * Cobre:
 *  - Isolamento multi-tenant (CRITICO) em todos os metodos
 *  - CRUD completo: list, get, create, update, delete
 *  - Filtros: search (OR title/shortcut/content), category, isActive
 *  - Unicidade de shortcut por tenant (create e update)
 *  - Erros corretos: NotFoundError, BadRequestError
 *
 * ATENCAO: jest.config.js usa resetMocks: true.
 * Todas as implementacoes de mock sao re-aplicadas em beforeEach via setupMocks().
 */

import { QuickReplyService } from '@/services/quick-reply.service';
import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';

// --------------------------------------------------------------------------
// Alias tipado para o mock do prisma.quickReply
// --------------------------------------------------------------------------
const mockPrismaQR = prisma.quickReply as jest.Mocked<typeof prisma.quickReply>;
const mockPrismaTransaction = prisma.$transaction as jest.Mock;

// --------------------------------------------------------------------------
// Helper: acessa mock.calls[n][0] de forma segura para o compilador TS.
// O array de chamadas pode ser undefined em tempo de tipos, mas no contexto
// de teste sempre existira apos a chamada ter ocorrido.
// --------------------------------------------------------------------------
function getCallArg(mock: jest.Mock, callIndex: number): any {
  return (mock.mock.calls[callIndex] as any[])[0];
}

// --------------------------------------------------------------------------
// Constantes de tenant
// --------------------------------------------------------------------------
const TENANT_ID = 'tenant-uuid-123';
const OTHER_TENANT_ID = 'other-tenant-uuid-456';

// --------------------------------------------------------------------------
// Factories
// --------------------------------------------------------------------------

/**
 * Constroi um objeto QuickReply completo com valores padrao razoaveis.
 * Overrides permitem sobrescrever qualquer campo.
 */
function buildQuickReply(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qr-uuid-1',
    tenantId: TENANT_ID,
    title: 'Check-in e Check-out',
    shortcut: 'checkin',
    content: 'Check-in a partir das 15h e check-out ate as 12h.',
    category: 'Informacoes',
    order: 1,
    isActive: true,
    createdById: null,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Constroi um objeto QuickReply no formato retornado pelo select de listQuickReplies
 * e getQuickReplyById (com relacao createdBy expandida).
 */
function buildQuickReplyWithCreatedBy(overrides: Record<string, unknown> = {}) {
  return {
    ...buildQuickReply(overrides),
    createdBy: null,
  };
}

/**
 * Constroi o objeto minimo retornado por selects de verificacao de existencia
 * (apenas id e opcionalmente shortcut).
 */
function buildExistingStub(overrides: Record<string, unknown> = {}) {
  return { id: 'qr-uuid-1', shortcut: 'checkin', ...overrides };
}

// --------------------------------------------------------------------------
// Configuracao de mocks (resetMocks: true exige re-setup em beforeEach)
// --------------------------------------------------------------------------

/**
 * Re-aplica as implementacoes padrao dos mocks antes de cada teste.
 * Como resetMocks: true apaga tudo entre testes, esta funcao e obrigatoria.
 */
function setupMocks() {
  (mockPrismaQR.findMany as jest.Mock).mockResolvedValue([buildQuickReplyWithCreatedBy()]);
  (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(buildQuickReplyWithCreatedBy());
  (mockPrismaQR.create as jest.Mock).mockResolvedValue(buildQuickReply());
  (mockPrismaQR.update as jest.Mock).mockResolvedValue(buildQuickReply());
  (mockPrismaQR.delete as jest.Mock).mockResolvedValue(buildQuickReply());
  (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
  // $transaction: executa callback com o mesmo prisma mockado
  mockPrismaTransaction.mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) =>
    callback(prisma)
  );
}

// --------------------------------------------------------------------------
// Suite principal
// --------------------------------------------------------------------------

describe('QuickReplyService', () => {
  let service: QuickReplyService;

  beforeEach(() => {
    service = new QuickReplyService();
    setupMocks();
  });

  // ========================================================================
  // listQuickReplies
  // ========================================================================

  describe('listQuickReplies', () => {
    // ----------------------------------------------------------------------
    // Multi-Tenant Isolation (CRITICO)
    // ----------------------------------------------------------------------

    describe('Multi-Tenant Isolation', () => {
      it('inclui tenantId na clausula where', async () => {
        await service.listQuickReplies(TENANT_ID);

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: TENANT_ID }),
          })
        );
      });

      it('nao vaza dados de outro tenant: usa o tenantId recebido como parametro', async () => {
        (mockPrismaQR.findMany as jest.Mock)
          .mockResolvedValueOnce([buildQuickReplyWithCreatedBy({ tenantId: TENANT_ID })])
          .mockResolvedValueOnce([buildQuickReplyWithCreatedBy({ tenantId: OTHER_TENANT_ID })]);

        await service.listQuickReplies(TENANT_ID);
        await service.listQuickReplies(OTHER_TENANT_ID);

        expect(getCallArg(mockPrismaQR.findMany as jest.Mock, 0).where.tenantId).toBe(TENANT_ID);
        expect(getCallArg(mockPrismaQR.findMany as jest.Mock, 1).where.tenantId).toBe(OTHER_TENANT_ID);
      });
    });

    // ----------------------------------------------------------------------
    // Ordenacao
    // ----------------------------------------------------------------------

    describe('Ordenacao', () => {
      it('ordena por category asc, order asc, title asc', async () => {
        await service.listQuickReplies(TENANT_ID);

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ category: 'asc' }, { order: 'asc' }, { title: 'asc' }],
          })
        );
      });
    });

    // ----------------------------------------------------------------------
    // Sem parametros de filtro
    // ----------------------------------------------------------------------

    describe('Sem parametros de filtro', () => {
      it('retorna lista com o que o banco retorna', async () => {
        const fakeList = [
          buildQuickReplyWithCreatedBy({ id: 'qr-1', title: 'A' }),
          buildQuickReplyWithCreatedBy({ id: 'qr-2', title: 'B' }),
        ];
        (mockPrismaQR.findMany as jest.Mock).mockResolvedValue(fakeList);

        const result = await service.listQuickReplies(TENANT_ID);

        expect(result).toHaveLength(2);
        expect(result).toEqual(fakeList);
      });

      it('retorna lista vazia quando nao ha quick replies', async () => {
        (mockPrismaQR.findMany as jest.Mock).mockResolvedValue([]);

        const result = await service.listQuickReplies(TENANT_ID);

        expect(result).toEqual([]);
      });

      it('nao aplica filtro OR de search quando search e undefined', async () => {
        await service.listQuickReplies(TENANT_ID, { search: undefined });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where).not.toHaveProperty('OR');
      });
    });

    // ----------------------------------------------------------------------
    // Filtro: search
    // ----------------------------------------------------------------------

    describe('Filtro de busca (search)', () => {
      it('aplica OR em title, shortcut e content ao buscar', async () => {
        await service.listQuickReplies(TENANT_ID, { search: 'checkin' });

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenantId: TENANT_ID,
              OR: [
                { title: { contains: 'checkin', mode: 'insensitive' } },
                { shortcut: { contains: 'checkin', mode: 'insensitive' } },
                { content: { contains: 'checkin', mode: 'insensitive' } },
              ],
            }),
          })
        );
      });

      it('busca e case-insensitive (mode insensitive em todos os campos OR)', async () => {
        await service.listQuickReplies(TENANT_ID, { search: 'CHECK-IN' });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        const orClauses = callArg.where.OR as Array<Record<string, unknown>>;
        expect(orClauses).toEqual([
          { title: { contains: 'CHECK-IN', mode: 'insensitive' } },
          { shortcut: { contains: 'CHECK-IN', mode: 'insensitive' } },
          { content: { contains: 'CHECK-IN', mode: 'insensitive' } },
        ]);
      });

      it('nao inclui OR quando search e string vazia', async () => {
        await service.listQuickReplies(TENANT_ID, { search: '' });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where).not.toHaveProperty('OR');
      });

      it('combina search com tenantId no where', async () => {
        await service.listQuickReplies(TENANT_ID, { search: 'cafe' });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where.tenantId).toBe(TENANT_ID);
        expect(callArg.where.OR).toBeDefined();
      });
    });

    // ----------------------------------------------------------------------
    // Filtro: category
    // ----------------------------------------------------------------------

    describe('Filtro por category', () => {
      it('inclui category no where quando fornecida', async () => {
        await service.listQuickReplies(TENANT_ID, { category: 'Vendas' });

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenantId: TENANT_ID,
              category: 'Vendas',
            }),
          })
        );
      });

      it('nao inclui category no where quando nao fornecida', async () => {
        await service.listQuickReplies(TENANT_ID, {});

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where).not.toHaveProperty('category');
      });

      it('combina category com tenantId', async () => {
        await service.listQuickReplies(TENANT_ID, { category: 'Politicas' });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where).toEqual(
          expect.objectContaining({ tenantId: TENANT_ID, category: 'Politicas' })
        );
      });
    });

    // ----------------------------------------------------------------------
    // Filtro: isActive
    // ----------------------------------------------------------------------

    describe('Filtro por isActive', () => {
      it('filtra apenas registros ativos quando isActive e "true"', async () => {
        await service.listQuickReplies(TENANT_ID, { isActive: 'true' });

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: TENANT_ID, isActive: true }),
          })
        );
      });

      it('filtra apenas registros inativos quando isActive e "false"', async () => {
        await service.listQuickReplies(TENANT_ID, { isActive: 'false' });

        expect(mockPrismaQR.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: TENANT_ID, isActive: false }),
          })
        );
      });

      it('nao inclui isActive no where quando nao fornecido', async () => {
        await service.listQuickReplies(TENANT_ID, {});

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where).not.toHaveProperty('isActive');
      });
    });

    // ----------------------------------------------------------------------
    // Combinacao de filtros
    // ----------------------------------------------------------------------

    describe('Combinacao de filtros', () => {
      it('combina search + category + isActive no mesmo where', async () => {
        await service.listQuickReplies(TENANT_ID, {
          search: 'reserva',
          category: 'Vendas',
          isActive: 'true',
        });

        const callArg = getCallArg(mockPrismaQR.findMany as jest.Mock, 0);
        expect(callArg.where.tenantId).toBe(TENANT_ID);
        expect(callArg.where.category).toBe('Vendas');
        expect(callArg.where.isActive).toBe(true);
        expect(callArg.where.OR).toBeDefined();
      });
    });
  });

  // ========================================================================
  // getQuickReplyById
  // ========================================================================

  describe('getQuickReplyById', () => {
    // ----------------------------------------------------------------------
    // Multi-Tenant Isolation (CRITICO)
    // ----------------------------------------------------------------------

    describe('Multi-Tenant Isolation', () => {
      it('inclui id E tenantId na clausula where', async () => {
        const qrId = 'qr-uuid-1';

        await service.getQuickReplyById(qrId, TENANT_ID);

        expect(mockPrismaQR.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: qrId, tenantId: TENANT_ID },
          })
        );
      });

      it('lanca NotFoundError quando registro existe mas pertence a outro tenant', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.getQuickReplyById('qr-uuid-1', OTHER_TENANT_ID)
        ).rejects.toThrow(NotFoundError);
      });

      it('nao busca por id global sem tenantId', async () => {
        const qrId = 'qr-uuid-1';
        await service.getQuickReplyById(qrId, TENANT_ID).catch(() => {});

        const callArg = getCallArg(mockPrismaQR.findFirst as jest.Mock, 0);
        expect(callArg.where).toHaveProperty('tenantId');
      });
    });

    // ----------------------------------------------------------------------
    // Retorno correto
    // ----------------------------------------------------------------------

    describe('Retorno', () => {
      it('retorna o registro encontrado pelo banco', async () => {
        const expected = buildQuickReplyWithCreatedBy({ id: 'qr-uuid-specific' });
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(expected);

        const result = await service.getQuickReplyById('qr-uuid-specific', TENANT_ID);

        expect(result).toEqual(expected);
      });

      it('inclui relacao createdBy no select', async () => {
        await service.getQuickReplyById('qr-uuid-1', TENANT_ID);

        const callArg = getCallArg(mockPrismaQR.findFirst as jest.Mock, 0);
        expect(callArg.select).toHaveProperty('createdBy');
      });
    });

    // ----------------------------------------------------------------------
    // NotFoundError
    // ----------------------------------------------------------------------

    describe('NotFoundError', () => {
      it('lanca NotFoundError quando quick reply nao existe', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.getQuickReplyById('non-existent-id', TENANT_ID)
        ).rejects.toThrow(NotFoundError);
      });

      it('mensagem de erro e "Quick reply nao encontrada"', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.getQuickReplyById('non-existent-id', TENANT_ID)
        ).rejects.toThrow('Quick reply nao encontrada');
      });

      it('nao chama outros metodos do prisma apos nao encontrar', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await service.getQuickReplyById('ghost', TENANT_ID).catch(() => {});

        expect(mockPrismaQR.create).not.toHaveBeenCalled();
        expect(mockPrismaQR.update).not.toHaveBeenCalled();
        expect(mockPrismaQR.delete).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // createQuickReply
  // ========================================================================

  describe('createQuickReply', () => {
    const validInput = {
      title: 'Horario de Check-in',
      shortcut: 'checkin',
      content: 'O check-in e a partir das 15h.',
      category: 'Informacoes',
      order: 0,
    };

    // ----------------------------------------------------------------------
    // Multi-Tenant Isolation (CRITICO)
    // ----------------------------------------------------------------------

    describe('Multi-Tenant Isolation', () => {
      it('verifica unicidade de shortcut DENTRO do tenant correto', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await service.createQuickReply(TENANT_ID, validInput);

        expect(mockPrismaQR.findFirst).toHaveBeenCalledWith({
          where: { tenantId: TENANT_ID, shortcut: validInput.shortcut },
          select: { id: true },
        });
      });

      it('inclui tenantId nos dados de criacao', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);
        (mockPrismaQR.create as jest.Mock).mockResolvedValue(buildQuickReply());

        await service.createQuickReply(TENANT_ID, validInput);

        expect(mockPrismaQR.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ tenantId: TENANT_ID }),
          })
        );
      });

      it('permite o mesmo shortcut em tenants diferentes', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        (mockPrismaQR.create as jest.Mock)
          .mockResolvedValueOnce(buildQuickReply({ tenantId: TENANT_ID }))
          .mockResolvedValueOnce(buildQuickReply({ tenantId: OTHER_TENANT_ID }));

        await expect(
          service.createQuickReply(TENANT_ID, validInput)
        ).resolves.toBeDefined();
        await expect(
          service.createQuickReply(OTHER_TENANT_ID, validInput)
        ).resolves.toBeDefined();
      });
    });

    // ----------------------------------------------------------------------
    // Criacao bem-sucedida
    // ----------------------------------------------------------------------

    describe('Criacao bem-sucedida', () => {
      beforeEach(() => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);
      });

      it('retorna o registro criado pelo banco', async () => {
        const created = buildQuickReply({ id: 'new-qr-id', ...validInput });
        (mockPrismaQR.create as jest.Mock).mockResolvedValue(created);

        const result = await service.createQuickReply(TENANT_ID, validInput);

        expect(result).toEqual(created);
      });

      it('salva todos os campos fornecidos na criacao', async () => {
        await service.createQuickReply(TENANT_ID, validInput);

        expect(mockPrismaQR.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              title: validInput.title,
              shortcut: validInput.shortcut,
              content: validInput.content,
              category: validInput.category,
              order: validInput.order,
            }),
          })
        );
      });

      it('usa order 0 como padrao quando order nao e fornecido', async () => {
        const inputSemOrder = {
          title: 'Titulo',
          shortcut: 'novo-atalho',
          content: 'Conteudo qualquer',
        };

        await service.createQuickReply(TENANT_ID, inputSemOrder);

        const callArg = getCallArg(mockPrismaQR.create as jest.Mock, 0);
        expect(callArg.data.order).toBe(0);
      });

      it('inclui createdById quando fornecido', async () => {
        const userId = 'user-uuid-abc';

        await service.createQuickReply(TENANT_ID, validInput, userId);

        expect(mockPrismaQR.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ createdById: userId }),
          })
        );
      });

      it('nao inclui createdById quando nao fornecido', async () => {
        await service.createQuickReply(TENANT_ID, validInput);

        const callArg = getCallArg(mockPrismaQR.create as jest.Mock, 0);
        expect(callArg.data).not.toHaveProperty('createdById');
      });

      it('primeiro verifica existencia e depois cria (ordem das chamadas)', async () => {
        const callOrder: string[] = [];

        (mockPrismaQR.findFirst as jest.Mock).mockImplementation((() => {
          callOrder.push('findFirst');
          return Promise.resolve(null);
        }) as any);

        (mockPrismaQR.create as jest.Mock).mockImplementation((() => {
          callOrder.push('create');
          return Promise.resolve(buildQuickReply());
        }) as any);

        await service.createQuickReply(TENANT_ID, validInput);

        expect(callOrder).toEqual(['findFirst', 'create']);
      });
    });

    // ----------------------------------------------------------------------
    // BadRequestError: shortcut duplicado
    // ----------------------------------------------------------------------

    describe('BadRequestError por shortcut duplicado', () => {
      it('lanca BadRequestError quando shortcut ja existe no tenant', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(buildExistingStub());

        await expect(
          service.createQuickReply(TENANT_ID, validInput)
        ).rejects.toThrow(BadRequestError);
      });

      it('mensagem de erro e "Ja existe uma quick reply com este atalho"', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(buildExistingStub());

        await expect(
          service.createQuickReply(TENANT_ID, validInput)
        ).rejects.toThrow('Ja existe uma quick reply com este atalho');
      });

      it('nao chama create quando shortcut ja existe', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(buildExistingStub());

        await service.createQuickReply(TENANT_ID, validInput).catch(() => {});

        expect(mockPrismaQR.create).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // updateQuickReply
  // ========================================================================

  describe('updateQuickReply', () => {
    const QR_ID = 'qr-uuid-1';

    // ----------------------------------------------------------------------
    // Multi-Tenant Isolation (CRITICO)
    // ----------------------------------------------------------------------

    describe('Multi-Tenant Isolation', () => {
      it('verifica que o registro pertence ao tenant antes de atualizar (dentro de $transaction)', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValueOnce(buildExistingStub());

        await service.updateQuickReply(QR_ID, TENANT_ID, { title: 'Novo titulo' });

        expect(mockPrismaTransaction).toHaveBeenCalled();
        expect(mockPrismaQR.findFirst).toHaveBeenCalledWith({
          where: { id: QR_ID, tenantId: TENANT_ID },
          select: { id: true, shortcut: true },
        });
      });

      it('nao atualiza quando registro existe mas pertence a outro tenant', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await service.updateQuickReply(QR_ID, OTHER_TENANT_ID, { title: 'Novo' }).catch(() => {});

        expect(mockPrismaQR.update).not.toHaveBeenCalled();
      });

      it('verifica unicidade de shortcut dentro do tenant correto ao mudar shortcut', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(buildExistingStub({ shortcut: 'antigo' }))
          .mockResolvedValueOnce(null);

        await service.updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'novo-atalho' });

        const secondCallArg = getCallArg(mockPrismaQR.findFirst as jest.Mock, 1);
        expect(secondCallArg.where.tenantId).toBe(TENANT_ID);
      });
    });

    // ----------------------------------------------------------------------
    // Atualizacao de campos (patch semantico)
    // ----------------------------------------------------------------------

    describe('Atualizacao de campos', () => {
      beforeEach(() => {
        // Registro existente com shortcut 'checkin'
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(
          buildExistingStub({ shortcut: 'checkin' })
        );
      });

      it('atualiza apenas o title quando somente title e fornecido', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, { title: 'Novo titulo' });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: QR_ID },
            data: { title: 'Novo titulo' },
          })
        );
      });

      it('atualiza apenas o content quando somente content e fornecido', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, { content: 'Novo conteudo.' });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { content: 'Novo conteudo.' },
          })
        );
      });

      it('atualiza apenas o category quando somente category e fornecido', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, { category: 'Vendas' });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { category: 'Vendas' },
          })
        );
      });

      it('atualiza apenas o order quando somente order e fornecido', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, { order: 5 });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { order: 5 },
          })
        );
      });

      it('atualiza apenas isActive quando somente isActive e fornecido', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, { isActive: false });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { isActive: false },
          })
        );
      });

      it('atualiza multiplos campos simultaneamente', async () => {
        await service.updateQuickReply(QR_ID, TENANT_ID, {
          title: 'Atualizado',
          content: 'Conteudo novo',
          isActive: false,
          order: 3,
        });

        expect(mockPrismaQR.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              title: 'Atualizado',
              content: 'Conteudo novo',
              isActive: false,
              order: 3,
            },
          })
        );
      });

      it('retorna o registro atualizado pelo banco', async () => {
        const updated = buildQuickReply({ title: 'Atualizado' });
        (mockPrismaQR.update as jest.Mock).mockResolvedValue(updated);

        const result = await service.updateQuickReply(QR_ID, TENANT_ID, { title: 'Atualizado' });

        expect(result).toEqual(updated);
      });
    });

    // ----------------------------------------------------------------------
    // Mudanca de shortcut: verificacao de unicidade
    // ----------------------------------------------------------------------

    describe('Mudanca de shortcut', () => {
      it('verifica unicidade do novo shortcut excluindo o proprio registro (id: { not })', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(buildExistingStub({ id: QR_ID, shortcut: 'antigo' }))
          .mockResolvedValueOnce(null);

        await service.updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'novo-atalho' });

        expect(mockPrismaQR.findFirst).toHaveBeenNthCalledWith(2, {
          where: {
            tenantId: TENANT_ID,
            shortcut: 'novo-atalho',
            id: { not: QR_ID },
          },
          select: { id: true },
        });
      });

      it('permite manter o mesmo shortcut sem gerar erro de duplicidade', async () => {
        // O shortcut nao muda: servico nao deve executar segunda verificacao de uniqueness
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(
          buildExistingStub({ id: QR_ID, shortcut: 'checkin' })
        );

        await expect(
          service.updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'checkin' })
        ).resolves.toBeDefined();

        // Apenas 1 findFirst (verificacao de existencia), sem segunda chamada de uniqueness
        expect(mockPrismaQR.findFirst).toHaveBeenCalledTimes(1);
      });

      it('lanca BadRequestError quando novo shortcut ja existe em outro registro do mesmo tenant', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(buildExistingStub({ id: QR_ID, shortcut: 'antigo' }))
          .mockResolvedValueOnce(buildExistingStub({ id: 'outro-qr-uuid' }));

        await expect(
          service.updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'atalho-em-uso' })
        ).rejects.toThrow(BadRequestError);
      });

      it('mensagem de erro de shortcut duplicado no update e correta', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(buildExistingStub({ id: QR_ID, shortcut: 'antigo' }))
          .mockResolvedValueOnce(buildExistingStub({ id: 'outro-qr-uuid' }));

        await expect(
          service.updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'atalho-em-uso' })
        ).rejects.toThrow('Ja existe uma quick reply com este atalho');
      });

      it('nao chama update quando novo shortcut esta em conflito', async () => {
        (mockPrismaQR.findFirst as jest.Mock)
          .mockResolvedValueOnce(buildExistingStub({ id: QR_ID, shortcut: 'antigo' }))
          .mockResolvedValueOnce(buildExistingStub({ id: 'outro-qr-uuid' }));

        await service
          .updateQuickReply(QR_ID, TENANT_ID, { shortcut: 'atalho-em-uso' })
          .catch(() => {});

        expect(mockPrismaQR.update).not.toHaveBeenCalled();
      });
    });

    // ----------------------------------------------------------------------
    // NotFoundError
    // ----------------------------------------------------------------------

    describe('NotFoundError', () => {
      it('lanca NotFoundError quando quick reply nao existe', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.updateQuickReply('id-inexistente', TENANT_ID, { title: 'X' })
        ).rejects.toThrow(NotFoundError);
      });

      it('mensagem de erro e "Quick reply nao encontrada"', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          service.updateQuickReply('id-inexistente', TENANT_ID, { title: 'X' })
        ).rejects.toThrow('Quick reply nao encontrada');
      });

      it('nao chama update quando registro nao e encontrado', async () => {
        (mockPrismaQR.findFirst as jest.Mock).mockResolvedValue(null);

        await service
          .updateQuickReply('id-inexistente', TENANT_ID, { title: 'X' })
          .catch(() => {});

        expect(mockPrismaQR.update).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // deleteQuickReply
  // ========================================================================

  describe('deleteQuickReply', () => {
    const QR_ID = 'qr-uuid-1';

    // ----------------------------------------------------------------------
    // Multi-Tenant Isolation (CRITICO)
    // ----------------------------------------------------------------------

    describe('Multi-Tenant Isolation', () => {
      it('inclui id E tenantId na clausula where do deleteMany', async () => {
        await service.deleteQuickReply(QR_ID, TENANT_ID);

        expect(mockPrismaQR.deleteMany).toHaveBeenCalledWith({
          where: { id: QR_ID, tenantId: TENANT_ID },
        });
      });

      it('nao deleta registro de outro tenant (deleteMany retorna count 0)', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

        await expect(
          service.deleteQuickReply(QR_ID, OTHER_TENANT_ID)
        ).rejects.toThrow(NotFoundError);
      });
    });

    // ----------------------------------------------------------------------
    // Exclusao bem-sucedida
    // ----------------------------------------------------------------------

    describe('Exclusao bem-sucedida', () => {
      it('chama deleteMany com id e tenantId', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

        await service.deleteQuickReply(QR_ID, TENANT_ID);

        expect(mockPrismaQR.deleteMany).toHaveBeenCalledWith({
          where: { id: QR_ID, tenantId: TENANT_ID },
        });
      });

      it('retorna undefined (void) apos exclusao', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

        const result = await service.deleteQuickReply(QR_ID, TENANT_ID);

        expect(result).toBeUndefined();
      });

      it('usa operacao atomica deleteMany (sem TOCTOU)', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

        await service.deleteQuickReply(QR_ID, TENANT_ID);

        // deleteMany e atomico: nao precisa de findFirst separado
        expect(mockPrismaQR.findFirst).not.toHaveBeenCalled();
        expect(mockPrismaQR.delete).not.toHaveBeenCalled();
        expect(mockPrismaQR.deleteMany).toHaveBeenCalledTimes(1);
      });
    });

    // ----------------------------------------------------------------------
    // NotFoundError
    // ----------------------------------------------------------------------

    describe('NotFoundError', () => {
      it('lanca NotFoundError quando quick reply nao existe (count === 0)', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

        await expect(
          service.deleteQuickReply('id-inexistente', TENANT_ID)
        ).rejects.toThrow(NotFoundError);
      });

      it('mensagem de erro e "Quick reply nao encontrada"', async () => {
        (mockPrismaQR.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

        await expect(
          service.deleteQuickReply('id-inexistente', TENANT_ID)
        ).rejects.toThrow('Quick reply nao encontrada');
      });
    });
  });

  // ========================================================================
  // Contrato da instancia exportada
  // ========================================================================

  describe('Instancia exportada', () => {
    it('quickReplyService exportado e uma instancia de QuickReplyService', async () => {
      const { quickReplyService } = await import('@/services/quick-reply.service');
      expect(quickReplyService).toBeInstanceOf(QuickReplyService);
    });
  });
});
