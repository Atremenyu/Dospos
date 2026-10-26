# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Ensure directories for Railway volume mounts exist
RUN mkdir -p /app/data /data
EXPOSE 3000
# Run node directly so SIGTERM/SIGINT are handled gracefully without npm errors
CMD ["node", "dist/server.cjs"]

