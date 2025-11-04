# ============================================
# Multi-stage Dockerfile for Node.js Backend
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy source code
COPY . .

# Generate Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm and dumb-init (for proper signal handling)
RUN npm install -g pnpm@8.15.0 && \
    apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
