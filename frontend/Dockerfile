FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json /app/
RUN npm ci

COPY app /app/app
COPY components /app/components
COPY lib /app/lib
COPY public /app/public
COPY middleware.ts /app/middleware.ts
COPY next-auth.d.ts /app/next-auth.d.ts
COPY next.config.mjs tsconfig.json next-env.d.ts postcss.config.js tailwind.config.ts /app/

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
