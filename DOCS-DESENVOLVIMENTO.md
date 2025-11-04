# 🛠️ GUIA DE DESENVOLVIMENTO - CRM WhatsApp

> **Este documento explica passo a passo como cada parte do sistema será desenvolvida**

---

## 📋 ÍNDICE

1. [Setup Inicial do Projeto](#1-setup-inicial)
2. [Desenvolvimento do Backend](#2-backend)
3. [Desenvolvimento do Frontend](#3-frontend)
4. [Integração WhatsApp](#4-whatsapp)
5. [Integração n8n](#5-n8n)
6. [Testes](#6-testes)
7. [Segurança](#7-segurança)

---

## 1️⃣ SETUP INICIAL DO PROJETO

### 1.1 Estrutura Monorepo

**O que é Monorepo?**
Um único repositório Git contendo múltiplos projetos (backend + frontend). Facilita:
- Compartilhamento de código TypeScript
- Versionamento sincronizado
- Deploy conjunto

**Ferramentas:**
- **pnpm** - Gerenciador de pacotes rápido e eficiente
- **Workspaces** - Feature do pnpm para monorepos
- **Turborepo** (opcional) - Build system otimizado

### 1.2 Ordem de Criação

```
Passo 1: Limpar projeto atual
├── Remover node_modules antigo
├── Remover package.json antigo
└── Remover index.js vazio

Passo 2: Criar estrutura base
├── Criar pastas apps/, packages/, infra/
├── Criar package.json root (workspace)
└── Configurar .gitignore

Passo 3: Setup Backend
├── apps/backend/package.json
├── apps/backend/tsconfig.json
├── apps/backend/src/server.ts
└── apps/backend/prisma/schema.prisma

Passo 4: Setup Frontend
├── apps/frontend/ (Next.js CLI)
└── Configurar Tailwind + Shadcn

Passo 5: Shared Packages
├── packages/shared-types/
└── packages/config/
```

### 1.3 Tecnologias e Versões

```json
{
  "node": "20.x LTS",
  "pnpm": "8.x",
  "typescript": "5.3.x",
  "postgresql": "16.x",
  "redis": "7.x"
}
```

---

## 2️⃣ DESENVOLVIMENTO DO BACKEND

### 2.1 Arquitetura em Camadas

**Por que camadas?**
Separação de responsabilidades, código testável, manutenível.

```
┌─────────────────────────────────────┐
│  CONTROLLERS (Rotas Express)        │ ← Recebe HTTP requests
│  - Valida input básico              │
│  - Chama Services                   │
│  - Retorna HTTP responses           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  SERVICES (Business Logic)          │ ← Lógica de negócio
│  - Processa regras de negócio       │
│  - Orquestra múltiplos repositories │
│  - Valida dados com Zod             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  REPOSITORIES (Data Access)         │ ← Acesso ao banco
│  - Queries com Prisma               │
│  - CRUD básico                      │
│  - Sem lógica de negócio            │
└────────────┬────────────────────────┘
             │
             ▼
        [PostgreSQL]
```

### 2.2 Configuração Prisma ORM

**Schema Exemplo:**

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // Hash bcrypt
  name      String
  role      Role     @default(ATTENDANT)
  status    UserStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  conversations Conversation[]
}

enum Role {
  ADMIN
  ATTENDANT
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

model Contact {
  id                 String   @id @default(uuid())
  phoneNumber        String   @unique // Formato: 5511999999999
  name               String?
  profilePictureUrl  String?
  metadata           Json?    // Dados extras do WhatsApp
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  conversations Conversation[]
}

model Conversation {
  id             String       @id @default(uuid())
  contactId      String
  assignedToId   String?
  status         ConversationStatus @default(OPEN)
  priority       Priority     @default(MEDIUM)
  lastMessageAt  DateTime     @default(now())
  createdAt      DateTime     @default(now())
  closedAt       DateTime?

  contact    Contact   @relation(fields: [contactId], references: [id])
  assignedTo User?     @relation(fields: [assignedToId], references: [id])
  messages   Message[]
  tags       Tag[]

  @@index([status, lastMessageAt])
  @@index([assignedToId])
}

enum ConversationStatus {
  OPEN          // Novo, aguardando atendimento
  IN_PROGRESS   // Atendente está conversando
  WAITING       // Aguardando resposta do cliente
  CLOSED        // Finalizada
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Message {
  id                String      @id @default(uuid())
  conversationId    String
  whatsappMessageId String      @unique // ID da Meta
  direction         Direction
  type              MessageType
  content           String      @db.Text
  metadata          Json?       // Dados extras (mídia URLs, location, etc)
  status            MessageStatus @default(SENT)
  sentById          String?     // Se OUTBOUND
  timestamp         DateTime    // Horário real da mensagem
  createdAt         DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId, timestamp])
}

enum Direction {
  INBOUND   // Cliente → Atendente
  OUTBOUND  // Atendente → Cliente
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  LOCATION
  STICKER
}

enum MessageStatus {
  SENT
  DELIVERED
  READ
  FAILED
}

model Tag {
  id        String   @id @default(uuid())
  name      String   @unique
  color     String   // Hex color
  createdAt DateTime @default(now())

  conversations Conversation[]
}
```

**Comandos Prisma:**

```bash
# Gerar client TypeScript
pnpm prisma generate

# Criar migration
pnpm prisma migrate dev --name init

# Aplicar migrations em produção
pnpm prisma migrate deploy

# Abrir Prisma Studio (GUI)
pnpm prisma studio
```

### 2.3 Sistema de Autenticação JWT

**Fluxo Completo:**

```
1. Login
   └─→ POST /auth/login
       Body: { email, password }
       ↓
       Valida credenciais
       ↓
       Gera Access Token (15min)
       Gera Refresh Token (7d)
       ↓
       Return: {
         accessToken: "eyJhbGc...",
         refreshToken: "eyJhbGc..." (httpOnly cookie)
       }

2. Request Autenticado
   └─→ GET /api/conversations
       Header: Authorization: Bearer <accessToken>
       ↓
       Middleware valida JWT
       ↓
       Decodifica payload: { userId, role }
       ↓
       Adiciona em req.user
       ↓
       Controller acessa req.user

3. Refresh Token
   └─→ POST /auth/refresh
       Cookie: refreshToken
       ↓
       Valida refresh token
       ↓
       Gera novo access token
       ↓
       Return: { accessToken }
```

**Implementação:**

```typescript
// src/services/auth.service.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  // Gerar Access Token (curta duração)
  generateAccessToken(userId: string, role: string): string {
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
  }

  // Gerar Refresh Token (longa duração)
  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
  }

  // Validar senha
  async validatePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // Hash senha
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12); // 12 salt rounds
  }
}
```

```typescript
// src/middlewares/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role: string;
    };

    req.user = payload; // Adiciona user no request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para verificar role
export function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}
```

### 2.4 Integração WhatsApp Business API

**Configuração Necessária:**

```env
# .env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=123456789  # Da Meta
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
WHATSAPP_ACCESS_TOKEN=EAAG...       # Token permanente
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui
WHATSAPP_APP_SECRET=abc123...       # Para validar webhooks
```

**Service para Enviar Mensagens:**

```typescript
// src/services/whatsapp.service.ts

