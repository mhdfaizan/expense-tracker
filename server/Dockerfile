FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]
