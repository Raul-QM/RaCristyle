FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    TZ=America/Costa_Rica
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY database ./database
COPY scripts ./scripts
COPY src ./src
COPY public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]
