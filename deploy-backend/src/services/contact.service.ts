import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';

export class ContactService {
  /**
   * Listar contatos do tenant
   */
  async listContacts(tenantId: string, params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phoneNumber: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phoneNumber: true,
          name: true,
          email: true,
          profilePictureUrl: true,
          createdAt: true,
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    // Pegar última conversa de cada contato
    const contactsWithLastConversation = await Promise.all(
      contacts.map(async (contact) => {
        const lastConversation = await prisma.conversation.findFirst({
          where: {
            tenantId,
            contactId: contact.id,
          },
          orderBy: { lastMessageAt: 'desc' },
          select: {
            id: true,
            status: true,
            lastMessageAt: true,
          },
        });

        return {
          ...contact,
          conversationsCount: contact._count.conversations,
          _count: undefined,
          lastConversationAt: lastConversation?.lastMessageAt || null,
        };
      })
    );

    return {
      data: contactsWithLastConversation,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar contato por ID
   */
  async getContactById(contactId: string, tenantId: string) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId,
      },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            priority: true,
            createdAt: true,
            closedAt: true,
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundError('Contato não encontrado');
    }

    return contact;
  }

  /**
   * Buscar contato por telefone
   */
  async getContactByPhoneNumber(phoneNumber: string, tenantId: string) {
    return prisma.contact.findFirst({
      where: {
        phoneNumber,
        tenantId,
      },
    });
  }

  /**
   * Criar contato
   */
  async createContact(data: {
    phoneNumber: string;
    name?: string;
    email?: string;
    tenantId: string;
  }) {
    return prisma.contact.create({
      data: {
        phoneNumber: data.phoneNumber,
        name: data.name || null,
        email: data.email || null,
        tenantId: data.tenantId,
      },
    });
  }

  /**
   * Atualizar contato
   */
  async updateContact(
    contactId: string,
    tenantId: string,
    data: {
      name?: string;
      email?: string;
      metadata?: any;
    }
  ) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId,
      },
    });

    if (!contact) {
      throw new NotFoundError('Contato não encontrado');
    }

    return prisma.contact.update({
      where: { id: contactId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}

export const contactService = new ContactService();
