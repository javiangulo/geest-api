# ─── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests and configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN pnpm install --frozen-lockfile

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript (/app/dist)
RUN pnpm run build

# ─── Stage 2: Production Runner (Cloud Run Ready) ──────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Cloud Run defaults: Cloud Run injects PORT (default 8080)
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests and install only production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user (built-in 'node' user in official Node images)
USER node

# Default port for Google Cloud Run (can be overridden by the runtime PORT env var)
EXPOSE 8080

# Execute Node directly to ensure SIGTERM / SIGINT signals are received for graceful shutdown
CMD ["node", "dist/src/index.js"]
