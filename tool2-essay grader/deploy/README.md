# 🚀 部署文件说明

本目录包含所有生产环境部署所需的配置文件和脚本。

---

## 📁 文件清单

### 配置文件

#### `nginx.conf`
Nginx Web服务器配置文件

**用途**:
- 提供前端静态文件服务
- 代理后端API请求
- 配置SSL/HTTPS
- 设置缓存策略

**安装位置**: `/etc/nginx/sites-available/essay-grader`

**使用方式**:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/essay-grader
sudo ln -s /etc/nginx/sites-available/essay-grader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

#### `essay-grader.service`
Systemd服务配置文件

**用途**:
- 管理后端服务的启动、停止、重启
- 配置自动重启策略
- 设置日志输出

**安装位置**: `/etc/systemd/system/essay-grader.service`

**使用方式**:
```bash
sudo cp essay-grader.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable essay-grader
sudo systemctl start essay-grader
```

---

#### `.env.production`
生产环境配置模板

**用途**:
- 提供生产环境配置示例
- 包含所有必需的环境变量

**使用位置**: 复制到 `backend/.env`

**使用方式**:
```bash
cp .env.production ../backend/.env
nano ../backend/.env  # 填入真实的API密钥
```

**必须配置的项目**:
- `BAIDU_OCR_API_KEY` - 百度OCR API密钥
- `BAIDU_OCR_SECRET_KEY` - 百度OCR密钥
- `DOUBAO_API_KEY` - 豆包LLM API密钥
- `DOUBAO_MODEL_ID` - 豆包模型ID
- `SECRET_KEY` - JWT密钥（建议使用随机字符串）

---

### 部署脚本

#### `deploy.sh` ⭐ 主部署脚本
一键自动化部署脚本

**功能**:
1. 安装系统依赖（Python、Nginx等）
2. 创建部署目录
3. 复制项目文件
4. 配置Python虚拟环境
5. 安装Python依赖
6. 配置环境变量
7. 初始化数据库
8. 配置Nginx
9. 配置systemd服务
10. 启动所有服务

**使用方式**:
```bash
# 修改配置（可选）
nano deploy.sh  # 修改第8行的DOMAIN变量

# 运行部署
sudo bash deploy.sh
```

**注意事项**:
- 需要root权限
- 首次部署使用
- 会自动安装所有依赖

---

#### `update.sh` 🔄 更新脚本
更新已部署的系统

**功能**:
1. 停止服务
2. 备份当前版本
3. 更新代码
4. 更新依赖
5. 更新数据库
6. 重启服务

**使用方式**:
```bash
sudo bash update.sh
```

**注意事项**:
- 会自动备份当前版本
- 如果更新失败，可以恢复备份

---

#### `ssl-setup.sh` 🔐 SSL配置脚本
配置Let's Encrypt免费SSL证书

**功能**:
1. 安装Certbot
2. 申请SSL证书
3. 配置Nginx SSL
4. 设置自动续期

**使用方式**:
```bash
sudo bash ssl-setup.sh your-domain.com
```

**注意事项**:
- 需要有效的域名
- 域名需要解析到服务器IP
- 证书会自动续期

---

## 🚀 快速部署流程

### 步骤1: 上传项目到服务器

```bash
# 在本地打包
cd essay-grader-v2
tar -czf essay-grader-v2.tar.gz .

# 上传到服务器
scp essay-grader-v2.tar.gz user@your-server:/tmp/

# 在服务器上解压
ssh user@your-server
cd /tmp
tar -xzf essay-grader-v2.tar.gz -C /home/admin/
```

### 步骤2: 运行部署脚本

```bash
cd /home/admin/essay-grader-v2

# 修改域名配置（可选）
nano deploy/deploy.sh

# 运行部署
sudo bash deploy/deploy.sh
```

### 步骤3: 配置API密钥

```bash
# 编辑环境变量
sudo nano /var/www/essay-grader-v2/backend/.env

# 填入API密钥
BAIDU_OCR_API_KEY=your-key
BAIDU_OCR_SECRET_KEY=your-secret
DOUBAO_API_KEY=your-key
DOUBAO_MODEL_ID=your-model-id

# 重启服务
sudo systemctl restart essay-grader
```

### 步骤4: 配置SSL（可选）

```bash
sudo bash deploy/ssl-setup.sh your-domain.com
```

### 步骤5: 验证部署

```bash
# 检查服务状态
sudo systemctl status essay-grader
sudo systemctl status nginx

# 浏览器访问
# HTTP: http://your-domain.com
# HTTPS: https://your-domain.com
```

---

## 🔧 常用命令

### 服务管理

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
```

### Nginx管理

```bash
# 重启Nginx
sudo systemctl restart nginx

# 重新加载配置
sudo systemctl reload nginx

# 测试配置
sudo nginx -t

# 查看日志
sudo tail -f /var/log/nginx/essay-grader-access.log
```

### 更新部署

```bash
# 使用更新脚本
sudo bash deploy/update.sh

# 或手动更新
sudo systemctl stop essay-grader
# 更新代码...
sudo systemctl start essay-grader
```

---

## 📝 配置修改

### 修改域名

编辑Nginx配置：
```bash
sudo nano /etc/nginx/sites-available/essay-grader
# 修改 server_name 行
sudo systemctl restart nginx
```

### 修改端口

编辑服务配置：
```bash
sudo nano /etc/systemd/system/essay-grader.service
# 修改 --port 参数
sudo systemctl daemon-reload
sudo systemctl restart essay-grader
```

### 修改Worker数量

编辑服务配置：
```bash
sudo nano /etc/systemd/system/essay-grader.service
# 修改 --workers 参数
sudo systemctl daemon-reload
sudo systemctl restart essay-grader
```

---

## 🔍 故障排查

### 后端服务无法启动

```bash
# 查看详细日志
sudo journalctl -u essay-grader -n 100 --no-pager

# 检查端口占用
sudo netstat -tlnp | grep 8000

# 手动启动测试
cd /var/www/essay-grader-v2/backend
source ../venv/bin/activate
python main.py
```

### Nginx 502错误

```bash
# 检查后端服务
sudo systemctl status essay-grader

# 检查Nginx配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/essay-grader-error.log
```

### 数据库错误

```bash
# 检查数据库文件
ls -lh /var/www/essay-grader-v2/data/database.db

# 重新初始化
cd /var/www/essay-grader-v2/backend
source ../venv/bin/activate
python -c "from app.database import init_db; init_db()"
```

---

## 📚 相关文档

- 📖 [详细部署指南](../docs/DEPLOYMENT.md)
- 📝 [部署完成报告](../docs/DEPLOYMENT_SUMMARY.md)
- 🎨 [前端完成报告](../docs/FRONTEND_COMPLETE.md)
- 📊 [后端完成报告](../docs/V2_BACKEND_COMPLETE.md)
- 📋 [项目README](../README.md)

---

## ⚠️ 重要提示

1. **首次部署后必须配置API密钥**
2. **建议配置SSL证书保护数据安全**
3. **定期备份数据库和上传文件**
4. **首次登录后立即修改管理员密码**
5. **生产环境建议使用4个或更多worker**

---

## 🎉 部署完成

恭喜！按照以上步骤，您应该已经成功部署了AI作文批阅系统V2.0！

**默认登录账号**:
- 管理员: `admin` / `admin123`
- 学生: `student001-062` / `123456`

**祝您使用愉快！** 🎊

