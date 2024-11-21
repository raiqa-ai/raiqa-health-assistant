FROM ubuntu:jammy-20240627.1

RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    apt-get install -y nodejs yarn && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
CMD ["yarn", "start"]