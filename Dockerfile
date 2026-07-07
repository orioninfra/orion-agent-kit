# Orion MCP server — container alternative to the systemd unit.
# Build & run:
#   docker compose up -d --build
# or without compose:
#   docker build -t orion-mcp . && docker run -d -p 127.0.0.1:8791:8791 orion-mcp
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY tsconfig.json ./
ENV PORT=8791 HOST=0.0.0.0 NODE_ENV=production
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD wget -qO- http://127.0.0.1:8791/healthz || exit 1
USER node
CMD ["npx", "tsx", "src/server.ts"]
