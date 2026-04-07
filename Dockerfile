# ──────────────────────────────────────────────────────────────────────────────
# ISME v2 Backend — Multi-stage Dockerfile
# ──────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build


# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8081
ENV DATA_PATH=/data

# Runtime dependency for healthcheck probe
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 1001 nodejs \
  && useradd -m -u 1001 -g nodejs isme

# Install production deps only
COPY package.json package-lock.json ./
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
  CMD curl -fsS http://127.0.0.1:8081/health || exit 1

# Start
CMD ["node", "dist/Index.js"]
