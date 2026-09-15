# 遇见 · 生产镜像。web 与 profile-worker 共用同一个镜像，由启动命令区分。
# 注意：不写 # syntax= 指令——BuildKit 用内置前端即可，避免构建机访问 auth.docker.io。

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期不连数据库：这里只给占位值，满足模块加载时的环境变量存在性
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV TOKEN_ENCRYPTION_KEY=build-only-placeholder
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system nextjs \
    && useradd --system --gid nextjs nextjs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
# 画像产物与提取缓存的可写目录：容器以非 root 运行，必须预建并授权
RUN mkdir -p /app/profile-output /app/data/crawler \
    && chown -R nextjs:nextjs /app/profile-output /app/data
USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start:all"]
