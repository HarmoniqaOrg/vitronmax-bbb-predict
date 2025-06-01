# Stage 1: Build the Vite/React application
ARG NODE_VERSION=18.18.0
FROM node:${NODE_VERSION}-slim as builder

LABEL fly_launch_runtime="NodeJS"
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock, pnpm-lock.yaml)
# Ensure package-lock.json is committed to your repository for reproducible builds
COPY package.json package-lock.json* ./
# If you use yarn:
# COPY package.json yarn.lock ./
# RUN yarn install --frozen-lockfile
# If you use pnpm:
# COPY package.json pnpm-lock.yaml ./
# RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Install dependencies using npm ci for cleaner, faster, and more reliable builds in CI
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Make VITE_API_URL build argument available as an environment variable
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the application (this creates the /app/dist folder)
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the built assets from the 'builder' stage's /app/dist directory
COPY --from=builder /app/dist /usr/share/nginx/html/

# Copy custom Nginx configuration
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY wasm_mime.conf /etc/nginx/conf.d/wasm_mime.conf

# Expose port 80 (nginx default)
EXPOSE 80

# Start nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
