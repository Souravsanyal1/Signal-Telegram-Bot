# Use official Node.js runtime as a parent image
FROM node:18-alpine

# Cache buster - force fresh build
ARG BUILDKIT_INLINE_CACHE=1
ENV BUILD_DATE="2026-06-02"

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies - skip cache for clean install
RUN --mount=type=cache,target=/root/.npm npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["npm", "start"]
