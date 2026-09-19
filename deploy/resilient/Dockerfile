FROM node:22.22.0-alpine3.23

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY tools/resilient-web ./tools/resilient-web

USER node
EXPOSE 8787
CMD ["node", "tools/resilient-web/gateway.mjs"]
