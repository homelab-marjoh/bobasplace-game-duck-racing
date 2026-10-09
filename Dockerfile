FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Bun serves game.js and hosts the online race relay on /race (server/serve.ts)
FROM oven/bun:1-alpine AS production

WORKDIR /app

# The server imports the shared protocol and course list straight from src/
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src

ENV PORT=80
# Pages allowed to load game.js and join races (comma-separated)
ENV ALLOWED_ORIGINS=https://bobasplace.se
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- --timeout=2 http://localhost/game.js >/dev/null || exit 1

CMD ["bun", "server/serve.ts"]
