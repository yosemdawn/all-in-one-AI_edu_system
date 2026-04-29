# 使用官方Python镜像作为基础镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖，用于图像处理
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY essay_grader/requirements.txt .

# 安装Python依赖
# 使用--no-cache-dir可以减小镜像体积
RUN pip install --no-cache-dir -r requirements.txt

# 复制整个应用代码到工作目录
COPY essay_grader/ .

# 暴露应用运行的端口
EXPOSE 8000

# 运行应用的命令
# 使用gunicorn作为生产环境的WSGI服务器
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]