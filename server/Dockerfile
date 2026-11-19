# Manuver API — production image.
#   docker build -t manuver-api ./server
#   docker run --env-file server/.env.production -p 4000:4000 manuver-api
# On start it applies pending database migrations, then serves the API on $PORT (default 4000).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src
# `prisma generate` reads the config, which wants a URL; nothing connects at build time.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts package.json ./
# Only used with STORAGE_DRIVER=local; production photos go to the bucket.
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
