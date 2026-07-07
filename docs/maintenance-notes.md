# 项目维护说明

这份文档合并了原来散落在 `src/docs`、业务视图目录和 `plans` 里的实现说明。它只保留维护项目时仍然有价值的信息；历史完成总结、演示代码、过程记录已从源码目录移除。

## 项目结构

- `src/`：Vue 3 前端源码，包含接口封装、布局、路由、状态管理和业务页面。
- `backend/`：NestJS 后端源码，包含认证、用户、权限、班级、作业、提交、教师工具箱和管理端接口。
- `public/README/`：README 使用的截图和动图素材。
- `deploy/`：服务器 Nginx 与证书申请脚本。真实证书和私钥不应提交到仓库。
- `docs/`：维护说明和二次开发笔记。

## 前端维护要点

- 状态管理使用 Vuex。`user` 模块负责登录态和用户信息，`auth` 模块负责权限、菜单和动态路由，`app` 模块负责全局 UI 状态。
- 布局入口是 `src/layouts/index.vue`。管理员类角色使用侧边栏布局 `AppLayout`，教师和学生默认使用顶部导航布局 `TopNavLayout`。
- 通用页面头部使用 `src/components/PageHeader.vue`。新页面优先复用该组件，减少重复标题和操作区样式。
- 表格页面优先使用 `src/components/AdaptiveTableContainer.vue`，配合 `src/hooks/useAdaptiveTable.ts` 和 `src/assets/styles/adaptive-table.css`，通过 CSS Flexbox 管理搜索区、表格区和分页区高度。
- 富文本编辑使用 `src/components/WangEditor.vue`，作业编辑页仍依赖该组件。
- 教师工具箱页面位于 `src/views/teacher/tools/`，支持客观题批分、批量作文检查、任务记录、CSV 导出和同步到作业提交记录。
- 学生提交与 AI 轮询逻辑拆在 `src/views/student/submissions/composables/`，其中 `useAiReviewPolling.ts` 负责 AI 批改状态轮询。

## 后端维护要点

- 后端入口是 `backend/src/main.ts`，核心模块在 `backend/src/app.module.ts` 注册。
- AI 批改与教师工具箱任务使用 Redis / BullMQ。生产环境启用 `AI_REVIEW_REQUIRED=true` 时，必须配置可用的 `REDIS_URL` 和 `DOUBAO_API_KEY`。
- 生产环境变量从 `backend/.env.production.example` 复制，真实 `.env`、API Key、JWT secret 和证书私钥不要提交。
- 健康检查接口为 `/api/healthz` 和 `/api/readyz`。
- 开发管理员可通过根目录脚本 `npm run reset:dev-admin` 重置。

## 部署与更新

本地开发：

```bash
npm install
npm --prefix backend install
npm run dev:full
```

服务器常规更新流程：

```bash
git pull
npm install
npm --prefix backend install
npm run build
npm --prefix backend run build
docker compose up -d --build
sudo systemctl reload nginx
```

如果只部署后端容器：

```bash
cd backend
docker compose -f compose.prod.yml up -d --build
```

SSL 证书请在服务器上使用 `deploy/setup-ssl.sh` 或 Certbot 生成。Nginx 配置默认读取 `/etc/letsencrypt/live/yosem.vip/` 下的证书文件。

## 功能边界

- AI 批改结果只作为辅助判断，正式成绩和重要评价应由教师复核。
- 教师人工批改结果优先级最高，系统不应使用 AI 或工具箱结果覆盖教师已经确认的最终批改。
- 学生跨班级提交作业时，要以作业、班级和提交记录的组合关系判断状态，避免不同班级同名或同源作业互相干扰。
- 导入用户模板、作业提交附件、AI 任务图片等文件处理逻辑要优先走现有 API 封装，避免在组件里重复拼接接口路径。