import axios from 'axios';

export class WhatsAppService {
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;

  async sendTextMessage(to: string, text: string): Promise<string> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: to, // Formato: 5511999999999
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Retorna o message ID da Meta
    return response.data.messages[0].id;
  }

  async sendImageMessage(to: string, imageUrl: string, caption?: string) {
    // Similar ao texto, mas type: 'image'
    // ...
  }

  // Marcar mensagem como lida
  async markAsRead(messageId: string) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      },
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

### 2.5 Sistema de Webhooks (Receber Mensagens)

**O que acontece:**
Quando um cliente envia mensagem, a Meta faz POST para nossa API.

```typescript
// src/controllers/webhook.controller.ts

import { Request, Response } from 'express';
import crypto from 'crypto';
import { WebhookService } from '../services/webhook.service';

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  // Verificação do webhook (primeira vez que configura na Meta)
  verify(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  // Receber webhooks
  async handleWebhook(req: Request, res: Response) {
    // 1. VALIDAR ASSINATURA (SEGURANÇA CRÍTICA!)
    const signature = req.headers['x-hub-signature-256'] as string;
    const isValid = this.validateSignature(
      JSON.stringify(req.body),
      signature
    );

    if (!isValid) {
      console.error('❌ Assinatura inválida - possível ataque!');
      return res.status(403).send('Invalid signature');
    }

    // 2. PROCESSAR WEBHOOK
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.webhookService.processMessage(change.value);
          }
        }
      }
    }

    // 3. RESPONDER IMEDIATAMENTE (Meta espera 200 OK rápido)
    res.status(200).send('EVENT_RECEIVED');
  }

  private validateSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }
}
```

