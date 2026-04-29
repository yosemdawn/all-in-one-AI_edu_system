# 🎓 AI作文批阅系统 V2.0 - 前端

基于 Vue 3 + TypeScript + Element Plus 的现代化前端应用。

## ✨ 功能特性

### 管理员功能
- 📊 **数据概览**: 查看学生总数、批阅记录、平均分数等统计信息
- ✍️ **批阅作文**: 上传作文要求和学生作文，AI自动批阅
- 👨‍🎓 **学生管理**: 批量导入学生、重置密码、查看学生信息
- 📝 **批阅记录**: 查看所有批阅记录，支持筛选和详情查看

### 学生功能
- 📚 **我的记录**: 查看个人批阅记录和统计信息
- 👤 **个人信息**: 查看个人资料和学习统计

## 🚀 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录

## 🏗️ 技术栈

- **框架**: Vue 3 (Composition API + `<script setup>`)
- **语言**: TypeScript
- **UI库**: Element Plus
- **路由**: Vue Router 4
- **状态管理**: Pinia
- **HTTP客户端**: Axios
- **构建工具**: Vite

## 📁 项目结构

```
frontend/
├── src/
│   ├── api/              # API接口封装
│   │   ├── auth.ts       # 认证相关API
│   │   ├── grading.ts    # 批阅相关API
│   │   ├── records.ts    # 记录查询API
│   │   └── users.ts      # 用户管理API
│   ├── layouts/          # 布局组件
│   │   └── MainLayout.vue # 主布局（侧边栏+顶栏）
│   ├── stores/           # Pinia状态管理
│   │   └── user.ts       # 用户状态
│   ├── types/            # TypeScript类型定义
│   │   └── index.ts      # 全局类型
│   ├── utils/            # 工具函数
│   │   └── request.ts    # Axios封装
│   ├── views/            # 页面组件
│   │   ├── admin/        # 管理员页面
│   │   │   ├── Dashboard.vue  # 数据概览
│   │   │   ├── Grading.vue    # 批阅作文
│   │   │   ├── Students.vue   # 学生管理
│   │   │   └── Records.vue    # 批阅记录
│   │   ├── student/      # 学生页面
│   │   │   ├── MyRecords.vue  # 我的记录
│   │   │   └── Profile.vue    # 个人信息
│   │   ├── Login.vue     # 登录页
│   │   └── NotFound.vue  # 404页面
│   ├── router/           # 路由配置
│   │   └── index.ts      # 路由定义和守卫
│   ├── App.vue           # 根组件
│   └── main.ts           # 入口文件
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
├── vite.config.ts        # Vite配置
└── README.md             # 本文件
```

## 🔐 默认账号

### 管理员账号
- 用户名: `admin`
- 密码: `admin123`

### 学生账号
- 用户名: `student001` - `student062`
- 默认密码: `123456`

## 🎨 页面预览

### 登录页面
- 渐变背景设计
- 表单验证
- 角色自动识别和跳转

### 管理员界面
- **Dashboard**: 统计卡片 + 最近批阅记录
- **批阅作文**: 四步流程（上传要求 → 上传作文 → 开始批阅 → 查看结果）
- **学生管理**: 列表展示 + 批量导入 + 密码重置
- **批阅记录**: 表格展示 + 筛选 + 详情查看

### 学生界面
- **我的记录**: 统计卡片 + 记录列表 + 详情查看
- **个人信息**: 基本信息 + 学习统计

## 🔧 开发说明

### API代理配置

开发环境下，前端请求会自动代理到后端API（`http://localhost:8000`）。

配置位于 `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

### 认证机制

- JWT Token存储在 `localStorage`
- Axios请求自动携带Token
- 路由守卫检查登录状态和权限
- Token失效自动跳转登录页

### 状态管理

使用Pinia管理全局状态：

```typescript
const userStore = useUserStore()

// 登录
await userStore.login({ username, password })

// 获取用户信息
const username = userStore.username
const isAdmin = userStore.isAdmin

// 退出登录
await userStore.logout()
```

## 📝 开发规范

1. **组件**: 使用 Composition API + `<script setup lang="ts">`
2. **类型**: 所有API响应和数据模型都有TypeScript类型定义
3. **样式**: 使用scoped样式，避免全局污染
4. **图标**: 使用Emoji + Element Plus图标
5. **消息提示**: 统一使用 `ElMessage` 和 `ElMessageBox`

## 🐛 常见问题

### 1. 启动失败

确保已安装依赖：
```bash
npm install
```

### 2. API请求失败

确保后端服务已启动（`http://localhost:8000`）

### 3. 登录后白屏

检查浏览器控制台错误信息，可能是路由配置问题

## 📄 许可证

MIT License

