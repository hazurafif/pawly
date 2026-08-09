# Screenshot harness: exports the Expo web app statically, then captures
# every app route with Playwright (Chromium), matching the installed
# browser version. Run via scripts/screenshots/shot.sh (host side), which
# mounts ../../assets/screenshots at /out.
FROM mcr.microsoft.com/playwright:v1.54.0-noble

WORKDIR /workspace

COPY app/ ./app/
COPY scripts/screenshots/ ./run/

RUN cd app \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate \
  && pnpm install --frozen-lockfile \
  && CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_PAWLY_AUTO_DETECT=false npx expo export --platform web \
  && cd /workspace/run \
  && pnpm install --no-frozen-lockfile

CMD ["bash", "/workspace/run/run.sh"]
