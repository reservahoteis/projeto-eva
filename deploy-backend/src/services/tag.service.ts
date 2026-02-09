import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import logger from '@/config/logger';
import type { CreateTagInput, UpdateTagBody } from '@/validators/tag.validator';

export class TagService {
  /**
   * Listar tags do tenant
   */
  async listTags(tenantId: string, params?: { search?: string }) {
    const where: { tenantId: string; name?: { contains: string; mode: 'insensitive' } } = { tenantId };

    if (params?.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const tags = await prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      conversationsCount: tag._count.conversations,
    }));
  }

  /**
   * Buscar tag por ID
   */
  async getTagById(id: string, tenantId: string) {
    const tag = await prisma.tag.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundError('Tag nao encontrada');
    }

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      conversationsCount: tag._count.conversations,
    };
  }

  /**
   * Criar tag
   */
  async createTag(tenantId: string, data: CreateTagInput) {
    // Verificar se nome ja existe no tenant (@@unique([tenantId, name]))
    const existing = await prisma.tag.findFirst({
      where: {
        tenantId,
        name: data.name,
      },
    });

    if (existing) {
      throw new BadRequestError('Ja existe uma tag com este nome');
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color,
      },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
      },
    });

    logger.info({ tagId: tag.id, tenantId, name: tag.name }, 'Tag created');

    return tag;
  }

  /**
   * Atualizar tag
   */
  async updateTag(id: string, tenantId: string, data: UpdateTagBody) {
    const existing = await prisma.tag.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Tag nao encontrada');
    }

    // Se esta alterando nome, verificar duplicidade
    if (data.name && data.name !== existing.name) {
      const nameExists = await prisma.tag.findFirst({
        where: {
          tenantId,
          name: data.name,
          id: { not: id },
        },
      });

      if (nameExists) {
        throw new BadRequestError('Ja existe uma tag com este nome');
      }
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
      },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
      },
    });

    logger.info({ tagId: tag.id, tenantId }, 'Tag updated');

    return tag;
  }

  /**
   * Deletar tag
   */
  async deleteTag(id: string, tenantId: string) {
    const existing = await prisma.tag.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Tag nao encontrada');
    }

    await prisma.tag.delete({
      where: { id },
    });

    logger.info({ tagId: id, tenantId }, 'Tag deleted');
  }

  /**
   * Adicionar tag a uma conversa
   */
  async addTagToConversation(tenantId: string, conversationId: string, tagId: string) {
    // Verificar se conversa pertence ao tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa nao encontrada');
    }

    // Verificar se tag pertence ao tenant
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
      select: { id: true },
    });

    if (!tag) {
      throw new NotFoundError('Tag nao encontrada');
    }

    // Conectar tag a conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        tags: {
          connect: { id: tagId },
        },
      },
    });

    logger.info({ conversationId, tagId, tenantId }, 'Tag added to conversation');
  }

  /**
   * Remover tag de uma conversa
   */
  async removeTagFromConversation(tenantId: string, conversationId: string, tagId: string) {
    // Verificar se conversa pertence ao tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa nao encontrada');
    }

    // Desconectar tag da conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        tags: {
          disconnect: { id: tagId },
        },
      },
    });

    logger.info({ conversationId, tagId, tenantId }, 'Tag removed from conversation');
  }
}

export const tagService = new TagService();
