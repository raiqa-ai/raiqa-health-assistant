FROM ubuntu:jammy-20240627.1

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

# Create collector-specific directories
RUN mkdir -p /app/collector/hotdir/{comkey,documents,vector-cache,lancedb} && \
    touch /app/collector/hotdir/raiqaAssistant.db

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Set proper ownership and permissions
RUN chown -R raiqaAssistant:raiqaAssistant /app && \
    chmod -R 755 /app/collector/hotdir

USER raiqaAssistant
ENV NODE_ENV=production

CMD ["yarn", "start"]