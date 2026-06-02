# Stage 1: Build the React (Vite) Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Create the Lightweight production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Copy server package files and install production dependencies
COPY server/package*.json ./server/
RUN npm ci --prefix server --only=production

# Copy server source code
COPY server/ ./server/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose the application port
EXPOSE 5000

# Command to run the application
CMD ["node", "server/index.js"]
