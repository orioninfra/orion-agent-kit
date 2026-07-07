# Orion MCP server — container alternative to the systemd unit.
# Build & run:  docker compose up -d   (see docker-compose.yml)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY tsconfig.json ./
ENV PORT=8791 HOST=0.0.0.0 NODE_ENV=production
EXPOSE 8791
USER node
CMD ["npx", "tsx", "src/server.ts"]
