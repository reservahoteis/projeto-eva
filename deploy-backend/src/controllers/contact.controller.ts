import { Request, Response, NextFunction } from 'express';
import { contactService } from '@/services/contact.service';
import { logger } from '@/config/logger';
import {
  emitContactCreated,
  emitContactUpdated,
  emitContactDeleted,
} from '@/config/socket';
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsQuery,
} from '@/validators/contact.validator';

/**
 * Helper para extrair e validar tenantId
 * Retorna string se válido, envia erro e retorna null caso contrário
 */
function requireTenantId(req: Request, res: Response): string | null {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(400).json({
      error: 'Tenant ID não encontrado',
      message: 'Usuário deve estar associado a um tenant',
    });
    return null;
  }
  return tenantId;
}

class ContactController {
  /**
   * Listar contatos do tenant com paginação e busca
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      const {
        page = 1,
        limit = 20,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query as ListContactsQuery;

      logger.info({
        tenantId,
        userId: req.user?.id,
        params: { page, limit, search, sortBy, sortOrder },
      }, 'Listando contatos');

      const result = await contactService.listContacts(tenantId, {
        page,
        limit,
        search,
        sortBy,
        sortOrder,
      });

      logger.debug({
        tenantId,
        totalContacts: result.pagination.total,
        returnedContacts: result.data.length,
      }, 'Contatos listados com sucesso');

      res.json(result);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
      }, 'Erro ao listar contatos');
      next(error);
    }
  }

  /**
   * Buscar contato por ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'ID do contato não fornecido' });
        return;
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: id,
      }, 'Buscando contato por ID');

      const contact = await contactService.getContactById(id, tenantId);

      if (!contact) {
        logger.warn({
          tenantId,
          contactId: id,
        }, 'Contato não encontrado');

        res.status(404).json({
          error: 'Contato não encontrado',
          message: 'O contato solicitado não existe ou não pertence ao seu tenant',
        });
        return;
      }

      logger.debug({
        tenantId,
        contactId: id,
      }, 'Contato encontrado com sucesso');

      res.json(contact);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        contactId: req.params.id,
      }, 'Erro ao buscar contato');
      next(error);
    }
  }

  /**
   * Criar novo contato
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      const contactData = req.body as CreateContactInput;

      logger.info({
        tenantId,
        userId: req.user?.id,
        phoneNumber: contactData.phoneNumber,
        hasName: !!contactData.name,
        hasEmail: !!contactData.email,
      }, 'Criando novo contato');

      // Verificar se contato já existe com este número
      const existingContact = await contactService.getContactByPhoneNumber(
        contactData.phoneNumber,
        tenantId
      );

      if (existingContact) {
        logger.warn({
          tenantId,
          phoneNumber: contactData.phoneNumber,
          existingContactId: existingContact.id,
        }, 'Tentativa de criar contato duplicado');

        res.status(409).json({
          error: 'Contato já existe',
          message: `Já existe um contato com o número ${contactData.phoneNumber}`,
          existingContactId: existingContact.id,
        });
        return;
      }

      const contact = await contactService.createContact({
        phoneNumber: contactData.phoneNumber,
        name: contactData.name,
        email: contactData.email,
        profilePictureUrl: contactData.profilePictureUrl,
        metadata: contactData.metadata,
        tenantId,
      });

      // Emitir evento Socket.io para atualização em tempo real
      emitContactCreated(tenantId, contact);

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: contact.id,
        phoneNumber: contact.phoneNumber,
      }, 'Contato criado com sucesso');

      res.status(201).json(contact);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        phoneNumber: req.body?.phoneNumber,
      }, 'Erro ao criar contato');
      next(error);
    }
  }

  /**
   * Atualizar contato existente
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'ID do contato não fornecido' });
        return;
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      const updateData = req.body as UpdateContactInput;

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: id,
        fieldsToUpdate: Object.keys(updateData),
      }, 'Atualizando contato');

      // Verificar se contato existe e pertence ao tenant
      const existingContact = await contactService.getContactById(id, tenantId);

      if (!existingContact) {
        logger.warn({
          tenantId,
          contactId: id,
        }, 'Tentativa de atualizar contato inexistente');

        res.status(404).json({
          error: 'Contato não encontrado',
          message: 'O contato não existe ou não pertence ao seu tenant',
        });
        return;
      }

      const updatedContact = await contactService.updateContact(id, tenantId, updateData);

      // Emitir evento Socket.io para atualização em tempo real
      emitContactUpdated(tenantId, updatedContact);

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: id,
        updatedFields: Object.keys(updateData),
      }, 'Contato atualizado com sucesso');

      res.json(updatedContact);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        contactId: req.params.id,
      }, 'Erro ao atualizar contato');
      next(error);
    }
  }

  /**
   * Deletar contato
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'ID do contato não fornecido' });
        return;
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: id,
      }, 'Deletando contato');

      // Verificar se contato existe e pertence ao tenant
      const existingContact = await contactService.getContactById(id, tenantId);

      if (!existingContact) {
        logger.warn({
          tenantId,
          contactId: id,
        }, 'Tentativa de deletar contato inexistente');

        res.status(404).json({
          error: 'Contato não encontrado',
          message: 'O contato não existe ou não pertence ao seu tenant',
        });
        return;
      }

      // Verificar se há conversas ativas com este contato
      const activeConversationsCount = existingContact._count?.conversations || 0;

      if (activeConversationsCount > 0) {
        logger.warn({
          tenantId,
          contactId: id,
          activeConversations: activeConversationsCount,
        }, 'Tentativa de deletar contato com conversas ativas');

        res.status(400).json({
          error: 'Não é possível deletar contato',
          message: `Este contato possui ${activeConversationsCount} conversa(s) ativa(s). Archive as conversas antes de deletar o contato.`,
        });
        return;
      }

      await contactService.deleteContact(id, tenantId);

      // Emitir evento Socket.io para atualização em tempo real
      emitContactDeleted(tenantId, id);

      logger.info({
        tenantId,
        userId: req.user?.id,
        contactId: id,
      }, 'Contato deletado com sucesso');

      res.status(204).send();
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        contactId: req.params.id,
      }, 'Erro ao deletar contato');
      next(error);
    }
  }

  /**
   * Buscar contato por número de telefone
   */
  async getByPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber } = req.params;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      if (!phoneNumber) {
        res.status(400).json({
          error: 'Número de telefone não fornecido',
          message: 'O parâmetro phoneNumber é obrigatório',
        });
        return;
      }

      logger.info({
        tenantId,
        userId: req.user?.id,
        phoneNumber,
      }, 'Buscando contato por número de telefone');

      const contact = await contactService.getContactByPhoneNumber(phoneNumber, tenantId);

      if (!contact) {
        logger.debug({
          tenantId,
          phoneNumber,
        }, 'Contato não encontrado pelo número');

        res.status(404).json({
          error: 'Contato não encontrado',
          message: `Nenhum contato encontrado com o número ${phoneNumber}`,
        });
        return;
      }

      logger.debug({
        tenantId,
        contactId: contact.id,
        phoneNumber,
      }, 'Contato encontrado pelo número');

      res.json(contact);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
        phoneNumber: req.params.phoneNumber,
      }, 'Erro ao buscar contato por telefone');
      next(error);
    }
  }

  /**
   * Buscar estatísticas dos contatos
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      logger.info({
        tenantId,
        userId: req.user?.id,
      }, 'Buscando estatísticas de contatos');

      const [totalContacts, contactsWithConversations, recentContacts] = await Promise.all([
        contactService.countContacts(tenantId),
        contactService.countContactsWithConversations(tenantId),
        contactService.getRecentContacts(tenantId, 5),
      ]);

      const stats = {
        total: totalContacts,
        withConversations: contactsWithConversations,
        withoutConversations: totalContacts - contactsWithConversations,
        recentContacts,
        lastUpdated: new Date().toISOString(),
      };

      logger.debug({
        tenantId,
        stats,
      }, 'Estatísticas de contatos obtidas');

      res.json(stats);
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
      }, 'Erro ao buscar estatísticas de contatos');
      next(error);
    }
  }

  /**
   * Exportar contatos para Excel ou CSV
   */
  async exportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) return;

      const { search, format = 'xlsx' } = req.query as { search?: string; format?: string };

      logger.info({
        tenantId,
        userId: req.user?.id,
        search,
        format,
      }, 'Exportando contatos');

      // Gerar nome do arquivo com data
      const date = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        const csvBuffer = await contactService.exportContactsToCsv(tenantId, { search });
        const filename = `contatos-${date}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', csvBuffer.length);

        logger.info({
          tenantId,
          userId: req.user?.id,
          filename,
          size: csvBuffer.length,
        }, 'Contatos exportados em CSV');

        res.send(csvBuffer);
      } else {
        const excelBuffer = await contactService.exportContactsToExcel(tenantId, { search });
        const filename = `contatos-${date}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);

        logger.info({
          tenantId,
          userId: req.user?.id,
          filename,
          size: excelBuffer.length,
        }, 'Contatos exportados em Excel');

        res.send(excelBuffer);
      }
    } catch (error) {
      logger.error({
        error,
        tenantId: req.user?.tenantId,
      }, 'Erro ao exportar contatos');
      next(error);
    }
  }
}

export const contactController = new ContactController();