**Service para Processar Mensagens:**

```typescript
// src/services/webhook.service.ts

export class WebhookService {
  async processMessage(value: any) {
    const messages = value.messages;

    if (!messages) return; // Pode ser status update

    for (const message of messages) {
      const from = message.from; // 5511999999999
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000);

      // 1. Buscar ou criar contato
      let contact = await prisma.contact.findUnique({
        where: { phoneNumber: from }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            phoneNumber: from,
            name: value.contacts?.[0]?.profile?.name || null
          }
        });
      }

      // 2. Buscar ou criar conversa OPEN
      let conversation = await prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] }
        }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            contactId: contact.id,
            status: 'OPEN'
          }
        });
      }

      // 3. Salvar mensagem
      const messageData = this.extractMessageData(message);

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappMessageId: messageId,
          direction: 'INBOUND',
          type: messageData.type,
          content: messageData.content,
          metadata: messageData.metadata,
          timestamp: timestamp
        }
      });

      // 4. Atualizar lastMessageAt da conversa
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: timestamp }
      });

      // 5. EMITIR EVENTO WEBSOCKET
      io.to(`conversation-${conversation.id}`).emit('new_message', {
        conversationId: conversation.id,
        message: messageData
      });
    }
  }

  private extractMessageData(message: any) {
    // Suporta diferentes tipos de mensagem
    if (message.type === 'text') {
      return {
        type: 'TEXT',
        content: message.text.body,
        metadata: null
      };
    }

    if (message.type === 'image') {
      return {
        type: 'IMAGE',
        content: message.image.id, // Depois baixamos via API
        metadata: {
          caption: message.image.caption,
          mimeType: message.image.mime_type
        }
      };
    }

    // ... outros tipos (audio, video, document, location)
  }
}
```

### 2.6 WebSocket (Tempo Real)

```typescript
// src/websocket/socket.ts

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupWebSocket(io: Server) {
  // Middleware de autenticação
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      socket.data.userId = payload.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`✅ User ${userId} connected`);

    // Entrar nas rooms das conversas do atendente
    socket.on('join_conversations', async (conversationIds: string[]) => {
      conversationIds.forEach(id => {
        socket.join(`conversation-${id}`);
      });
    });

    // Sair de uma conversa
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation-${conversationId}`);
    });

    // Notificar que está digitando
    socket.on('typing', (conversationId: string) => {
      socket.to(`conversation-${conversationId}`).emit('user_typing', {
        userId,
        conversationId
      });
    });

    socket.on('disconnect', () => {
      console.log(`❌ User ${userId} disconnected`);
    });
  });
}

// Usar em outro lugar para emitir eventos:
// io.to(`conversation-${id}`).emit('new_message', data);
```

### 2.7 Sistema de Filas (Bull + Redis)

**Por que fila?**
- ✅ Retry automático se WhatsApp API falhar
- ✅ Rate limiting (WhatsApp tem limites de mensagens/segundo)
- ✅ Processamento assíncrono (responde rápido pro usuário)

```typescript
// src/queues/message.queue.ts

import Queue from 'bull';
import { WhatsAppService } from '../services/whatsapp.service';

