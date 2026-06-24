FROM node:22-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --legacy-peer-deps
COPY app/ ./
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist/trinkgeld-rechner/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
