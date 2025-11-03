FROM nginx:alpine

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos do frontend
COPY ./src /usr/share/nginx/html

# Expor porta 3000
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
