# Stage 1: Build
FROM node:20-alpine AS build-stage

WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 执行构建
# 注意：构建时可能需要注入环境变量，比如 VITE_API_BASE_URL
# 如果没有注入，默认会使用 /api (在 nginx 中配置代理)
RUN npm run build-only

# Stage 2: Serve
FROM nginx:stable-alpine AS production-stage

# 从构建阶段复制静态文件
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
