# 第二批上线修复：部署、限流、就绪检查与 AI 恢复

对应审查第 6、7、8、12、9 项。改动默认面向单台服务器、单个后端实例；未修改现有生产环境的配置文件和业务数据。

## 行为变化

- 生产配置统一到根目录 `docker-compose.yml`；`backend/compose.prod.yml` 只引用它。MongoDB、Redis、后端均不发布宿主机端口，只有前端绑定 `127.0.0.1:8080`。
- MongoDB 初始化管理账号和仅有 `yosem_ai` 库读写权限的应用账号；Redis 启用独立密码。Compose 缺少密码时直接拒绝启动。首次配置生成脚本产生独立随机密钥，拒绝覆盖既有配置。
- `/app/uploads` 挂载 `uploads_data` 持久卷，路径与已有教师工具数据结构保持一致。Docker 构建排除本地上传、备份、依赖和后端私密配置。前端镜像使用 Node 22、`npm ci` 和包含类型检查的构建。
- 认证限流仅作用于显式配置认证限流的入口。普通业务按经过完整令牌和账号校验的用户 ID 计数；无效/匿名凭证按 IP 计数。认证入口仍按 IP 限流，伪造令牌或转发头不会获得新的计数桶。限流仍使用单实例内存存储，多副本部署前应改用共享存储。
- 生产禁用 `TRUST_PROXY=true`。Compose 信任私网代理，后端端口保持私有；Nginx 覆盖传入的 `X-Forwarded-For`，并保证 `/api/` 优先进入后端代理，避免图片路径误命中静态缓存规则。如增加外层代理，应根据实际拓扑配置可信代理和真实客户端地址，不应直接信任任意请求头。
- `/api/healthz` 仅报告进程存活；`/api/readyz` 并行检查 MongoDB、已配置的 Redis，单项最多等待约 1.5 秒，失败返回 503。生产必须启用 AI 时，缺少 Redis 也会失败。容器健康检查使用 readyz，探针不受业务限流影响。
- 普通作业提交与 `aiDispatch` 待投递记录在一次 MongoDB 文档写入中保存。Redis 入队失败时提交仍被接受，后台每 15 秒扫描待投递记录；每批最多 50 条，以 30 秒租约协调多次投递。队列任务 ID 仍由提交 ID 和 revision 唯一确定。
- AI HTTP 请求默认 60 秒超时，可通过 `AI_REQUEST_TIMEOUT_MS` 设置，最大 120 秒；超时覆盖响应头和响应体读取。自动重试仍最多 3 次，中间失败保留重试状态，最终失败明确落库。
- 从安排 AI 到完成超过 15 分钟的任务会标为失败，阻止迟到 Worker 继续写入。升级前没有待投递记录且超过 15 分钟无更新的旧排队任务也会转为失败。MongoDB 故障期间不能写入状态，恢复后继续巡检。
- 教师批改抽屉新增“重试 AI 批改”。接口 `POST /api/teachers/submissions/retry-ai` 接收 `submissionId`、`revision`，仅允许作业所属教师或管理员重试已经失败且不在自动重试中的提交。重试递增版本，不修改提交内容和提交次数；并发或过期重试返回 409，人工评分和已完成的工具评分不被补偿任务覆盖。

## 本地验证结果

- 后端构建通过；前端 Docker 构建包含类型检查并通过。
- 后端单元测试：12 个套件、24 个用例通过。
- 后端端到端测试：3 个套件、35 个用例通过。
- 前端安全测试：5 个用例通过。合计 64 个测试，本批新增 16 个。
- Docker 验收通过（MongoDB 7、Redis 7、Nginx）：拒绝未认证数据库访问，上传文件哈希在重建后保持一致，暂停任务能恢复；Redis 断连期间提交成功，恢复后自动投递和重试，教师重试不增加提交次数；Redis/MongoDB 故障时 readyz 返回 503，恢复后返回 200。临时容器和数据卷已清理。
- 新增模块及相关守卫、Worker、控制器、测试的 ESLint 通过；submissions.service.ts 仍有原来的两处在线答案字符串转换错误，未引入新的错误。完整仓库的历史 lint 问题没有在本批展开处理。
- Docker 镜像仍有原有依赖安全告警；前端仍有缺图、重复空 CSS 和大包警告，未据此宣称项目已完全具备上线条件。

## 新安装

```bash
# 从项目根目录运行，仅生成新配置，不会覆盖现有 .env.production
node backend/scripts/init-production-env.cjs
# 编辑 backend/.env.production 中的 CORS_ORIGINS
docker compose --env-file backend/.env.production up -d --build
```

需要支持 Compose `include` 的 Docker Compose 版本。验收脚本使用 `!override`，要求 Compose 2.24.4+。数据库和 Redis 密码使用脚本生成的十六进制值；自行更换为含 URI 特殊字符的密码时，需要同时正确处理连接串编码。JWT 和教师密钥加密配置应保密且持久保存。

外层反向代理/HTTPS 连接本机 8080。应用使用教师个人 AI Key；环境中的全局 Key 不会自动代替教师配置。

## 已有环境迁移

**2026-09-13 密钥泄露处理补充：** 如果仍使用历史仓库中的密钥，应按 [密钥处理和重新克隆步骤](secret-remediation-2026-09-13.md) 更换并处理教师 Key；下面的“保留密钥”仅适用于未泄露的配置。

**不能直接用初始化环境变量替换已有数据库的账号，也不要通过删除数据卷来解决启动问题。** Mongo 镜像初始化脚本只在空数据卷上执行。

