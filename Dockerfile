# Nexora Media Processing - Dockerfile API
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
COPY src ./src
RUN npm ci && npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache curl dumb-init
WORKDIR /app
RUN addgroup -g 1001 -S nexora && adduser -u 1001 -S nexora -G nexora
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p /media/input /media/output /media/temp && \
    chown -R nexora:nexora /media /app
USER nexora
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health/live || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
