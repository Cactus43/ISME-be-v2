# ──────────────────────────────────────────────────────────────────────────────
# ISME v2 Backend — Multi-stage Dockerfile
# ──────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build


# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_PATH=/data

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S isme -u 1001

# Install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Data volume for photos/documents
RUN mkdir -p /data && chown -R isme:nodejs /app /data
VOLUME ["/data"]

# Switch to non-root user
USER isme

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Start
CMD ["node", "dist/Index.js"]
