FROM nginx:alpine

RUN apk add --no-cache curl vim

RUN rm -rf /usr/share/nginx/html/*

COPY public/ /usr/share/nginx/html/

RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf


RUN nginx -t

EXPOSE 9034

CMD ["nginx", "-g", "daemon off;"]