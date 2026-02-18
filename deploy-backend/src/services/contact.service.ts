import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import ExcelJS from 'exceljs';

export class ContactService {
  /**
   * Listar contatos do tenant
   */
  async listContacts(tenantId: string, params?: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = params?.sortOrder || 'desc';

    const where: any = { tenantId };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phoneNumber: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Buscar contatos com última conversa em uma única query (evita N+1)
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          phoneNumber: true,
          name: true,
          email: true,
          profilePictureUrl: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              conversations: true,
            },
          },
          // Incluir última conversa diretamente (ordenada por lastMessageAt)
          conversations: {
            orderBy: { lastMessageAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              lastMessageAt: true,
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    // Formatar resposta (sem N+1 - dados já vieram na query)
    const contactsFormatted = contacts.map((contact) => ({
      id: contact.id,
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      email: contact.email,
      profilePictureUrl: contact.profilePictureUrl,
      metadata: contact.metadata,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      conversationsCount: contact._count.conversations,
      lastConversationAt: contact.conversations[0]?.lastMessageAt || null,
    }));

    return {
      data: contactsFormatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
        _count: {
          select: {
            conversations: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          select: {
            id: true,
            lastMessageAt: true,
          },
        },
      },
    });

    if (!contact) {
      return null;
    }

    // Formatar resposta
    return {
      ...contact,
      lastConversation: contact.conversations[0] || null,
      conversations: undefined,
    };
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
    profilePictureUrl?: string;
    metadata?: any;
    tenantId: string;
  }) {
    return prisma.contact.create({
      data: {
        channel: 'WHATSAPP',
        externalId: data.phoneNumber,
        phoneNumber: data.phoneNumber,
        name: data.name || null,
        email: data.email || null,
        profilePictureUrl: data.profilePictureUrl || null,
        metadata: data.metadata || {},
        tenantId: data.tenantId,
      },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
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
      profilePictureUrl?: string | null;
      metadata?: any | null;
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
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });
  }

  /**
   * Deletar contato
   */
  async deleteContact(contactId: string, tenantId: string): Promise<void> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId,
      },
    });

    if (!contact) {
      throw new NotFoundError('Contato não encontrado');
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });
  }

  /**
   * Buscar contatos com base em query
   */
  async searchContacts(
    tenantId: string,
    query: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ) {
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 10, 50);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { phoneNumber: { contains: query } },
        { email: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { name: 'asc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          phoneNumber: true,
          name: true,
          email: true,
          profilePictureUrl: true,
          metadata: true,
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Contar total de contatos
   */
  async countContacts(tenantId: string): Promise<number> {
    return prisma.contact.count({
      where: { tenantId },
    });
  }

  /**
   * Contar contatos com conversas
   */
  async countContactsWithConversations(tenantId: string): Promise<number> {
    // Usar count ao invés de findMany para evitar carregar dados desnecessários
    return prisma.contact.count({
      where: {
        tenantId,
        conversations: {
          some: {},
        },
      },
    });
  }

  /**
   * Obter contatos recentes
   */
  async getRecentContacts(tenantId: string, limit: number = 10) {
    return prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
    });
  }

  /**
   * Exportar contatos para Excel
   */
  async exportContactsToExcel(
    tenantId: string,
    params?: {
      search?: string;
    }
  ): Promise<Buffer> {
    const where: any = { tenantId };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phoneNumber: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Buscar todos os contatos (sem paginação para exportação)
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          select: {
            lastMessageAt: true,
            status: true,
          },
        },
      },
    });

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bot Reserva Hotéis';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Contatos', {
      headerFooter: {
        firstHeader: 'Contatos Exportados',
      },
    });

    // Definir colunas
    worksheet.columns = [
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Telefone', key: 'phoneNumber', width: 20 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Conversas', key: 'conversationsCount', width: 12 },
      { header: 'Última Conversa', key: 'lastConversationAt', width: 20 },
      { header: 'Status Última Conversa', key: 'lastConversationStatus', width: 20 },
      { header: 'Criado em', key: 'createdAt', width: 20 },
      { header: 'Atualizado em', key: 'updatedAt', width: 20 },
    ];

    // Estilizar cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Adicionar dados
    contacts.forEach((contact) => {
      worksheet.addRow({
        name: contact.name || 'Sem nome',
        phoneNumber: contact.phoneNumber,
        email: contact.email || '-',
        conversationsCount: contact._count.conversations,
        lastConversationAt: contact.conversations[0]?.lastMessageAt
          ? new Date(contact.conversations[0].lastMessageAt).toLocaleString('pt-BR')
          : '-',
        lastConversationStatus: contact.conversations[0]?.status || '-',
        createdAt: new Date(contact.createdAt).toLocaleString('pt-BR'),
        updatedAt: new Date(contact.updatedAt).toLocaleString('pt-BR'),
      });
    });

    // Estilizar linhas de dados alternadas
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle' };
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' },
          };
        }
      }
    });

    // Adicionar bordas
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exportar contatos para CSV
   */
  async exportContactsToCsv(
    tenantId: string,
    params?: {
      search?: string;
    }
  ): Promise<Buffer> {
    const where: any = { tenantId };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phoneNumber: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Buscar todos os contatos (sem paginação para exportação)
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          select: {
            lastMessageAt: true,
            status: true,
          },
        },
      },
    });

    // Cabeçalho CSV
    const headers = [
      'Nome',
      'Telefone',
      'Email',
      'Conversas',
      'Última Conversa',
      'Status Última Conversa',
      'Criado em',
      'Atualizado em',
    ];

    // Função para escapar valores CSV
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Gerar linhas
    const rows = contacts.map((contact) => [
      escapeCsv(contact.name || 'Sem nome'),
      escapeCsv(contact.phoneNumber || '-'),
      escapeCsv(contact.email || '-'),
      contact._count.conversations.toString(),
      escapeCsv(
        contact.conversations[0]?.lastMessageAt
          ? new Date(contact.conversations[0].lastMessageAt).toLocaleString('pt-BR')
          : '-'
      ),
      escapeCsv(contact.conversations[0]?.status || '-'),
      escapeCsv(new Date(contact.createdAt).toLocaleString('pt-BR')),
      escapeCsv(new Date(contact.updatedAt).toLocaleString('pt-BR')),
    ]);

    // Montar CSV com BOM para Excel reconhecer UTF-8
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return Buffer.from(csv, 'utf-8');
  }
}

export const contactService = new ContactService();
