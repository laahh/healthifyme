# syntax=docker/dockerfile:1
# Multi-stage: build Vite app, serve static files with nginx.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL yang dipakai browser untuk memanggil API (disematkan saat build oleh Vite).
ARG VITE_API_URL=http://localhost:8787
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_SUPABASE_URL=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

ARG VITE_GEMINI_API_KEY=
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
