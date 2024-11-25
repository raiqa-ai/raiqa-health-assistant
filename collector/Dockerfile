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
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Create necessary directories and set permissions during build
RUN mkdir -p /app/collector/hotdir/documents \
    /app/collector/hotdir/vector-cache \
    /app/collector/hotdir/lancedb \
    /app/collector/hotdir/comkey && \
    touch /app/collector/hotdir/raiqaAssistant.db && \
    chown -R raiqaAssistant:raiqaAssistant /app

# Create startup script with diagnostics
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "=== System Information ==="\n\
date\n\
id\n\
echo\n\
\n\
echo "=== Directory Structure ==="\n\
ls -la /app/collector/hotdir\n\
ls -la /app/collector/hotdir/documents\n\
ls -la /app/collector/hotdir/vector-cache\n\
ls -la /app/collector/hotdir/lancedb\n\
ls -la /app/collector/hotdir/comkey\n\
echo\n\
\n\
echo "=== File Permissions ==="\n\
ls -la /app/collector/hotdir/raiqaAssistant.db\n\
echo\n\
\n\
echo "=== Environment Variables ==="\n\
env | grep -v "PASSWORD\\|KEY\\|SECRET"\n\
echo\n\
\n\
echo "=== Starting Application ==="\n\
exec yarn start\n\
' > /startup.sh

RUN chmod +x /startup.sh

USER raiqaAssistant
ENV NODE_ENV=production

CMD ["/startup.sh"]