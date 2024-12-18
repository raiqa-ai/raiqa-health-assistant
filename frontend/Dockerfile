FROM node:18-slim as builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ENV VITE_API_BASE=https://raiqa-health-assistant-qa-svr.whitedesert-4dbc0075.australiaeast.azurecontainerapps.io/api

RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
