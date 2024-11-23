FROM ubuntu:jammy-20240627.1

# Install required packages
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    apt-get install -y curl cifs-utils iproute2 iputils-ping net-tools && \
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

# Create required directories and set permissions
RUN mkdir -p /app/server/storage/documents \
            /app/server/storage/vector-cache \
            /app/server/storage/lancedb \
            /app/server/storage/assets/pfp && \
    touch /app/server/storage/raiqaAssistant.db && \
    chown -R raiqaAssistant:raiqaAssistant /app

ENV NODE_ENV=production
EXPOSE 3001

# Create startup script with more detailed diagnostics
RUN echo '#!/bin/bash\n\
echo "=== System Information ==="\n\
date\n\
id\n\
echo\n\
\n\
echo "=== Directory Structure ==="\n\
ls -la /app/server/storage\n\
ls -la /app/server/storage/documents\n\
ls -la /app/server/storage/vector-cache\n\
ls -la /app/server/storage/lancedb\n\
ls -la /app/server/storage/assets\n\
echo\n\
\n\
echo "=== Mount Information ==="\n\
mount | grep cifs\n\
df -h\n\
echo\n\
\n\
echo "=== File Permissions ==="\n\
ls -la /app/server/storage/raiqaAssistant.db\n\
echo\n\
\n\
echo "=== Network Information ==="\n\
ip addr\n\
echo\n\
\n\
echo "=== Starting Application ==="\n\
exec yarn start\n\
' > /startup.sh

RUN chmod +x /startup.sh
USER raiqaAssistant
CMD ["/startup.sh"]