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

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/next.config.mjs /app/next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
