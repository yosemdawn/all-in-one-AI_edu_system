#!/bin/bash
# AI作文批阅系统 V2.0 - 更新脚本
# 使用方式: sudo bash deploy/update.sh

set -e

echo "=========================================="
echo "  AI作文批阅系统 V2.0 - 更新部署"
echo "=========================================="
echo ""

DEPLOY_DIR="/var/www/essay-grader-v2"
USER="www-data"
GROUP="www-data"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

echo "📦 步骤 1/5: 停止服务..."
systemctl stop essay-grader

echo ""
echo "📋 步骤 2/5: 备份当前版本..."
BACKUP_DIR="${DEPLOY_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
cp -r ${DEPLOY_DIR} ${BACKUP_DIR}
echo "备份已保存到: ${BACKUP_DIR}"

echo ""
echo "📥 步骤 3/5: 更新代码..."
cd ${DEPLOY_DIR}

# 更新后端
if [ -d "backend" ]; then
    echo "更新后端代码..."
    # 这里可以使用git pull或复制新文件
    # git pull origin main
fi

# 更新前端
if [ -d "frontend/dist" ]; then
    echo "更新前端代码..."
    # 从构建目录复制新的前端文件
    # cp -r /path/to/new/frontend/dist/* frontend/dist/
fi

echo ""
echo "🐍 步骤 4/5: 更新Python依赖..."
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo ""
echo "🗄️  步骤 5/5: 更新数据库..."
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
echo "💡 如果更新失败，可以恢复备份:"
echo "   sudo systemctl stop essay-grader"
echo "   sudo rm -rf ${DEPLOY_DIR}"
echo "   sudo mv ${BACKUP_DIR} ${DEPLOY_DIR}"
echo "   sudo systemctl start essay-grader"
echo ""

