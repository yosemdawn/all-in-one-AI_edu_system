#!/bin/bash
# AI作文批阅系统 V2.0 - AWS EC2 Ubuntu 部署脚本
# 使用方式: sudo bash deploy/deploy-aws.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  AI作文批阅系统 V2.0 - AWS部署"
echo "=========================================="
echo ""

# 配置变量
PROJECT_NAME="essay-grader-v2"
DEPLOY_DIR="/home/ubuntu/${PROJECT_NAME}"
DOMAIN="your-domain.com"  # 修改为您的域名或IP
USER="ubuntu"
GROUP="ubuntu"

# 检查是否以sudo运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    echo "   sudo bash deploy/deploy-aws.sh"
    exit 1
fi

echo "📦 步骤 1/8: 安装系统依赖..."
apt-get update
apt-get install -y python3 python3-pip python3-venv nginx git curl

echo ""
echo "📁 步骤 2/8: 创建部署目录..."
mkdir -p ${DEPLOY_DIR}
mkdir -p /var/log/essay-grader

echo ""
echo "📋 步骤 3/8: 复制项目文件..."
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$DEPLOY_DIR" ]; then
    echo "从 $CURRENT_DIR 复制文件到 $DEPLOY_DIR"
    cp -r backend ${DEPLOY_DIR}/
    
    # 如果 frontend/dist 存在，复制它
    if [ -d "frontend/dist" ]; then
        mkdir -p ${DEPLOY_DIR}/frontend
        cp -r frontend/dist ${DEPLOY_DIR}/frontend/
    else
        echo "⚠️  warning: frontend/dist 不存在，请先运行 'npm run build'"
        mkdir -p ${DEPLOY_DIR}/frontend/dist
    fi
    
    cp -r deploy ${DEPLOY_DIR}/
    
    # 创建数据目录
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
echo "🐍 步骤 4/8: 设置Python虚拟环境..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo ""
echo "⚙️  步骤 5/8: 配置环境变量..."
if [ ! -f "backend/.env" ]; then
    echo "创建 .env 文件（请手动编辑配置）"
    if [ -f "deploy/.env.production" ]; then
        cp deploy/.env.production backend/.env
    fi
    echo "⚠️  警告: 请编辑 backend/.env 文件，填入正确的API密钥和配置"
fi

echo ""
echo "🗄️  步骤 6/8: 初始化数据库..."
cd backend
python3 -c "from app.database import init_db; init_db()" || echo "数据库已存在"
cd ..

echo ""
echo "🌐 步骤 7/8: 配置Nginx..."
# 备份原有配置
if [ -f "/etc/nginx/sites-enabled/essay-grader" ]; then
    cp /etc/nginx/sites-enabled/essay-grader /etc/nginx/sites-enabled/essay-grader.backup
fi

# 创建Nginx配置
cat > /etc/nginx/sites-available/essay-grader << 'EOF'
server {
    listen 80;
    server_name _;  # 接受所有域名/IP
    
    root /home/ubuntu/essay-grader-v2/frontend/dist;
    index index.html;
    
    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # 后端API代理
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
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # 上传文件访问
    location /uploads/ {
        alias /home/ubuntu/essay-grader-v2/data/uploads/;
        expires 1d;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/essay-grader /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

echo ""
echo "🚀 步骤 8/8: 配置并启动服务..."
# 创建systemd服务文件
cat > /etc/systemd/system/essay-grader.service << EOF
[Unit]
Description=AI Essay Grader Backend Service
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/essay-grader-v2/backend
Environment="PATH=/home/ubuntu/essay-grader-v2/venv/bin"
ExecStart=/home/ubuntu/essay-grader-v2/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2

# 重启策略
Restart=always
RestartSec=10

# 日志配置
StandardOutput=append:/var/log/essay-grader/backend.log
StandardError=append:/var/log/essay-grader/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# 设置文件权限
chown -R ${USER}:${GROUP} ${DEPLOY_DIR}
chown -R ${USER}:${GROUP} /var/log/essay-grader
chmod -R 755 ${DEPLOY_DIR}

# 重新加载systemd
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
echo "   1. 请编辑配置文件: sudo nano ${DEPLOY_DIR}/backend/.env"
echo "   2. 填入百度OCR和豆包API密钥"
echo "   3. 重启服务: sudo systemctl restart essay-grader"
echo ""
echo "📝 默认账号:"
echo "   管理员: admin / admin123"
echo "   学生: 学号 / 123456"
echo ""

