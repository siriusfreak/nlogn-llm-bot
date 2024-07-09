FROM node:20-alpine3.17

COPY . /app
WORKDIR /app
RUN npm install
RUN npm i typescript --save-dev
ENTRYPOINT ["npm", "start"]
