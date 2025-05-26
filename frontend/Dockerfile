# Use a lightweight nginx image
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the built Vite app (from the 'dist' folder) to nginx's web root.
# Your CI pipeline should run 'npm run build' to create the 'dist' folder
# before 'flyctl deploy' builds this Docker image.
COPY dist/ /usr/share/nginx/html/

# Expose port 80 (nginx default)
EXPOSE 80

# Start nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