const messageQueue = new Queue('message-sending', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Processar jobs
messageQueue.process(async (job) => {
  const { to, text, conversationId, messageId } = job.data;

  const whatsappService = new WhatsAppService();

  try {
    const whatsappMessageId = await whatsappService.sendTextMessage(to, text);

    // Atualizar mensagem no banco
    await prisma.message.update({
      where: { id: messageId },
      data: {
        whatsappMessageId,
        status: 'SENT'
      }
    });

    return { success: true, whatsappMessageId };
  } catch (error) {
    // Bull vai tentar novamente automaticamente
    throw error;
  }
});

// Adicionar job à fila
export async function queueMessage(data: {
  to: string;
  text: string;
  conversationId: string;
  messageId: string;
}) {
  await messageQueue.add(data, {
    attempts: 3, // Tentar 3 vezes
    backoff: {
      type: 'exponential',
      delay: 2000 // 2s, 4s, 8s
    }
  });
}
```

---

## 3️⃣ DESENVOLVIMENTO DO FRONTEND

### 3.1 Setup Next.js 14

```bash
# Criar projeto Next.js
pnpm create next-app@latest apps/frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
```

### 3.2 Design System (Shadcn/ui)

**Instalar Shadcn:**

```bash
cd apps/frontend
pnpm dlx shadcn-ui@latest init

# Adicionar componentes
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add card
pnpm dlx shadcn-ui@latest add input
pnpm dlx shadcn-ui@latest add dialog
pnpm dlx shadcn-ui@latest add avatar
pnpm dlx shadcn-ui@latest add badge
```

### 3.3 Interface Kanban

**Conceito:**
Colunas representam status de conversas (OPEN, IN_PROGRESS, WAITING, CLOSED).
Cards são as conversas.

```typescript
// src/components/kanban/KanbanBoard.tsx

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const columns = [
  { id: 'OPEN', title: 'Novos', color: 'blue' },
  { id: 'IN_PROGRESS', title: 'Em Atendimento', color: 'yellow' },
  { id: 'WAITING', title: 'Aguardando', color: 'orange' },
  { id: 'CLOSED', title: 'Finalizados', color: 'green' }
];

export function KanbanBoard() {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const conversationId = result.draggableId;
    const newStatus = result.destination.droppableId;

    // Atualizar no backend
    await updateConversationStatus(conversationId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto p-4">
        {columns.map(column => (
          <Droppable key={column.id} droppableId={column.id}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 min-w-[300px] bg-gray-100 rounded-lg p-4"
              >
                <h3 className="font-bold mb-4">{column.title}</h3>

                {conversations
                  ?.filter(c => c.status === column.id)
                  .map((conversation, index) => (
                    <Draggable
                      key={conversation.id}
                      draggableId={conversation.id}
                      index={index}
                    >
                      {(provided) => (
                        <ConversationCard
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          conversation={conversation}
                        />
                      )}
                    </Draggable>
                  ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
```

### 3.4 Interface de Chat

```typescript
// src/components/chat/ChatInterface.tsx

export function ChatInterface({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const { socket } = useWebSocket();

  // Buscar mensagens históricas
  useEffect(() => {
    fetchMessages(conversationId).then(setMessages);
  }, [conversationId]);

  // Escutar novas mensagens via WebSocket
  useEffect(() => {
    socket?.on('new_message', (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    return () => {
      socket?.off('new_message');
    };
  }, [socket, conversationId]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    await sendMessage(conversationId, inputValue);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatHeader conversationId={conversationId} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua mensagem..."
          />
          <Button onClick={handleSend}>Enviar</Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4️⃣ INTEGRAÇÃO WHATSAPP (Detalhada)

### 4.1 Configurar App na Meta

1. Acesse https://developers.facebook.com/
2. Crie um App tipo "Business"
3. Adicione produto "WhatsApp"
4. Configure número de telefone
5. Gere token de acesso permanente
6. Configure webhook URL: `https://seu-dominio.com/webhooks/whatsapp`

### 4.2 Tipos de Mensagens Suportados

- ✅ Texto
- ✅ Imagem
- ✅ Vídeo
- ✅ Áudio
- ✅ Documento (PDF, etc)
- ✅ Localização
- ✅ Stickers
- ✅ Templates (mensagens pré-aprovadas pela Meta)

### 4.3 Limitações da API

- 📊 Rate limit: Varia por tier (começa com ~80 msg/segundo)
- 💬 Janela de conversa: 24h após última mensagem do cliente
- 📝 Templates: Necessários para iniciar conversa após 24h
- 💰 Custo: Pago por conversa (não por mensagem)

---

## 5️⃣ INTEGRAÇÃO N8N

### 5.1 API Endpoints para n8n

```typescript
// src/controllers/n8n.controller.ts

export class N8nController {
  // Enviar mensagem
  async sendMessage(req: Request, res: Response) {
    // Validar API Key no header
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { phoneNumber, message } = req.body;

    // Validar com Zod
    const schema = z.object({
      phoneNumber: z.string().regex(/^55\d{10,11}$/),
      message: z.string().min(1).max(4096)
    });

    const validated = schema.parse({ phoneNumber, message });

    // Adicionar à fila
    await queueMessage({
      to: validated.phoneNumber,
      text: validated.message,
      // ...
    });

    res.json({ success: true, queued: true });
  }

  // Webhook para n8n (quando chega mensagem)
  async webhookForN8n(req: Request, res: Response) {
    // n8n pode registrar webhook para ser notificado
    // quando chega mensagem específica
  }
}
```

### 5.2 Documentação OpenAPI/Swagger

```yaml
# docs/api-n8n.yaml
openapi: 3.0.0
info:
  title: CRM WhatsApp API para n8n
  version: 1.0.0

paths:
  /api/n8n/send-message:
    post:
      summary: Enviar mensagem WhatsApp
      security:
        - ApiKeyAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                phoneNumber:
                  type: string
                  example: "5511999999999"
                message:
                  type: string
                  example: "Olá! Seu check-in foi confirmado."
      responses:
        200:
          description: Mensagem enfileirada com sucesso
```

---

## 6️⃣ TESTES

### 6.1 Testes Unitários (Jest)

```typescript
// tests/services/auth.service.test.ts

import { AuthService } from '@/services/auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'senhaSegura123';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password', async () => {
      const password = 'senhaSegura123';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.validatePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'senhaSegura123';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.validatePassword('senhaErrada', hash);

      expect(isValid).toBe(false);
    });
  });
});
```

### 6.2 Testes E2E (Playwright)

```typescript
// tests/e2e/login.spec.ts

import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  await page.fill('input[name="email"]', 'admin@hotel.com');
  await page.fill('input[name="password"]', 'senha123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('http://localhost:3000/conversations');
  await expect(page.locator('text=Bem-vindo')).toBeVisible();
});
```

---

## 7️⃣ SEGURANÇA

### 7.1 Checklist de Segurança

- ✅ Senhas hasheadas com bcrypt
- ✅ JWT com expiração curta
- ✅ Refresh tokens em httpOnly cookies
- ✅ Validação de webhooks com HMAC
- ✅ Rate limiting em todas as rotas
- ✅ CORS configurado corretamente
- ✅ Headers de segurança (Helmet.js)
- ✅ Validação de entrada com Zod
- ✅ SQL injection (protegido pelo Prisma)
- ✅ XSS (React escapa HTML automaticamente)
- ✅ HTTPS obrigatório em produção

### 7.2 Variáveis de Ambiente

```env
# Nunca commitar este arquivo!
# Copiar de .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/crm_whatsapp"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=sua_chave_super_secreta_aqui_min_32_chars
JWT_REFRESH_SECRET=outra_chave_diferente_min_32_chars

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=token_verificacao_webhook

# n8n
N8N_API_KEY=chave_api_para_n8n

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

**PRÓXIMO DOCUMENTO:** `DOCS-DEPLOY.md` (Como fazer deploy em VPS)
