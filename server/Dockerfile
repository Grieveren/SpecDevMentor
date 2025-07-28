# Multi-stage build for Node.js server
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY server/prisma ./server/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY server/src ./server/src/
COPY server/tsconfig.json ./server/

# Generate Prisma client
RUN cd server && pnpm db:generate

# Build the application
RUN cd server && pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY server/prisma ./server/prisma/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=base /app/server/dist ./server/dist/
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma/

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/dist/index.js"]