# Build from repo root: docker build -f packages/mcp/Dockerfile .

FROM node:22-slim
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/mcp/package.json packages/mcp/

COPY packages/core packages/core
COPY packages/mcp packages/mcp

RUN npm install --omit=dev --workspace=@llm-wiki/mcp --no-audit --no-fund

WORKDIR /app/packages/mcp

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production \
    PORT=8086

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 8086
CMD ["node", "http.mjs"]
