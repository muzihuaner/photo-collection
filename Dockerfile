FROM node:20-alpine

WORKDIR /app

# 复制依赖清单，利用缓存
COPY package*.json ./

RUN npm install --legacy-peer-deps

# 拷贝剩余源码并构建前端
COPY tsconfig.json vite.config.ts server.ts ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production

EXPOSE 6666

CMD ["npx", "tsx", "server.ts"]