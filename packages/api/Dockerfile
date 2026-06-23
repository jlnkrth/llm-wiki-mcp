# Build from repo root: docker build -f packages/api/Dockerfile .

FROM node:22-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/mcp/package.json packages/mcp/

COPY packages/core packages/core
COPY packages/api packages/api

RUN npm install --omit=dev --workspace=@llm-wiki/api --no-audit --no-fund

RUN mkdir -p /root/.ssh && \
    printf "Host github.com\n  StrictHostKeyChecking accept-new\n  UserKnownHostsFile /root/.ssh/known_hosts\n  IdentityFile /root/.ssh/id_ed25519\n" > /root/.ssh/config && \
    chmod 700 /root/.ssh && chmod 600 /root/.ssh/config

RUN git config --global user.name "llm-wiki-api" \
 && git config --global user.email "llm-wiki-api@localhost" \
 && git config --global --add safe.directory "*"

WORKDIR /app/packages/api

ENV NODE_ENV=production \
    PORT=8085 \
    WIKI_CONTENT_DIR=/wiki

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 8085
CMD ["node", "server.mjs"]
