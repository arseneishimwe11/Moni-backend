# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./
COPY workspace.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/auth-service ./apps/auth-service
COPY libs ./libs

# Build the application
RUN npx nx build auth-service

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist/apps/auth-service ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
