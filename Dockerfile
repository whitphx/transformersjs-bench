FROM node:22-slim

# Install dependencies for Playwright browsers (including headed mode support)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    x11vnc \
    fluxbox \
    dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy bench package files
COPY bench/package*.json ./bench/

# Install dependencies
WORKDIR /app/bench
RUN npm ci

# Set Playwright browsers path to a shared location
ENV PLAYWRIGHT_BROWSERS_PATH=/app/playwright-browsers

# Install Playwright browsers to shared location
RUN npx playwright install chromium firefox webkit

# Copy source code
WORKDIR /app
COPY bench/ ./bench/

# Make startup script executable
RUN chmod +x /app/bench/start.sh

# Create writable directories for HF Spaces
RUN mkdir -p /tmp/vite-cache /tmp/bench-data && \
    chmod -R 777 /tmp/vite-cache /tmp/bench-data

# Expose port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7860/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment variables for writable paths
ENV VITE_CACHE_DIR=/tmp/vite-cache
ENV BENCHMARK_RESULTS_PATH=/tmp/bench-data/benchmark-results.jsonl

# Start the server
WORKDIR /app/bench
CMD ["./start.sh"]
