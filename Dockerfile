# Dockerfile for motea with embedded PostgreSQL
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

# Build arguments
ARG BUILDTIME
ARG VERSION
ARG REVISION

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files and npm configuration
COPY package.json .npmrc ./

# Install production dependencies only
RUN npm install --only=production --ignore-scripts && npm cache clean --force

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies needed for building
RUN apk add --no-cache libc6-compat

# Copy package files and npm configuration
COPY package.json .npmrc ./

# Install all dependencies (including devDependencies)
RUN npm install --ignore-scripts && npm cache clean --force

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER=true

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public directory
COPY --from=builder /app/public ./public

# Set correct permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Add build metadata as labels
LABEL org.opencontainers.image.title="motea"
LABEL org.opencontainers.image.description="A note-taking application based on Notea"
LABEL org.opencontainers.image.version="${VERSION:-latest}"
LABEL org.opencontainers.image.created="${BUILDTIME:-unknown}"
LABEL org.opencontainers.image.revision="${REVISION:-main}"
LABEL org.opencontainers.image.source="https://github.com/waycaan/motea-docker"
LABEL org.opencontainers.image.authors="waycaan"
LABEL org.opencontainers.image.licenses="MIT"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
