# Build stage: static Expo web export.
FROM node:24-alpine AS build
WORKDIR /app

# ARG is baked into the bundle by expo export (EXPO_PUBLIC_* inlining).
# Point it at the host-reachable backend, e.g. http://localhost:8080.
ARG EXPO_PUBLIC_PAWLY_URL=
ENV EXPO_PUBLIC_PAWLY_URL=$EXPO_PUBLIC_PAWLY_URL
ENV CI=1

RUN npm install -g pnpm@11.18.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec expo export --platform web

# Runtime stage: serve the static export with nginx.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
