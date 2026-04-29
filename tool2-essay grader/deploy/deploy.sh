#!/bin/bash
# AI作文批阅系统 V2.0 - 自动化部署脚本
# 使用方式: sudo bash deploy/deploy.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  AI作文批阅系统 V2.0 - 自动化部署"
echo "=========================================="
echo ""

# 配置变量（请根据实际情况修改）
PROJECT_NAME="essay-grader-v2"
DEPLOY_DIR="/var/www/${PROJECT_NAME}"
DOMAIN="your-domain.com"  # 修改为您的域名
USER="www-data"
GROUP="www-data"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
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
# 如果是首次部署，需要从当前目录复制文件
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
    cp deploy/.env.production backend/.env
    echo "⚠️  警告: 请编辑 backend/.env 文件，填入正确的API密钥和配置"
fi

echo ""
echo "🗄️  步骤 6/8: 初始化数据库..."
cd backend
python3 -c "from app.database import init_db; init_db()"
cd ..

echo ""
echo "🌐 步骤 7/8: 配置Nginx..."
# 备份原有配置
if [ -f "/etc/nginx/sites-enabled/essay-grader" ]; then
    cp /etc/nginx/sites-enabled/essay-grader /etc/nginx/sites-enabled/essay-grader.backup
fi

# 复制Nginx配置
cp deploy/nginx.conf /etc/nginx/sites-available/essay-grader

# 修改配置中的路径
sed -i "s|/var/www/essay-grader-v2|${DEPLOY_DIR}|g" /etc/nginx/sites-available/essay-grader
sed -i "s|your-domain.com|${DOMAIN}|g" /etc/nginx/sites-available/essay-grader

# 启用站点
ln -sf /etc/nginx/sites-available/essay-grader /etc/nginx/sites-enabled/

# 测试Nginx配置
nginx -t

echo ""
echo "🚀 步骤 8/8: 配置并启动服务..."
# 复制systemd服务文件
cp deploy/essay-grader.service /etc/systemd/system/

# 修改服务文件中的路径
sed -i "s|/var/www/essay-grader-v2|${DEPLOY_DIR}|g" /etc/systemd/system/essay-grader.service

# 设置文件权限
chown -R ${USER}:${GROUP} ${DEPLOY_DIR}
chown -R ${USER}:${GROUP} /var/log/essay-grader
chmod -R 755 ${DEPLOY_DIR}

# 重新加载systemd
systemctl daemon-reload

# 启动服务
systemctl enable essay-grader
systemctl restart essay-grader

# 重启Nginx
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
echo "   HTTP:  http://${DOMAIN}"
echo "   HTTPS: https://${DOMAIN} (需要配置SSL证书)"
echo ""
echo "📝 常用命令:"
echo "   查看后端日志: journalctl -u essay-grader -f"
echo "   重启后端服务: sudo systemctl restart essay-grader"
echo "   重启Nginx:    sudo systemctl restart nginx"
echo "   查看Nginx日志: tail -f /var/log/nginx/essay-grader-access.log"
echo ""
echo "⚠️  重要提示:"
echo "   1. 请编辑 ${DEPLOY_DIR}/backend/.env 文件，配置API密钥"
echo "   2. 如需HTTPS，请安装SSL证书（推荐使用Let's Encrypt）"
echo "   3. 修改配置后需要重启服务: sudo systemctl restart essay-grader"
echo ""

