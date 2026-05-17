FROM node:20-alpine AS base

# ── deps: install all packages (including Sharp native bindings) ──────────────
FROM base AS deps
WORKDIR /app
# python3/make/g++ are needed to compile Sharp's native module on Alpine
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── builder: compile Next.js ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner: minimal production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public

# Sharp native module — standalone doesn't bundle native addons automatically.
# Sharp 0.33+ stores the actual native binary in @img/sharp-linux-musl-x64
# (Alpine uses musl libc). Both packages are required.
COPY --from=deps /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps /app/node_modules/@img  ./node_modules/@img

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
