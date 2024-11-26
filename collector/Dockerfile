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

# Create startup script that handles directory creation and permissions
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

# Copy and install application
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

USER raiqaAssistant
ENV NODE_ENV=production

CMD ["/startup.sh"]