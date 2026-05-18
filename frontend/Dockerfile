FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

FROM node:20-alpine AS builder

WORKDIR /app

ARG API_BASE_URL=http://backend1:8000
ARG WIKI_API_BASE_URL=http://backend2:8010
ARG NEXT_PUBLIC_API_BASE_URL=http://backend1:8000
ARG NEXT_PUBLIC_WIKI_API_BASE_URL=http://backend2:8010

ENV API_BASE_URL=${API_BASE_URL}
ENV WIKI_API_BASE_URL=${WIKI_API_BASE_URL}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WIKI_API_BASE_URL=${NEXT_PUBLIC_WIKI_API_BASE_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ARG API_BASE_URL=http://backend1:8000
ARG WIKI_API_BASE_URL=http://backend2:8010
ARG NEXT_PUBLIC_API_BASE_URL=http://backend1:8000
ARG NEXT_PUBLIC_WIKI_API_BASE_URL=http://backend2:8010

ENV NODE_ENV=production
ENV PORT=3000
ENV API_BASE_URL=${API_BASE_URL}
ENV WIKI_API_BASE_URL=${WIKI_API_BASE_URL}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WIKI_API_BASE_URL=${NEXT_PUBLIC_WIKI_API_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode >= 400) process.exit(1)}).on('error', () => process.exit(1))"

CMD ["npm", "run", "start"]