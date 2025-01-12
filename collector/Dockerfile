FROM ubuntu:jammy-20240627.1

# Install required packages
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn && \
    rm -rf /var/lib/apt/lists/*

# Create raiqaAssistant user and group
RUN groupadd -r raiqaAssistant && \
    useradd -r -g raiqaAssistant -d /app raiqaAssistant

WORKDIR /app

# Create necessary directories
RUN mkdir -p collector shared/pdf && \
    chown -R raiqaAssistant:raiqaAssistant /app

# Copy shared files first
COPY shared /app/shared/
RUN echo "Shared files copied to /app/shared/"
RUN ls -la /app/shared/
RUN echo "Contents of /app/shared/pdf:"
RUN ls -la /app/shared/pdf/
RUN echo "Contents of PDFLoader.js:"
RUN cat /app/shared/pdf/PDFLoader.js || echo "PDFLoader.js not found!"

# Copy collector files
COPY collector /app/collector/
RUN echo "Collector files copied to /app/collector/"
RUN ls -la /app/collector/

# Set working directory for collector
WORKDIR /app/collector

# Install dependencies
RUN echo "Installing dependencies..."
RUN yarn install --frozen-lockfile
RUN echo "Dependencies installed"

# After yarn install
RUN echo "Checking node_modules:"
RUN ls -la node_modules/uuid || echo "uuid module not found!"
RUN ls -la node_modules/pdf-parse || echo "pdf-parse module not found!"

# Create startup script
RUN echo '#!/bin/bash' > /startup.sh && \
    echo 'echo "Starting collector service..."' >> /startup.sh && \
    echo 'cd /app/collector' >> /startup.sh && \
    echo 'NODE_ENV=production node index.js' >> /startup.sh && \
    chmod +x /startup.sh

USER raiqaAssistant
ENV NODE_ENV=production

CMD ["/startup.sh"]
