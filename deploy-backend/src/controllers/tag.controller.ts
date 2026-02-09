import { Request, Response, NextFunction } from 'express';
import { tagService } from '@/services/tag.service';
import type {
  ListTagsQuery,
  CreateTagInput,
  UpdateTagBody,
  TagConversationInput,
} from '@/validators/tag.validator';

/**
 * Listar tags do tenant
 */
export async function listTags(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const query = req.query as unknown as ListTagsQuery;
    const tags = await tagService.listTags(tenantId, query);

    res.json({ data: tags });
  } catch (error) {
    next(error);
  }
}

/**
 * Buscar tag por ID
 */
export async function getTagById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const tag = await tagService.getTagById(req.params.id, tenantId);
    res.json(tag);
  } catch (error) {
    next(error);
  }
}

/**
 * Criar tag
 */
export async function createTag(
  req: Request<{}, {}, CreateTagInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const tag = await tagService.createTag(tenantId, req.body);
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
}

/**
 * Atualizar tag
 */
export async function updateTag(
  req: Request<{ id: string }, {}, UpdateTagBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const tag = await tagService.updateTag(req.params.id, tenantId, req.body);
    res.json(tag);
  } catch (error) {
    next(error);
  }
}

/**
 * Deletar tag
 */
export async function deleteTag(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    await tagService.deleteTag(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Adicionar tag a conversa
 */
export async function addTagToConversation(
  req: Request<{}, {}, TagConversationInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    await tagService.addTagToConversation(tenantId, req.body.conversationId, req.body.tagId);
    res.json({ message: 'Tag adicionada a conversa' });
  } catch (error) {
    next(error);
  }
}

/**
 * Remover tag de conversa
 */
export async function removeTagFromConversation(
  req: Request<{}, {}, TagConversationInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    await tagService.removeTagFromConversation(tenantId, req.body.conversationId, req.body.tagId);
    res.json({ message: 'Tag removida da conversa' });
  } catch (error) {
    next(error);
  }
}
