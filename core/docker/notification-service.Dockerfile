FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./
COPY workspace.json ./

RUN npm ci

COPY apps/notification-service ./apps/notification-service
COPY libs ./libs

RUN npx nx build notification-service

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist/apps/notification-service ./dist

ENV NODE_ENV=production

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "dist/main.js"]
