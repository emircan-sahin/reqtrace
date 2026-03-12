FROM node:22-alpine AS builder
RUN npm install -g pnpm@10
WORKDIR /app

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

COPY packages/client packages/client
COPY packages/server packages/server

ENV VITE_SERVER_URL=""
RUN pnpm --filter @reqtrace/client build
RUN pnpm --filter @reqtrace/server build
RUN pnpm --filter @reqtrace/server deploy --legacy --prod /app/deploy

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/deploy/dist dist
COPY --from=builder /app/deploy/node_modules node_modules
COPY --from=builder /app/deploy/package.json .
COPY --from=builder /app/packages/client/dist public

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3100

EXPOSE 3100

CMD ["node", "dist/index.js"]
