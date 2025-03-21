FROM nginx:alpine

# Copy the pre-built static files
COPY public/ /usr/share/nginx/html/

# Configure nginx to listen on port 9034
RUN sed -i 's/listen\s*80;/listen 9034;/g' /etc/nginx/conf.d/default.conf

# Expose port 9034
EXPOSE 9034

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 