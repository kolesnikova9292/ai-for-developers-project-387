FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm config set strict-ssl false && npm install --include=dev --no-audit --no-fund --registry=https://registry.npmjs.org/ --package-lock=false

COPY frontend/ ./
RUN npm run build -- --configuration production

FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm config set strict-ssl false && npm install --no-audit --no-fund --registry=https://registry.npmjs.org/ --package-lock=false @stoplight/prism-cli@^5.14.2

COPY tsp-output ./tsp-output

COPY server.js ./server.js
COPY --from=frontend-build /app/frontend/dist/frontend ./frontend-dist

ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "./node_modules/.bin/prism mock tsp-output/@typespec/openapi3/openapi.yaml --port 4010 --cors & node server.js"]
