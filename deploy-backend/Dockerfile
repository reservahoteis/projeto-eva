# ============================================
# Standalone Dockerfile for Backend Only
# Use this for VPS deployment (no monorepo needed)
# ============================================

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (bcrypt, Prisma, etc)
RUN apk add --no-cache python3 make g++ openssl

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies using npm (this will compile native modules for alpine)
RUN npm ci || npm install

# Copy source code and prisma
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy node_modules from builder (includes compiled native modules)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application and necessary files
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
