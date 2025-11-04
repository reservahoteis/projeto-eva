import { Request, Response } from 'express';
import { messageService } from '@/services/message.service';
import type { SendMessageInput, ListMessagesInput } from '@/validators/message.validator';

export class MessageController {
  /**
   * GET /api/conversations/:conversationId/messages
   */
  async list(req: Request, res: Response) {
    const { conversationId } = req.params;
    const params = req.query as unknown as ListMessagesInput;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const result = await messageService.listMessages(conversationId, req.tenantId, params);

    res.json(result);
  }

  /**
   * POST /api/messages
   */
  async send(req: Request, res: Response) {
    const data = req.body as SendMessageInput;

    if (!req.tenantId || !req.user) {
      return res.status(400).json({ error: 'Tenant ou user não encontrado' });
    }

    const message = await messageService.sendMessage(
      {
        ...data,
        sentById: req.user.userId,
      },
      req.tenantId
    );

    res.status(201).json(message);
  }

  /**
   * POST /api/messages/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    await messageService.markAsRead(id, req.tenantId);

    res.status(204).send();
  }
}

export const messageController = new MessageController();
