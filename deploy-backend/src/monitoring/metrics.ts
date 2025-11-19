/**
 * Prometheus metrics for application monitoring
 * Provides comprehensive metrics for performance, business, and technical monitoring
 */

import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import logger from '@/config/logger';

// ============================================
// HTTP Metrics
// ============================================

/**
 * HTTP request duration histogram
 * Tracks request latency by method, route, and status
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // seconds
});

/**
 * Total HTTP requests counter
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant'],
});

/**
 * Active HTTP requests gauge
 */
export const httpRequestsActive = new Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
});

// ============================================
// Business Metrics
// ============================================

/**
 * Messages sent counter
 */
export const messagesSentTotal = new Counter({
  name: 'messages_sent_total',
  help: 'Total number of messages sent',
  labelNames: ['tenant', 'type', 'status', 'direction'],
});

/**
 * Conversations created counter
 */
export const conversationsTotal = new Counter({
  name: 'conversations_total',
  help: 'Total number of conversations',
  labelNames: ['tenant', 'status', 'priority'],
});

/**
 * Active conversations gauge
 */
export const conversationsActive = new Gauge({
  name: 'conversations_active',
  help: 'Number of active conversations',
  labelNames: ['tenant', 'status'],
});

/**
 * User sessions gauge
 */
export const userSessionsActive = new Gauge({
  name: 'user_sessions_active',
  help: 'Number of active user sessions',
  labelNames: ['tenant', 'role'],
});

/**
 * Revenue metrics (for billing)
 */
export const revenueTotal = new Counter({
  name: 'revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['tenant', 'plan', 'currency'],
});

// ============================================
// WebSocket Metrics
// ============================================

/**
 * Active WebSocket connections
 */
export const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['tenant', 'namespace'],
});

/**
 * WebSocket messages counter
 */
export const websocketMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['tenant', 'event', 'direction'],
});

// ============================================
// Queue Metrics
// ============================================

/**
 * Queue job processing duration
 */
export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // seconds
});

/**
 * Queue jobs counter
 */
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'job_type', 'status'],
});

/**
 * Queue size gauge
 */
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
});

// ============================================
// Database Metrics
// ============================================

/**
 * Database query duration
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'model', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2], // seconds
});

/**
 * Database connection pool
 */
export const dbConnectionPool = new Gauge({
  name: 'db_connection_pool',
  help: 'Database connection pool status',
  labelNames: ['status'], // active, idle, waiting
});

// ============================================
// External API Metrics
// ============================================

/**
 * WhatsApp API call duration
 */
export const whatsappApiDuration = new Histogram({
  name: 'whatsapp_api_duration_seconds',
  help: 'Duration of WhatsApp API calls',
  labelNames: ['endpoint', 'method', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // seconds
});

/**
 * WhatsApp API calls counter
 */
export const whatsappApiCallsTotal = new Counter({
  name: 'whatsapp_api_calls_total',
  help: 'Total number of WhatsApp API calls',
  labelNames: ['endpoint', 'method', 'status', 'tenant'],
});

/**
 * WhatsApp API errors
 */
export const whatsappApiErrors = new Counter({
  name: 'whatsapp_api_errors_total',
  help: 'Total number of WhatsApp API errors',
  labelNames: ['error_code', 'tenant'],
});

// ============================================
// System Metrics
// ============================================

/**
 * Memory usage gauge
 */
export const memoryUsage = new Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Node.js memory usage',
  labelNames: ['type'], // rss, heapTotal, heapUsed, external
});

/**
 * Event loop lag
 */
export const eventLoopLag = new Histogram({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Node.js event loop lag',
  buckets: [0.001, 0.01, 0.1, 1],
});

/**
 * Garbage collection duration
 */
export const gcDuration = new Histogram({
  name: 'nodejs_gc_duration_seconds',
  help: 'Garbage collection duration',
  labelNames: ['type'],
});

// ============================================
// Error Metrics
// ============================================

/**
 * Application errors counter
 */
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'severity', 'tenant'],
});

/**
 * Unhandled rejections counter
 */
export const unhandledRejectionsTotal = new Counter({
  name: 'unhandled_rejections_total',
  help: 'Total number of unhandled promise rejections',
});

// ============================================
// Rate Limiting Metrics
// ============================================

/**
 * Rate limit hits counter
 */
export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['limiter', 'tenant'],
});

// ============================================
// Authentication Metrics
// ============================================

/**
 * Login attempts counter
 */
export const loginAttempts = new Counter({
  name: 'login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status', 'method'], // success, failed, method: password, oauth, etc
});

/**
 * Active sessions gauge
 */
export const activeSessions = new Gauge({
  name: 'active_sessions',
  help: 'Number of active user sessions',
  labelNames: ['tenant', 'role'],
});

// ============================================
// Middleware
// ============================================

/**
 * Express middleware to collect HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const route = req.route?.path || req.path || 'unknown';

    // Track active requests
    httpRequestsActive.inc({ method: req.method, route });

    // Track response
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
        tenant: req.tenantId || 'none',
      };

      // Record metrics
      httpRequestDuration.observe(labels, duration);
      httpRequestsTotal.inc(labels);
      httpRequestsActive.dec({ method: req.method, route });

      // Log slow requests
      if (duration > 1) {
        logger.warn({
          method: req.method,
          route,
          duration,
          status: res.statusCode,
        }, 'Slow request detected');
      }
    });

    next();
  };
}

/**
 * Collect system metrics periodically
 */
export function collectSystemMetrics() {
  setInterval(() => {
    const memUsage = process.memoryUsage();

    memoryUsage.set({ type: 'rss' }, memUsage.rss);
    memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    memoryUsage.set({ type: 'external' }, memUsage.external);

    // Measure event loop lag
    const start = process.hrtime();
    setImmediate(() => {
      const delta = process.hrtime(start);
      const lag = delta[0] + delta[1] / 1e9;
      eventLoopLag.observe(lag);
    });
  }, 10000); // Every 10 seconds
}

/**
 * Express endpoint to expose metrics for Prometheus
 */
export async function metricsEndpoint(req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics');
    res.status(500).end('Failed to generate metrics');
  }
}

/**
 * Initialize metrics collection
 */
export function initializeMetrics() {
  // Collect default Node.js metrics
  const collectDefaultMetrics = require('prom-client').collectDefaultMetrics;
  collectDefaultMetrics({ register });

  // Start collecting system metrics
  collectSystemMetrics();

  logger.info('Metrics collection initialized');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Track a business event
 */
export function trackBusinessEvent(
  event: string,
  tenant: string,
  metadata?: Record<string, any>
) {
  logger.info({
    event,
    tenant,
    ...metadata,
  }, 'Business event tracked');

  // You can add specific counters based on event type
  switch (event) {
    case 'message_sent':
      messagesSentTotal.inc({
        tenant,
        type: metadata?.type || 'text',
        status: metadata?.status || 'sent',
        direction: metadata?.direction || 'outbound',
      });
      break;

    case 'conversation_created':
      conversationsTotal.inc({
        tenant,
        status: metadata?.status || 'open',
        priority: metadata?.priority || 'medium',
      });
      break;

    // Add more cases as needed
  }
}

/**
 * Track an error
 */
export function trackError(
  error: Error,
  severity: 'low' | 'medium' | 'high' | 'critical',
  tenant?: string
) {
  errorsTotal.inc({
    type: error.name || 'UnknownError',
    severity,
    tenant: tenant || 'none',
  });

  logger.error({
    error: error.message,
    stack: error.stack,
    severity,
    tenant,
  }, 'Error tracked');
}