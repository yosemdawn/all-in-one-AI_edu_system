# 🎓 AI作文批阅系统 V2.0 

> 智能作文批阅系统，支持学生端和教师端的完整解决方案
- 响应AI agent打通学生学习全链条的政策（应该是这么说的吧...起码做到了超越tooluse）
- 这个程序还在开发中 我正在研究怎么新增一个资源共享区 作业记录区 欢迎各位佬提建议！
- 本人文科出身 读的英语专业 对Programming是一窍不通的，有这个程序多亏了Vibe coding的出现！Linux，python，部署，AI(也就了解点AIGC相关) 都是上班偷摸自学的 只懂皮毛
- 样板网站撤了 暂时换成作业批改系统了 这个其实部署起来也没多麻烦
- 然后可能有个bug 就是批阅进度显示不太准 批量上传作文之后需要大家耐心等待他跳转 此时万万不能刷新网页 特此说明！！（来个大神帮我优化一下。。）


## 📋 项目简介

这是一个基于AI的作文批阅系统，包含：
- **教师端**：上传题目和作文，批量批阅（重点），学生管理
- **学生端**：查看批阅记录，个人统计分析
- **智能批阅**：OCR识别 + AI评分 + 详细建议
此程序亮点就在：每次学生的作文批阅记录都会保存于云端，学生登录账号就可以查看历史作文原题和批阅记录（直到服务器欠费）
不仅限于课下；在学校，老师也可以登录网站 点击查看LLM的批阅详情 把学生叫过来亲自指导。
这个目前市面上还没看到哪个产品能实现这一点。（如果有请告诉我 我学习一下）

## 🏗️ 项目结构

```
essay-grader-v2/
├── backend/                    # 后端代码（FastAPI）- 仅包含代码
│   ├── app/             # 应用主目录
│   │   ├── models/      # 数据模型
│   │   ├── routes/      # API路由
│   │   ├── services/    # 业务逻辑
│   │   └── utils/       # 工具函数
│   ├── static/          # 静态文件
│   ├── templates/       # 模板文件
│   ├── main.py          # 应用入口
│   └── requirements.txt # Python依赖
│
├── frontend/            # 前端代码（Vue 3）- 待开发
│   ├── src/            # 源代码
│   │   ├── components/ # 组件
│   │   ├── views/      # 页面
│   │   ├── router/     # 路由
│   │   ├── store/      # 状态管理
│   │   └── api/        # API接口
│   ├── public/         # 公共资源
│   └── package.json    # 依赖配置
│
├── docs/               # 文档目录
│   ├── essay_grader_student_portal_plan.md  # 完整技术规划
│   └── 新手部署指南.md                        # 部署教程
│
├── scripts/            # 脚本目录 - 待创建
│   ├── init_db.py      # 数据库初始化
│   ├── import_students.py  # 导入学生
│   └── deploy.sh       # 部署脚本
│
├── data/               # 数据目录 - 所有持久化数据
│   ├── students.json   # 学生信息（待迁移到数据库）
│   ├── database.db     # SQLite数据库（待创建）
│   └── uploads/        # 上传文件
│       ├── prompts/    # 题目图片
│       └── essays/     # 作文图片
│
└── logs/               # 日志目录 - 所有日志文件
    └── app.log         # 应用日志
```

## 🚀 快速开始

先clone一下

### 开发环境

#### 1. 后端开发

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python scripts/init_db.py

# 运行开发服务器
python main.py
```

访问：http://localhost:8000

#### 2. 前端开发

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 运行开发服务器
npm run dev
```

访问：http://localhost:5173

### 生产部署

详细部署步骤请查看：[新手部署指南.md](docs/新手部署指南.md)

**一键部署**：
```bash
wget https://your-repo/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

## 📚 文档

- [完整技术规划](docs/essay_grader_student_portal_plan.md) - 详细的系统设计文档
- [新手部署指南](docs/新手部署指南.md) - 零基础部署教程

## 🔧 技术栈

### 后端
- **框架**：FastAPI 0.104+
- **数据库**：SQLite 3
- **ORM**：SQLAlchemy 2.0
- **认证**：JWT (python-jose)
- **密码加密**：bcrypt
- **OCR**：百度OCR API
- **LLM**：豆包API

### 前端
- **框架**：Vue 3.3+
- **语言**：TypeScript 5.0+
- **构建工具**：Vite 4.0+
- **UI库**：Element Plus 2.4+
- **状态管理**：Pinia 2.1+
- **路由**：Vue Router 4.2+
- **HTTP**：Axios 1.5+
- **图表**：ECharts 5.4+

## 🔐 默认账号

**管理员账号**（首次部署后）：
- 用户名：`admin@example.com`
- 密码：`admin123`

⚠️ **重要**：首次登录后请立即修改密码！

## 📞 常见问题

### 如何导入学生数据？

1. 准备Excel文件（包含姓名、班级、学号）
2. 运行导入脚本：`python scripts/import_students.py students.xlsx`

### 如何备份数据？

```bash
# 备份数据库
cp data/database.db data/backup/database_$(date +%Y%m%d).db

# 备份上传文件
tar -czf data/backup/uploads_$(date +%Y%m%d).tar.gz data/uploads/
```

### 如何查看日志？

```bash
# 应用日志
tail -f logs/app.log

# Nginx日志（生产环境）
tail -f /var/log/nginx/error.log
```

## 🤝 贡献

这个项目完全开源！欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 作者

Yosem


---

**当前版本**：V2.0 (开发中)
**最后更新**：2026.4.28

以下是作者碎碎念：

<img width="48" height="48" alt="11BD9860" src="https://github.com/user-attachments/assets/2f2cc079-e53d-4eb5-a2c1-1bace8568f34" />
- 我认为，人工智能赋能教学 不应该只局限于课堂！
- 而且提出一个暴论：AI在课堂上的用处可以说是微乎其微！你说你整的一切AI相关的东西 没有AI就不能教学了吗？我的意思是，你应用的AI，是否在课堂上具有不可替代性？是否教学效果优于传统教学？你说课堂要使用Agent，你的agent对教学是否真正起到了作用？我觉得这是每位同仁都应该考虑的事情！！
AR VR 数字人 转语音 图生视频等等....真的很有必要吗...? LLM生成的教案 学案（更可怕的是生成的教案学案都来自于国内某不知名网站 也不知道人家用的什么路边的模型）你敢用吗...？那么多的商人在贩卖焦虑，介绍自己的工作流生成教案学案多么方便高质量，但只有真正一线教师知道你用LLM做的学案没人会用。因为这意味着你要从头设计课件。OK你费劲巴拉的整完了 你再对比一下学科网上高质量的赛课课件，你就会反思你做的一切努力值得吗？练习题的生成，其实网上也遍地都是，就非要让LLM生成这节课的习题吗？而且据我测试 即便是最新的gemini3.1 pro 我让他出几个语法填空 也会有出错的时候（至少我教的英语是这样，理科的话应该能强点 毕竟推理模型擅长这个）如果你反驳 “可以导入新课标电子版 让他生成啊！” 那我只能说你对LLM还是不太了解。
LLM说到底是一个概率模型。LLM发展到现在确实迭代很快，但是说实话让LLM生成一个符合新课程标准的教学设计 还是比较困难的：因为他不是针对于教学领域训练的模型，它是通用语言模型。我相信集齐足够的高质量教学设计和教学理论，进行模型训练，是可以达到这个效果的！但是这一定是一个大工程，（我感觉的 我也不是太懂深度学习 transformer架构这方面）

