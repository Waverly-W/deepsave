FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci

FROM deps AS builder

WORKDIR /app
COPY . /app
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public /app/public
COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static

EXPOSE 3000

CMD ["node", "server.js"]
