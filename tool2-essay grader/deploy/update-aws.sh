#!/bin/bash
# AI作文批阅系统 V2.0 - AWS更新脚本
# 使用方式: sudo bash deploy/update-aws.sh

set -e

echo "=========================================="
echo "  AI作文批阅系统 V2.0 - AWS更新部署"
echo "=========================================="
echo ""

DEPLOY_DIR="/home/ubuntu/essay-grader-v2"
USER="ubuntu"
GROUP="ubuntu"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

echo "📦 步骤 1/6: 停止服务..."
systemctl stop essay-grader

echo ""
echo "📋 步骤 2/6: 备份当前版本..."
BACKUP_DIR="${DEPLOY_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
cp -r ${DEPLOY_DIR} ${BACKUP_DIR}
echo "✅ 备份已保存到: ${BACKUP_DIR}"

echo ""
echo "📥 步骤 3/6: 从GitHub拉取最新代码..."
cd ${DEPLOY_DIR}

# 保存当前的.env文件
if [ -f "backend/.env" ]; then
    cp backend/.env /tmp/essay-grader-env-backup
    echo "✅ 已备份 .env 配置文件"
fi

# 重置本地修改并拉取最新代码
git fetch origin
git reset --hard origin/main
git pull origin main

# 恢复.env文件
if [ -f "/tmp/essay-grader-env-backup" ]; then
    cp /tmp/essay-grader-env-backup backend/.env
    rm /tmp/essay-grader-env-backup
    echo "✅ 已恢复 .env 配置文件"
fi

echo ""
echo "🐍 步骤 4/6: 更新Python依赖..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo ""
echo "🌐 步骤 5/6: 检查前端构建..."
if [ ! -d "frontend/dist" ] || [ -z "$(ls -A frontend/dist)" ]; then
    echo "⚠️  前端构建文件不存在，尝试构建..."
    if command -v npm &> /dev/null; then
        cd frontend
        npm install
        npm run build
        cd ..
        echo "✅ 前端构建完成"
    else
        echo "❌ 未安装Node.js，跳过前端构建"
    fi
else
    echo "✅ 前端构建文件已存在"
fi

echo ""
echo "🗄️  步骤 6/6: 更新数据库（如果需要）..."
cd backend
# 如果使用Alembic进行数据库迁移
# alembic upgrade head
cd ..

echo ""
echo "🚀 重启服务..."
# 设置文件权限
chown -R ${USER}:${GROUP} ${DEPLOY_DIR}
chmod -R 755 ${DEPLOY_DIR}

# 重启服务
systemctl start essay-grader
systemctl restart nginx

echo ""
echo "=========================================="
echo "  ✅ 更新完成！"
echo "=========================================="
echo ""
echo "📊 服务状态:"
systemctl status essay-grader --no-pager -l
echo ""
echo "🌐 访问地址:"
PUBLIC_IP=$(curl -s ifconfig.me)
echo "   http://${PUBLIC_IP}"
echo ""
echo "💡 如果更新失败，可以恢复备份:"
echo "   sudo systemctl stop essay-grader"
echo "   sudo rm -rf ${DEPLOY_DIR}"
echo "   sudo mv ${BACKUP_DIR} ${DEPLOY_DIR}"
echo "   sudo systemctl start essay-grader"
echo ""
echo "📝 备份位置: ${BACKUP_DIR}"
echo ""

