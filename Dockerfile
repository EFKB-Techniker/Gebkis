FROM nginx:alpine
COPY app /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
