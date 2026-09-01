FROM node:20-alpine
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm install

# Copy all files (except those in .dockerignore)
COPY . .

# Build step (if using TypeScript)
RUN npm run build

# Explicitly expose port 8080 (Fly.io uses this by default)
EXPOSE 8080

# Use node directly instead of npm for better signal handling
CMD ["node", "dist/index.js"]  # Adjust path to your entry file
