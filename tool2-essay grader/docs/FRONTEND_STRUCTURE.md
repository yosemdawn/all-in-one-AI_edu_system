# 📁 前端项目结构

## 完整目录树

```
frontend/
├── 📄 package.json              # 项目配置和依赖
├── 📄 vite.config.ts            # Vite构建配置
├── 📄 tsconfig.json             # TypeScript配置
├── 📄 index.html                # HTML入口文件
├── 📄 README.md                 # 项目说明文档
│
└── src/                         # 源代码目录
    ├── 📄 main.ts               # 应用入口文件
    ├── 📄 App.vue               # 根组件
    ├── 📄 style.css             # 全局样式
    │
    ├── 📁 api/                  # API接口模块
    │   ├── auth.ts              # 认证API（登录、登出、获取用户信息）
    │   ├── grading.ts           # 批阅API（上传、处理、查询状态）
    │   ├── records.ts           # 记录API（查询批阅记录）
    │   └── users.ts             # 用户API（管理学生、重置密码）
    │
    ├── 📁 layouts/              # 布局组件
    │   └── MainLayout.vue       # 主布局（侧边栏+顶栏+内容区）
    │
    ├── 📁 views/                # 页面组件
    │   ├── Login.vue            # 登录页面
    │   ├── NotFound.vue         # 404错误页面
    │   │
    │   ├── 📁 admin/            # 管理员页面
    │   │   ├── Dashboard.vue    # 数据概览
    │   │   ├── Grading.vue      # 批阅作文
    │   │   ├── Students.vue     # 学生管理
    │   │   └── Records.vue      # 批阅记录
    │   │
    │   └── 📁 student/          # 学生页面
    │       ├── MyRecords.vue    # 我的记录
    │       └── Profile.vue      # 个人信息
    │
    ├── 📁 router/               # 路由配置
    │   └── index.ts             # 路由定义和守卫
    │
    ├── 📁 stores/               # 状态管理
    │   └── user.ts              # 用户状态（Pinia）
    │
    ├── 📁 types/                # TypeScript类型定义
    │   └── index.ts             # 全局类型接口
    │
    └── 📁 utils/                # 工具函数
        └── request.ts           # Axios封装
```

## 文件说明

### 🔧 配置文件

| 文件 | 说明 |
|------|------|
| `package.json` | 项目依赖和脚本配置 |
| `vite.config.ts` | Vite构建工具配置，包含代理设置 |
| `tsconfig.json` | TypeScript编译配置 |
| `index.html` | HTML模板文件 |

### 📦 核心文件

| 文件 | 说明 | 行数 |
|------|------|------|
| `main.ts` | 应用入口，初始化Vue、Router、Pinia | ~30 |
| `App.vue` | 根组件，包含路由视图 | ~20 |
| `style.css` | 全局样式定义 | ~50 |

### 🌐 API模块 (api/)

| 文件 | 说明 | 主要函数 |
|------|------|----------|
| `auth.ts` | 认证相关API | `login()`, `logout()`, `getCurrentUser()`, `verifyToken()` |
| `grading.ts` | 批阅相关API | `uploadPrompt()`, `uploadEssays()`, `processBatch()`, `getTaskStatus()` |
| `records.ts` | 记录查询API | `getMyRecords()`, `getAllRecords()`, `getStudentRecords()`, `getRecordDetail()` |
| `users.ts` | 用户管理API | `batchImportStudents()`, `resetPassword()`, `getUserList()`, `deleteUser()` |

### 🎨 布局组件 (layouts/)

| 文件 | 说明 | 特性 |
|------|------|------|
| `MainLayout.vue` | 主布局组件 | 侧边栏导航、顶部栏、用户信息、退出登录、角色自适应菜单 |

### 📄 页面组件 (views/)

#### 通用页面

| 文件 | 路由 | 说明 |
|------|------|------|
| `Login.vue` | `/login` | 登录页面，支持管理员和学生登录 |
| `NotFound.vue` | `/*` | 404错误页面 |

#### 管理员页面 (admin/)

| 文件 | 路由 | 说明 | 主要功能 |
|------|------|------|----------|
| `Dashboard.vue` | `/dashboard` | 数据概览 | 统计卡片、最近批阅记录 |
| `Grading.vue` | `/admin/grading` | 批阅作文 | 四步流程、文件上传、任务轮询 |
| `Students.vue` | `/admin/students` | 学生管理 | 列表展示、批量导入、重置密码、删除 |
| `Records.vue` | `/admin/records` | 批阅记录 | 记录列表、筛选、详情查看 |

#### 学生页面 (student/)

