# Playwright's image ships Chromium plus the fonts and codecs Meet needs.
FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app
ENV NODE_ENV=production PORT=8090 HEADLESS=false

# Xvfb gives Chrome a real display: Meet is less suspicious of headed Chrome
# and media pipelines behave the same as on a desktop.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci --include=dev
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

EXPOSE 8090
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x800x24", "node", "dist/server.js"]
