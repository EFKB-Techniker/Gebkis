FROM node:18

WORKDIR /workspaces/Gebkis

COPY package*.json ./
RUN npm install

COPY app ./app

EXPOSE 3000

CMD ["node", "app/js/server.js"]
