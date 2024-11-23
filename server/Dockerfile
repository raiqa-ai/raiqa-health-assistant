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

# Create startup script with more detailed diagnostics
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "=== System Information ==="\n\
date\n\
id\n\
echo\n\
\n\
echo "=== Pre-start Directory Check ==="\n\
# Try to create directories if they do not exist\n\
mkdir -p /app/server/storage/documents || true\n\
mkdir -p /app/server/storage/vector-cache || true\n\
mkdir -p /app/server/storage/lancedb || true\n\
mkdir -p /app/server/storage/assets/pfp || true\n\
touch /app/server/storage/raiqaAssistant.db || true\n\
\n\
echo "=== Directory Structure ==="\n\
ls -la /app/server/storage || true\n\
ls -la /app/server/storage/documents || true\n\
ls -la /app/server/storage/vector-cache || true\n\
ls -la /app/server/storage/lancedb || true\n\
ls -la /app/server/storage/assets || true\n\
echo\n\
\n\
echo "=== Mount Information ==="\n\
mount | grep cifs || true\n\
df -h\n\
echo\n\
\n\
echo "=== File Permissions ==="\n\
ls -la /app/server/storage/raiqaAssistant.db || true\n\
echo\n\
\n\
echo "=== Environment Variables ==="\n\
env | grep -v "PASSWORD\|KEY\|SECRET"\n\
echo\n\
\n\
echo "=== Starting Application ==="\n\
exec yarn start\n\
' > /startup.sh

RUN chmod +x /startup.sh

USER raiqaAssistant
ENV NODE_ENV=production
EXPOSE 3001

CMD ["/startup.sh"]