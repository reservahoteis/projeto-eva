import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import logger from '@/config/logger';
import type { CreateQuickReplyInput, UpdateQuickReplyBody } from '@/validators/quick-reply.validator';

export class QuickReplyService {
  /**
   * Listar quick replies do tenant
   */
  async listQuickReplies(
    tenantId: string,
    params?: {
      search?: string;
      category?: string;
      isActive?: 'true' | 'false';
    }
  ) {
    const where: {
      tenantId: string;
      isActive?: boolean;
      category?: string;
      OR?: Array<{
        title?: { contains: string; mode: 'insensitive' };
        shortcut?: { contains: string; mode: 'insensitive' };
        content?: { contains: string; mode: 'insensitive' };
      }>;
    } = { tenantId };

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive === 'true';
    }

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { shortcut: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const quickReplies = await prisma.quickReply.findMany({
      where,
      orderBy: [{ category: 'asc' }, { order: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        shortcut: true,
        content: true,
        category: true,
        order: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return quickReplies;
  }

  /**
   * Buscar quick reply por ID
   */
  async getQuickReplyById(id: string, tenantId: string) {
    const quickReply = await prisma.quickReply.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        title: true,
        shortcut: true,
        content: true,
        category: true,
        order: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!quickReply) {
      throw new NotFoundError('Quick reply nao encontrada');
    }

    return quickReply;
  }

  /**
   * Criar quick reply
   */
  async createQuickReply(tenantId: string, data: CreateQuickReplyInput, createdById?: string) {
    const quickReply = await prisma.$transaction(async (tx) => {
      const existing = await tx.quickReply.findFirst({
        where: { tenantId, shortcut: data.shortcut },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestError('Ja existe uma quick reply com este atalho');
      }

      return tx.quickReply.create({
        data: {
          tenantId,
          title: data.title,
          shortcut: data.shortcut,
          content: data.content,
          category: data.category,
          order: data.order ?? 0,
          ...(createdById && { createdById }),
        },
        select: {
          id: true,
          title: true,
          shortcut: true,
          content: true,
          category: true,
          order: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    logger.info({ quickReplyId: quickReply.id, tenantId, shortcut: quickReply.shortcut }, 'QuickReply created');

    return quickReply;
  }

  /**
   * Atualizar quick reply
   */
  async updateQuickReply(id: string, tenantId: string, data: UpdateQuickReplyBody) {
    const quickReply = await prisma.$transaction(async (tx) => {
      const existing = await tx.quickReply.findFirst({
        where: { id, tenantId },
        select: { id: true, shortcut: true },
      });

      if (!existing) {
        throw new NotFoundError('Quick reply nao encontrada');
      }

      // Se esta alterando atalho, verificar duplicidade no tenant
      if (data.shortcut && data.shortcut !== existing.shortcut) {
        const shortcutExists = await tx.quickReply.findFirst({
          where: {
            tenantId,
            shortcut: data.shortcut,
            id: { not: id },
          },
          select: { id: true },
        });

        if (shortcutExists) {
          throw new BadRequestError('Ja existe uma quick reply com este atalho');
        }
      }

      return tx.quickReply.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.shortcut !== undefined && { shortcut: data.shortcut }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.order !== undefined && { order: data.order }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        select: {
          id: true,
          title: true,
          shortcut: true,
          content: true,
          category: true,
          order: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    logger.info({ quickReplyId: quickReply.id, tenantId }, 'QuickReply updated');

    return quickReply;
  }

  /**
   * Deletar quick reply
   */
  async deleteQuickReply(id: string, tenantId: string) {
    const result = await prisma.quickReply.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) {
      throw new NotFoundError('Quick reply nao encontrada');
    }

    logger.info({ quickReplyId: id, tenantId }, 'QuickReply deleted');
  }
}

export const quickReplyService = new QuickReplyService();
