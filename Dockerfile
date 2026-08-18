# ==============================================================================
# Cloudflare R2 Storage Manager - Production Dockerfile
# Lightweight, Multi-Stage Node.js Alpine Container (< 150MB)
# ==============================================================================

# --- Stage 1: Build Dependencies ---
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Run container as non-root user for enhanced security
USER node

# Copy production node_modules and project files
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

# Expose HTTP port
EXPOSE 3000

# Health check to ensure service is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/status || exit 1

# Start the application
CMD ["node", "server.js"]
