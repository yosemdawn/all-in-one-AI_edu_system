#!/bin/bash
# AI作文批阅系统 V2.0 - AWS EC2 部署脚本（无虚拟环境版本）
# 使用方式: sudo bash deploy/deploy-aws-no-venv.sh
# ⚠️ 警告：此脚本会将依赖安装到系统Python，不推荐用于生产环境

set -e

echo "=========================================="
echo "  AI作文批阅系统 V2.0 - AWS部署"
echo "  (无虚拟环境版本)"
echo "=========================================="
echo ""
echo "⚠️  警告：此脚本将依赖安装到系统Python"
echo "   推荐使用虚拟环境版本: deploy-aws.sh"
echo ""
read -p "确定继续吗？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消部署"
    exit 1
fi

# 配置变量
PROJECT_NAME="essay-grader-v2"
DEPLOY_DIR="/home/ubuntu/${PROJECT_NAME}"
USER="ubuntu"
GROUP="ubuntu"

# 检查是否以sudo运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

echo "📦 步骤 1/7: 安装系统依赖..."
apt-get update
apt-get install -y python3 python3-pip nginx git curl

echo ""
echo "📁 步骤 2/7: 创建部署目录..."
mkdir -p ${DEPLOY_DIR}
mkdir -p /var/log/essay-grader

echo ""
echo "📋 步骤 3/7: 复制项目文件..."
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$DEPLOY_DIR" ]; then
    echo "从 $CURRENT_DIR 复制文件到 $DEPLOY_DIR"
    cp -r backend ${DEPLOY_DIR}/
    
    if [ -d "frontend/dist" ]; then
        mkdir -p ${DEPLOY_DIR}/frontend
        cp -r frontend/dist ${DEPLOY_DIR}/frontend/
    else
        echo "⚠️  warning: frontend/dist 不存在"
        mkdir -p ${DEPLOY_DIR}/frontend/dist
    fi
    
    cp -r deploy ${DEPLOY_DIR}/
    
    mkdir -p ${DEPLOY_DIR}/data
    if [ -f "data/database.db" ]; then
        cp data/database.db ${DEPLOY_DIR}/data/
    fi
    if [ -f "data/students.json" ]; then
        cp data/students.json ${DEPLOY_DIR}/data/
    fi
fi

cd ${DEPLOY_DIR}

echo ""
echo "🐍 步骤 4/7: 安装Python依赖到系统..."
pip3 install --upgrade pip
pip3 install -r backend/requirements.txt

echo ""
echo "⚙️  步骤 5/7: 配置环境变量..."
if [ ! -f "backend/.env" ]; then
    echo "创建 .env 文件"
    if [ -f "deploy/.env.production" ]; then
        cp deploy/.env.production backend/.env
    fi
    echo "⚠️  警告: 请编辑 backend/.env 文件，填入API密钥"
fi

echo ""
echo "🗄️  步骤 6/7: 初始化数据库..."
cd backend
python3 -c "from app.database import init_db; init_db()" || echo "数据库已存在"
cd ..

echo ""
echo "🌐 步骤 7/7: 配置Nginx和服务..."

# 创建Nginx配置
cat > /etc/nginx/sites-available/essay-grader << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /home/ubuntu/essay-grader-v2/frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    location /uploads/ {
        alias /home/ubuntu/essay-grader-v2/data/uploads/;
        expires 1d;
    }
}
EOF

ln -sf /etc/nginx/sites-available/essay-grader /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo ""
echo "🚀 配置并启动服务..."

# 创建systemd服务（使用系统Python）
cat > /etc/systemd/system/essay-grader.service << EOF
[Unit]
Description=AI Essay Grader Backend Service
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/essay-grader-v2/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2

Restart=always
RestartSec=10

StandardOutput=append:/var/log/essay-grader/backend.log
StandardError=append:/var/log/essay-grader/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# 设置权限
chown -R ${USER}:${GROUP} ${DEPLOY_DIR}
chown -R ${USER}:${GROUP} /var/log/essay-grader
chmod -R 755 ${DEPLOY_DIR}

# 启动服务
systemctl daemon-reload
systemctl enable essay-grader
systemctl restart essay-grader
systemctl restart nginx

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "📊 服务状态:"
systemctl status essay-grader --no-pager -l
echo ""
echo "🌐 访问地址:"
echo "   http://$(curl -s ifconfig.me)"
echo ""
echo "⚠️  重要提醒:"
echo "   1. 请编辑: sudo nano ${DEPLOY_DIR}/backend/.env"
echo "   2. 填入API密钥"
echo "   3. 重启: sudo systemctl restart essay-grader"
echo ""
echo "⚠️  注意: 依赖已安装到系统Python"
echo "   查看: pip3 list"
echo ""

