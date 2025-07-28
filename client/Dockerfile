# Multi-stage build for React client
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY client/src ./client/src/
COPY client/public ./client/public/
COPY client/index.html ./client/
COPY client/vite.config.ts ./client/
COPY client/tsconfig.json ./client/
COPY client/tailwind.config.js ./client/
COPY client/postcss.config.js ./client/

# Build the application
RUN cd client && pnpm build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy nginx configuration
COPY client/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=base /app/client/dist /usr/share/nginx/html

# Create nginx user
RUN addgroup -g 1001 -S nginx
RUN adduser -S nginx -u 1001

# Set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html
RUN chown -R nginx:nginx /var/cache/nginx
RUN chown -R nginx:nginx /var/log/nginx
RUN chown -R nginx:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]