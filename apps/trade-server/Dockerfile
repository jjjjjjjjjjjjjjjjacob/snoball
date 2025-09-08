# Fly.io optimized Dockerfile for Snoball Trade Server
FROM oven/bun:1-alpine AS base

# Install curl for health checks (Fly.io requirement)
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy root package files for workspace support
COPY ../../package.json ../../bun.lockb ./
COPY ../../bunfig.toml ./

# Copy package files for monorepo
COPY package.json ./apps/trade-server/
COPY ../../packages/*/package.json ./packages/*/

# Install all dependencies (including workspaces)
RUN bun install --frozen-lockfile

# Copy source code
COPY . ./apps/trade-server/
COPY ../../packages ./packages/

# Set working directory to trade server
WORKDIR /app/apps/trade-server

# Build the application (no build step needed for TypeScript with Bun)
# Bun can run TypeScript directly in production

# Production stage - optimized for Fly.io
FROM oven/bun:1-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bun -u 1001 -G nodejs

WORKDIR /app

# Copy application files
COPY --from=base --chown=bun:nodejs /app ./

# Set working directory to trade server
WORKDIR /app/apps/trade-server

# Switch to non-root user
USER bun

# Expose port (Fly.io expects this)
EXPOSE 9090

# Health check for Fly.io
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:9090/health || exit 1

# Set environment
ENV NODE_ENV=production
ENV PORT=9090

# Start the application (Bun can run TS directly)
CMD ["bun", "run", "src/index.ts"]
