import 'express-async-errors'; // Deve ser a primeira importação!
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, isDev } from './config/env';
import { testDatabaseConnection } from './config/database';
import { testRedisConnection } from './config/redis';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.middleware';
import { tenantIsolationMiddleware } from './middlewares/tenant.middleware';
import { generalLimiter } from './middlewares/rate-limit.middleware';

// Create Express app
const app = express();

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development)
if (isDev) {
  app.use((req, res, next) => {
    logger.info({
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    next();
  });
}

// Rate limiting
app.use(generalLimiter);

// Tenant isolation (CRÍTICO)
app.use(tenantIsolationMiddleware);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
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
import webhookRoutes from './routes/webhook.routes';

// Auth (público - sem tenant isolation)
app.use('/auth', authRoutes);

// Webhooks (antes do tenant middleware para algumas rotas)
app.use('/webhooks', webhookRoutes);

// API protegida (com tenant)
app.use('/api/tenants', tenantRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Root API info
app.get('/api', (req, res) => {
  res.json({
    message: 'CRM WhatsApp SaaS API',
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

    // Start Express server
    const PORT = parseInt(env.PORT);

    app.listen(PORT, () => {
      logger.info(`
      ╔════════════════════════════════════════╗
      ║  🚀 CRM WhatsApp SaaS - Backend API   ║
      ║                                        ║
      ║  Environment: ${env.NODE_ENV.padEnd(24)}║
      ║  Port: ${PORT.toString().padEnd(31)}║
      ║  Database: ✅  Connected               ║
      ║  Redis: ✅  Connected                  ║
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
