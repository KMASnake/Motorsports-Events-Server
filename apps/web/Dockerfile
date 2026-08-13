FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web apps/web
RUN npm run build --workspace @mse/web

FROM nginx:1.29-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ARG VITE_API_URL=http://localhost:3001
COPY apps/web/nginx.conf /tmp/default.conf.template
RUN case "$VITE_API_URL" in http://*|https://*) ;; *) echo "VITE_API_URL must be HTTP(S)" >&2; exit 1;; esac \
    && sed "s|__API_ORIGIN__|$VITE_API_URL|g" /tmp/default.conf.template >/etc/nginx/conf.d/default.conf \
    && rm /tmp/default.conf.template
EXPOSE 3000
