# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
RUN npm install
COPY . .
ENV DATABASE_URL="file:../data/schichtklar.db"
WORKDIR /app/backend
RUN npx prisma generate
WORKDIR /app
RUN npm run build -w frontend && npm run build -w backend

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    API_PORT=8080 \
    APP_URL=http://localhost:8080 \
    DATABASE_URL="file:../data/schichtklar.db" \
    DEMO_MODE=true
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
WORKDIR /app/backend
EXPOSE 8080
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
