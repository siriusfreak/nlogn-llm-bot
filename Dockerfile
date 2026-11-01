FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . .

# Numeric, so runAsNonRoot can verify it (uid 1000 is "node" in the base image).
USER 1000:1000
ENTRYPOINT ["npm", "start"]
