FROM oven/bun:1.4.2 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
ENV HOST=0.0.0.0 PORT=3023 DATA_DIR=/data
RUN mkdir /data && chown bun:bun /data
USER bun
EXPOSE 3023
CMD ["bun", "src/server.js"]
