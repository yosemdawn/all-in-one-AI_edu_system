# 🚀 AI作文批阅系统 V2.0 - 生产环境部署指南

本文档提供完整的生产环境部署步骤，适用于Ubuntu 20.04/22.04服务器。

---

## 📋 目录

- [服务器要求](#服务器要求)
- [部署前准备](#部署前准备)
- [快速部署](#快速部署)
- [手动部署](#手动部署)
- [SSL证书配置](#ssl证书配置)
- [环境变量配置](#环境变量配置)
- [服务管理](#服务管理)
- [故障排查](#故障排查)
- [备份与恢复](#备份与恢复)
- [性能优化](#性能优化)

---

## 📊 服务器要求

### 最低配置
- **CPU**: 2核
- **内存**: 4GB RAM
- **硬盘**: 20GB SSD
- **操作系统**: Ubuntu 20.04/22.04 LTS
- **网络**: 公网IP + 域名（可选）

### 推荐配置
- **CPU**: 4核
- **内存**: 8GB RAM
- **硬盘**: 50GB SSD
- **带宽**: 5Mbps+

### 软件要求
- Python 3.8+
- Node.js 16+ (仅构建时需要)
- Nginx 1.18+
- SQLite 3

---

## 🔧 部署前准备

### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim
```

### 2. 准备域名（可选）

如果使用域名访问，需要：
1. 购买域名
2. 添加A记录指向服务器IP
3. 等待DNS生效（通常5-30分钟）

验证DNS：
```bash
ping your-domain.com
```

### 3. 准备API密钥

需要准备以下API密钥：
- **百度OCR API**: [申请地址](https://cloud.baidu.com/product/ocr)
- **豆包LLM API**: [申请地址](https://www.volcengine.com/product/doubao)

---

## 🚀 快速部署

### 方式一：使用自动化脚本（推荐）

#### 1. 上传项目文件

将整个项目上传到服务器：

```bash
# 在本地打包项目
cd essay-grader-v2
tar -czf essay-grader-v2.tar.gz .

# 上传到服务器（使用scp或其他工具）
scp essay-grader-v2.tar.gz user@your-server:/tmp/

# 在服务器上解压
ssh user@your-server
cd /tmp
tar -xzf essay-grader-v2.tar.gz -C /home/admin/
cd /home/admin/essay-grader-v2
```

#### 2. 运行部署脚本

```bash
# 修改deploy.sh中的配置（域名等）
sudo nano deploy/deploy.sh
# 修改第8行的DOMAIN变量为您的域名

# 运行部署脚本
sudo bash deploy/deploy.sh
```

脚本会自动完成：
- ✅ 安装系统依赖
- ✅ 创建部署目录
- ✅ 配置Python虚拟环境
- ✅ 初始化数据库
- ✅ 配置Nginx
- ✅ 配置systemd服务
- ✅ 启动所有服务

#### 3. 配置环境变量

```bash
# 编辑环境变量文件
sudo nano /var/www/essay-grader-v2/backend/.env

# 填入您的API密钥
BAIDU_OCR_API_KEY=your-baidu-api-key
BAIDU_OCR_SECRET_KEY=your-baidu-secret-key
DOUBAO_API_KEY=your-doubao-api-key
DOUBAO_MODEL_ID=your-doubao-model-id

# 保存后重启服务
sudo systemctl restart essay-grader
```

#### 4. 验证部署

```bash
# 检查后端服务状态
sudo systemctl status essay-grader

# 检查Nginx状态
sudo systemctl status nginx

# 测试API
curl http://localhost:8000/api/auth/verify
```

访问：`http://your-domain.com` 或 `http://your-server-ip`

---

## 🔐 SSL证书配置

### 使用Let's Encrypt免费证书（推荐）

```bash
# 运行SSL配置脚本
sudo bash deploy/ssl-setup.sh your-domain.com

# 脚本会自动：
# 1. 安装Certbot
# 2. 申请SSL证书
# 3. 配置Nginx
# 4. 设置自动续期
```

### 手动配置SSL

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试自动续期
sudo certbot renew --dry-run
```

配置完成后访问：`https://your-domain.com`

---

## ⚙️ 环境变量配置

### 配置文件位置

```
/var/www/essay-grader-v2/backend/.env
```

### 必填配置

```bash
# 百度OCR配置（必填）
BAIDU_OCR_API_KEY=your-api-key
BAIDU_OCR_SECRET_KEY=your-secret-key

# 豆包LLM配置（必填）
DOUBAO_API_KEY=your-api-key
DOUBAO_MODEL_ID=your-model-id

# JWT密钥（必填，建议使用随机字符串）
SECRET_KEY=your-super-secret-key-min-32-chars
```

### 可选配置

```bash
# 应用配置
DEBUG=false
LOG_LEVEL=INFO
HOST=0.0.0.0
PORT=8000

# 文件上传限制
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,bmp

# CORS配置
CORS_ORIGINS=["https://your-domain.com"]
```

### 生成安全密钥

```bash
# 生成随机SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🔧 服务管理

### 后端服务管理

```bash
# 启动服务
sudo systemctl start essay-grader

# 停止服务
sudo systemctl stop essay-grader

# 重启服务
sudo systemctl restart essay-grader

# 查看状态
sudo systemctl status essay-grader

# 查看日志
sudo journalctl -u essay-grader -f

# 开机自启
sudo systemctl enable essay-grader
```

### Nginx管理

```bash
# 重启Nginx
sudo systemctl restart nginx

# 重新加载配置（不中断服务）
sudo systemctl reload nginx

# 测试配置
sudo nginx -t

# 查看日志
sudo tail -f /var/log/nginx/essay-grader-access.log
sudo tail -f /var/log/nginx/essay-grader-error.log
```

### 更新部署

```bash
# 使用更新脚本
sudo bash deploy/update.sh

# 或手动更新
sudo systemctl stop essay-grader
cd /var/www/essay-grader-v2
# 更新代码...
sudo systemctl start essay-grader
```

---

## 🔍 故障排查

### 1. 后端服务无法启动

```bash
# 查看详细日志
sudo journalctl -u essay-grader -n 100 --no-pager

# 检查端口占用
sudo netstat -tlnp | grep 8000

# 检查Python环境
/var/www/essay-grader-v2/venv/bin/python --version

# 手动启动测试
cd /var/www/essay-grader-v2/backend
source ../venv/bin/activate
python main.py
```

### 2. Nginx 502 Bad Gateway

```bash
# 检查后端服务是否运行
sudo systemctl status essay-grader

# 检查Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/essay-grader-error.log
```

### 3. 数据库错误

```bash
# 检查数据库文件
ls -lh /var/www/essay-grader-v2/data/database.db

# 重新初始化数据库
cd /var/www/essay-grader-v2/backend
source ../venv/bin/activate
python -c "from app.database import init_db; init_db()"
```

### 4. API密钥错误

```bash
# 检查环境变量
cat /var/www/essay-grader-v2/backend/.env

# 测试API连接
cd /var/www/essay-grader-v2/backend
source ../venv/bin/activate
python scripts/test_apis.sh
```

---

## 💾 备份与恢复

### 自动备份脚本

```bash
# 创建备份脚本
sudo nano /root/backup-essay-grader.sh
```

添加以下内容：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/essay-grader"
mkdir -p $BACKUP_DIR

# 备份数据库
cp /var/www/essay-grader-v2/data/database.db $BACKUP_DIR/database_$DATE.db

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/essay-grader-v2/data/uploads

# 删除30天前的备份
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "备份完成: $DATE"
```

```bash
# 添加执行权限
sudo chmod +x /root/backup-essay-grader.sh

# 设置定时任务（每天凌晨2点）
sudo crontab -e
# 添加：
0 2 * * * /root/backup-essay-grader.sh >> /root/backup.log 2>&1
```

### 手动备份

```bash
# 备份数据库
sudo cp /var/www/essay-grader-v2/data/database.db ~/database_backup.db

# 备份上传文件
sudo tar -czf ~/uploads_backup.tar.gz /var/www/essay-grader-v2/data/uploads
```

### 恢复备份

```bash
# 停止服务
sudo systemctl stop essay-grader

# 恢复数据库
sudo cp ~/database_backup.db /var/www/essay-grader-v2/data/database.db

# 恢复上传文件
sudo tar -xzf ~/uploads_backup.tar.gz -C /

# 重启服务
sudo systemctl start essay-grader
```

---

## ⚡ 性能优化

### 1. 增加Worker数量

编辑服务文件：
```bash
sudo nano /etc/systemd/system/essay-grader.service
```

修改ExecStart行：
```
ExecStart=/var/www/essay-grader-v2/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

重启服务：
```bash
sudo systemctl daemon-reload
sudo systemctl restart essay-grader
```

### 2. 配置Nginx缓存

编辑Nginx配置：
```bash
sudo nano /etc/nginx/sites-available/essay-grader
```

添加缓存配置（已包含在nginx.conf中）

### 3. 数据库优化

```bash
# SQLite优化（定期执行）
cd /var/www/essay-grader-v2/data
sqlite3 database.db "VACUUM;"
sqlite3 database.db "ANALYZE;"
```

---

## 📝 默认账号

部署完成后，使用以下账号登录：

**管理员账号**
- 用户名: `admin`
- 密码: `admin123`

**学生账号**
- 用户名: `student001` - `student062`
- 密码: `123456`

⚠️ **重要**: 首次登录后请立即修改管理员密码！

---

## 🎉 部署完成

恭喜！您已成功部署AI作文批阅系统V2.0！

### 下一步

1. ✅ 修改管理员密码
2. ✅ 配置SSL证书（如果还没有）
3. ✅ 设置自动备份
4. ✅ 导入真实学生数据
5. ✅ 测试所有功能

### 获取帮助

如遇问题，请查看：
- 📖 [项目文档](../README.md)
- 📝 [后端完成报告](./V2_BACKEND_COMPLETE.md)
- 🎨 [前端完成报告](./FRONTEND_COMPLETE.md)

---

**祝您使用愉快！** 🎊