| 文件 | 路由 | 说明 | 主要功能 |
|------|------|------|----------|
| `MyRecords.vue` | `/student/records` | 我的记录 | 统计卡片、记录列表、详情查看 |
| `Profile.vue` | `/student/profile` | 个人信息 | 基本信息、学习统计 |

### 🛣️ 路由配置 (router/)

| 文件 | 说明 | 特性 |
|------|------|------|
| `index.ts` | 路由定义和守卫 | 权限检查、自动重定向、页面标题设置 |

### 💾 状态管理 (stores/)

| 文件 | 说明 | 状态 | 方法 |
|------|------|------|------|
| `user.ts` | 用户状态管理 | `token`, `user`, `isLoggedIn` | `login()`, `logout()`, `checkAuth()` |

### 📝 类型定义 (types/)

| 文件 | 说明 | 主要接口 |
|------|------|----------|
| `index.ts` | 全局类型定义 | `User`, `LoginRequest`, `GradingRecord`, `RecordDetail`, `StudentImportItem` |

### 🔨 工具函数 (utils/)

| 文件 | 说明 | 特性 |
|------|------|------|
| `request.ts` | Axios封装 | 自动Token注入、错误处理、响应拦截 |

## 代码统计

### 按类型统计

| 类型 | 数量 | 说明 |
|------|------|------|
| Vue组件 | 9 | 包含布局和页面组件 |
| TypeScript文件 | 8 | API、路由、状态、类型、工具 |
| 配置文件 | 4 | package.json, vite.config.ts, tsconfig.json等 |
| 文档文件 | 2 | README.md, FRONTEND_COMPLETE.md |
| **总计** | **23** | **完整的前端项目** |

### 按功能统计

| 功能模块 | 文件数 | 说明 |
|----------|--------|------|
| API接口 | 4 | 完整的后端API封装 |
| 管理员功能 | 4 | Dashboard + 3个管理页面 |
| 学生功能 | 2 | 记录查看 + 个人信息 |
| 基础设施 | 6 | 路由、状态、类型、工具等 |
| 布局和通用 | 3 | 主布局 + 登录 + 404 |

## 技术栈

### 核心框架
- **Vue 3.3.4** - 渐进式JavaScript框架
- **TypeScript 5.2.2** - 类型安全的JavaScript超集
- **Vite 4.4.9** - 下一代前端构建工具

### UI框架
- **Element Plus 2.3.14** - Vue 3组件库
- **@element-plus/icons-vue 2.1.0** - Element Plus图标库

### 路由和状态
- **Vue Router 4.2.4** - Vue官方路由管理器
- **Pinia 2.1.6** - Vue官方状态管理库

### HTTP客户端
- **Axios 1.5.0** - Promise based HTTP client

## 设计模式

### 1. 组件化设计
- 单一职责原则
- 高内聚低耦合
- 可复用的组件结构

### 2. API封装
- 统一的请求/响应处理
- 自动错误处理
- TypeScript类型安全

### 3. 状态管理
- 集中式状态管理
- 响应式数据流
- 持久化存储

### 4. 路由守卫
- 权限控制
- 自动重定向
- 页面标题管理

## 代码规范

### 1. 命名规范
- 组件：PascalCase（如 `MainLayout.vue`）
- 文件：kebab-case（如 `user-store.ts`）
- 变量：camelCase（如 `userName`）
- 常量：UPPER_CASE（如 `API_BASE_URL`）

### 2. 组件规范
- 使用 Composition API
- 使用 `<script setup lang="ts">`
- 使用 scoped 样式
- 添加必要的注释

### 3. TypeScript规范
- 所有函数参数和返回值都有类型定义
- 使用接口定义数据结构
- 避免使用 `any` 类型

### 4. 样式规范
- 使用 scoped 样式避免污染
- 统一的颜色和间距
- 响应式设计

## 性能优化

### 1. 路由懒加载
所有页面组件都使用动态导入：
```typescript
component: () => import('@/views/admin/Dashboard.vue')
```

### 2. 组件按需加载
Element Plus组件按需导入，减小打包体积

### 3. 请求优化
- 使用Axios拦截器统一处理
- 避免重复请求
- 合理的超时设置

## 浏览器兼容性

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88

## 开发建议

### 1. 开发流程
1. 启动后端服务（`python backend/main.py`）
2. 启动前端服务（`npm run dev`）
3. 在浏览器中访问 `http://localhost:5173`

### 2. 调试技巧
- 使用Vue DevTools查看组件状态
- 使用浏览器开发者工具查看网络请求
- 查看控制台日志排查错误

### 3. 代码提交
- 提交前运行 `npm run build` 确保能正常构建
- 检查TypeScript类型错误
- 添加有意义的提交信息

---

**文档更新时间**: 2024-01-XX  
**项目版本**: V2.0  
**技术栈**: Vue 3 + TypeScript + Element Plus

