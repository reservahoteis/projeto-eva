import 'express-async-errors'; // Deve ser a primeira importação!
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { env, isDev } from './config/env';
import { testDatabaseConnection } from './config/database';
import { testRedisConnection } from './config/redis';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.middleware';
import { tenantIsolationMiddleware } from './middlewares/tenant.middleware';
import { generalLimiter, n8nLimiter } from './middlewares/rate-limit.middleware';
import { initializeSocketIO } from './config/socket';
import { registerWorkers } from './queues/workers';

// Create Express app
const app = express();

// Create HTTP server (necessário para Socket.io)
const httpServer = createServer(app);

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================

// Security headers
app.use(helmet());

// CORS - Aceita múltiplas origens (separadas por vírgula no .env)
const allowedOrigins = env.FRONTEND_URL.split(',').map(url => url.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Body parsers
// IMPORTANTE: Para webhooks, precisamos do raw body para validação HMAC
// Por isso, usamos express.raw() para /webhooks e express.json() para o resto
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) {
    // Para webhooks: capturar raw body
    express.raw({ type: 'application/json', limit: '10mb' })(req, res, (err) => {
      if (err) return next(err);

      // Salvar raw body para validação HMAC
      if (req.body && Buffer.isBuffer(req.body)) {
        req.rawBody = req.body.toString('utf-8');

        // Parse JSON manualmente
        try {
          req.body = JSON.parse(req.rawBody);
        } catch (e) {
          // Se falhar parse, deixa como está
        }
      }

      next();
    });
  } else {
    // Para outras rotas: parse JSON normal
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development)
if (isDev) {
  app.use((req, _res, next) => {
    logger.info({
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    next();
  });
}

// Tenant isolation (CRÍTICO)
app.use(tenantIsolationMiddleware);

// ============================================
// SWAGGER/OPENAPI DOCUMENTATION
// ============================================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    defaultModelsExpandDepth: 1,
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    persistAuthorization: true,
  },
  customCss: '.swagger-ui .topbar { display: none } .swagger-ui .info { margin: 20px 0; }',
  customSiteTitle: 'CRM Hoteis API - Documentacao',
}));

// Endpoint para download da spec OpenAPI
app.get('/api/docs/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// ROTAS DA API
// ============================================

import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import conversationRoutes from './routes/conversation.routes';
import messageRoutes from './routes/message.routes';
import contactRoutes from './routes/contact.routes';
import userRoutes from './routes/user.routes';
import reportRoutes from './routes/report.routes';
import webhookRoutes from './routes/webhook.routes';
import healthRoutes from './routes/health.routes';
import debugRoutes from './routes/debug.routes';
import escalationRoutes from './routes/escalation.routes';
import tagRoutes from './routes/tag.routes';
import quickReplyRoutes from './routes/quick-reply.routes';
import n8nRoutes from './routes/n8n.routes';
import mediaRoutes from './routes/media.routes';
import publicRoutes from './routes/public.routes';
import usageTrackingRoutes from './routes/usage-tracking.routes';
import auditLogRoutes from './routes/audit-log.routes';
import webhookEventRoutes from './routes/webhook-event.routes';

// Auth (público - sem tenant isolation)
app.use('/auth', authRoutes);

// Webhooks (antes do tenant middleware para algumas rotas)
app.use('/webhooks', webhookRoutes);

// N8N Public routes (sem autenticação - para track-click do WhatsApp)
app.use('/api/n8n', publicRoutes);

// N8N Integration (autenticação própria por API Key)
// Rate limit especifico: 5000 req/min por tenant (carrosseis enviam muitas msgs)
// IMPORTANTE: n8nLimiter JA esta aplicado - NAO aplicar generalLimiter aqui!
app.use('/api/n8n', n8nLimiter, n8nRoutes);

// Media serving (público - IDs únicos não sequenciais, rate limited por IP)
app.use('/api/media', mediaRoutes);

// Health check (completo com database/redis)
app.use('/api', healthRoutes);

// Debug routes (apenas desenvolvimento)
app.use('/api/debug', debugRoutes);

// Rate limiting geral para rotas da API
// IMPORTANTE: Excluir rotas que já têm rate limiter próprio (N8N, media, health, debug)
app.use('/api', (req, res, next) => {
  // Rotas com rate limiter próprio - NÃO aplicar generalLimiter
  const excludedPaths = ['/api/n8n', '/api/media', '/api/health', '/api/debug'];
  const shouldSkip = excludedPaths.some(path => req.originalUrl.startsWith(path));

  if (shouldSkip) {
    return next();
  }

  // Aplicar rate limit geral para demais rotas
  generalLimiter(req, res, next);
});

// API protegida (com tenant)
app.use('/api/tenants', tenantRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/usage-tracking', usageTrackingRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/webhook-events', webhookEventRoutes);

// Root API info
app.get('/api', (req, res) => {
  res.json({
    message: 'Bot Reserva Hotéis API',
    version: '1.0.0',
    tenant: req.tenant?.slug || 'No tenant',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler (deve vir antes do error handler)
app.use(notFoundHandler);

// Global error handler (deve ser o último middleware)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Test Redis connection
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      throw new Error('Failed to connect to Redis');
    }

    // Initialize Socket.io
    initializeSocketIO(httpServer);
    logger.info('✅ Socket.io initialized');

    // Register Bull workers (para processar filas)
    registerWorkers();
    logger.info('✅ Queue workers registered');

    // Start HTTP server (Express + Socket.io)
    const PORT = parseInt(env.PORT);

    httpServer.listen(PORT, () => {
      logger.info(`
      ╔════════════════════════════════════════╗
      ║  🏨 Bot Reserva Hotéis - Backend API  ║
      ║                                        ║
      ║  Environment: ${env.NODE_ENV.padEnd(24)}║
      ║  Port: ${PORT.toString().padEnd(31)}║
      ║  Database: ✅  Connected               ║
      ║  Redis: ✅  Connected                  ║
      ║  Socket.io: ✅  Initialized            ║
      ║  Workers: ✅  Registered               ║
      ╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing server');
  process.exit(0);
});

// Start!
startServer();

export default app;