1. 安排维护窗口，停止后端及旧 Worker 的写入，保存原始配置、数据库备份和上传文件。保持原来的 Compose 项目名（必要时显式 `-p 原项目名`），否则会生成另一组空数据卷。
2. 使用旧部署的受控 Mongo 运维入口创建/核对管理账号 `admin`（admin 库）以及应用账号 `yosem`（yosem_ai 库，readWrite 权限）；在 mongosh 内使用 `passwordPrompt()` 输入与新配置一致的密码，避免把密码写入命令历史。已有认证环境用现有管理员完成这一步。操作期间先限制旧数据库端口的访问。
3. 保留原 `JWT_SECRET` 和教师 Key 加密所需配置，在既有 `backend/.env.production` 中补充 `MONGO_ROOT_PASSWORD`、`MONGO_APP_PASSWORD`、`REDIS_PASSWORD`，调整 `TRUST_PROXY`。更换 JWT/加密配置可能使登录或已保存的 AI Key 失效。
4. 在替换旧后端容器前，用 `docker cp 旧容器:/app/uploads 本地备份目录` 保存上传文件。创建新后端容器及上传卷后，将原 uploads 目录内的内容复制到新容器 `/app/uploads/`，核对目录结构和文件数量，再启动后端与前端。旧绝对路径 `/app/uploads/...` 保持有效。
5. 使用新配置启动 MongoDB/Redis，再启动后端与前端；验收 readyz、教师登录、旧图片读取和旧成绩。旧任务可以先处理或排空；已超时任务由教师从失败状态重试，不要混跑旧 Worker。
6. 新旧代码回退时同样保留数据卷和密钥，不回退到无认证公网数据库或丢失上传的配置。

## 日常更新与配置文件保护

**历史重写后的第一次更新请改用 [重新克隆步骤](secret-remediation-2026-09-13.md#历史重写后的第一次服务器更新)，不要执行本节的首次 `git pull` 示例。** 完成切换后才恢复普通更新流程。

以下日常更新流程仅适用于已经完成上文账号、上传卷迁移的服务器。始终使用原来的 Compose 项目名；如原先使用 `-p`，后续命令也必须使用相同值。

**第一次拉取取消跟踪 `backend/.env.production` 的提交前，先备份服务器自己的配置。** Git 在应用文件删除记录时可能移除服务器上的旧文件；本地执行 `git rm --cached` 保留文件，不代表其他机器执行 `git pull` 也会保留。请在项目根目录逐步执行：

```bash
# 备份到仓库外，命令失败时先停止，不要继续拉取
config_backup=$(mktemp "$HOME/yosem-production-env.XXXXXX")
cp backend/.env.production "$config_backup"
chmod 600 "$config_backup"

git pull --ff-only
# 拉取成功后还原原配置，禁止用示例文件覆盖
cp "$config_backup" backend/.env.production
chmod 600 backend/.env.production
```

如果 `git pull` 提示有本地修改或发生冲突，先停止更新并保留备份，确认冲突内容后再处理；不要使用 `reset --hard` 丢弃配置。

配置还原并完成旧环境迁移后，检查配置并更新容器：

```bash
docker compose --env-file backend/.env.production config -q
docker compose --env-file backend/.env.production up -d --build --wait
docker compose --env-file backend/.env.production ps
curl -fsS http://127.0.0.1:8080/api/readyz
```

以后常规更新前先做好数据备份，再 `git pull --ff-only` 并执行上述容器更新命令。无需先 `down`；不要使用 `down -v`。初始化配置脚本只用于新安装，不为已有环境重新生成密钥。

取消跟踪不会清除 Git 历史中的旧配置。如果曾提交真实密钥，需要单独安排更换及已加密教师 Key 的迁移；本次精简没有自动更换任何密钥。

## 备份操作

仓库提供 `deploy/backup.sh`（Linux/服务器 Shell）。从项目根目录、停止业务写入后执行：

```bash
docker compose --env-file backend/.env.production stop backend
sh deploy/backup.sh --quiesced
docker compose --env-file backend/.env.production start backend
```

脚本把 MongoDB 的 `yosem_ai` 库压缩归档以及完整 uploads 目录写入同一时间戳备份目录，采用限制性文件权限；`backups/` 已忽略。使用了自定义 Compose 项目名时，备份也应设置相同 `COMPOSE_PROJECT_NAME`。将备份复制到受限的异机存储，并为服务器配置定期执行和失败告警。本次没有给真实服务器安装定时备份任务。

恢复时使用隔离环境初始化账号，将 Mongo 归档恢复至空的 `yosem_ai` 库，将上传归档解压到新 uploads 卷，保留原教师密钥加密配置，再核对记录数、图片哈希和人工成绩。Redis 队列不是成绩数据的唯一来源；新普通作业的待投递记录在 MongoDB 中，可恢复投递。恢复成功前不要切换真实流量。

## 验证命令

```bash
cd backend
npm test -- --runInBand
npm run test:e2e
npm run test:deployment
```

端到端测试自行创建可销毁 MongoDB；Docker 验收创建随机命名的独立 Compose 项目、随机密码和临时卷，完成或失败后只清理该测试项目。Docker 验收不读取真实教师密钥，不调用外部 AI，使用缺少本地测试 Key 的失败路径验证队列恢复。

覆盖：Redis 入队失败、提交落库后进程中断、并发投递租约、并发/越权重试、旧任务超时、人工评分竞争、重试耗尽、草稿/工具评分保护、HTTP 响应头和响应体超时、普通接口限流、同 IP 多用户、伪造转发头、探针豁免，以及真实容器中的数据库认证、上传后重建、Redis/MongoDB 断连与恢复。

审查第 10 项及生产依赖告警已在后续修复，见 [上传与依赖更新记录](upload-and-dependencies-2026-09-09.md)。服务器证书、磁盘监控、备份恢复演练和真实 AI 服务验收仍需在实际部署环境完成。
