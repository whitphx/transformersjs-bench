FROM node:22-slim

# Install dependencies for Playwright browsers
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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy bench package files
COPY bench/package*.json ./bench/

# Install dependencies
WORKDIR /app/bench
RUN npm ci

# Install Playwright browsers
RUN npx playwright install chromium firefox webkit

# Copy source code
WORKDIR /app
COPY bench/ ./bench/

# Expose port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7860/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
WORKDIR /app/bench
CMD ["npm", "run", "server"]
