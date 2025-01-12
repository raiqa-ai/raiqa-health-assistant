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

# Create necessary directories and set permissions
RUN mkdir -p collector && \
    chown -R raiqaAssistant:raiqaAssistant /app

# Copy collector files
COPY collector /app/collector/
RUN chown -R raiqaAssistant:raiqaAssistant /app/collector

# Set working directory for collector
WORKDIR /app/collector

# Install dependencies
RUN echo "Installing dependencies..." && \
    yarn install --frozen-lockfile && \
    echo "Dependencies installed"

# Create startup script
RUN echo '#!/bin/bash' > /startup.sh && \
    echo 'echo "Starting collector service..."' >> /startup.sh && \
    echo 'cd /app/collector' >> /startup.sh && \
    echo 'NODE_ENV=production node index.js' >> /startup.sh && \
    chmod +x /startup.sh && \
    chown raiqaAssistant:raiqaAssistant /startup.sh

USER raiqaAssistant
ENV NODE_ENV=production

CMD ["/startup.sh"]
