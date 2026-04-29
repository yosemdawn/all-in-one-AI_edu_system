#!/bin/bash
# AI作文批阅系统 V2.0 - SSL证书配置脚本（使用Let's Encrypt）
# 使用方式: sudo bash deploy/ssl-setup.sh your-domain.com

set -e

if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 运行此脚本"
    exit 1
fi

if [ -z "$1" ]; then
    echo "❌ 请提供域名"
    echo "使用方式: sudo bash deploy/ssl-setup.sh your-domain.com"
    exit 1
fi

DOMAIN=$1
EMAIL="admin@${DOMAIN}"  # 修改为您的邮箱

echo "=========================================="
echo "  配置SSL证书 - Let's Encrypt"
echo "=========================================="
echo ""
echo "域名: ${DOMAIN}"
echo "邮箱: ${EMAIL}"
echo ""

echo "📦 步骤 1/3: 安装Certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "🔐 步骤 2/3: 获取SSL证书..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email

echo ""
echo "⏰ 步骤 3/3: 配置自动续期..."
# Certbot会自动配置续期，测试一下
certbot renew --dry-run

echo ""
echo "=========================================="
echo "  ✅ SSL证书配置完成！"
echo "=========================================="
echo ""
echo "🌐 现在可以通过HTTPS访问:"
echo "   https://${DOMAIN}"
echo ""
echo "📝 证书信息:"
certbot certificates
echo ""
echo "💡 证书会自动续期，无需手动操作"
echo ""

