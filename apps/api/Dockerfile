FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install
COPY apps/api apps/api
COPY packages/types packages/types
RUN npm run build --workspace @mse/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --omit=dev --workspace @mse/api
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 3001
CMD ["node","apps/api/dist/server.js"]
