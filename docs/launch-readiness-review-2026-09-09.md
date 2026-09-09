# 上线准备度审查（2026-09-09）

结论：业务闭环已具备，但当前版本不宜直接面向真实学生数据开放。需要先修复访问控制、成绩保护、富文本安全和部署持久化，再进行受控试点。

本次审查基于当前工作区代码、生产部署文件、构建、现有测试和隔离数据库接口验证；没有检查或扫描线上体验站，没有连接现有业务数据库，没有调用付费 AI API。未修改业务源码。测试使用自动创建并关闭的独立 MongoDB 8.2.1 实例，生产模板使用 MongoDB 7，两者差异仍应在预发布环境补验。

## 项目理解

- 面向中小学教师的教学管理与 AI 批改系统，包含管理员、教师、学生三个角色。
- 主流程：教师建班/添加学生 → 配置规则/发布作业 → 学生提交 → AI 异步批改 → 教师复核 → 学生查看反馈。
- 另有在线客观题自动评分、答题卡图片批分、批量作文图片检查、CSV 导出和线下结果回写。
- 前端是 Vue 3 + TypeScript + Vite + Element Plus + Vuex；README 中写的 Pinia 与实际依赖不一致。
- 后端是 NestJS + Mongoose/MongoDB，Redis/BullMQ 承担异步任务。当前普通作业 AI 批改实际读取教师个人密钥；管理员模型配置与环境变量并不等同于普通作业可用的批改密钥。
- 已有 JWT、bcrypt、Token 版本失效机制、角色守卫、DTO 验证、日志脱敏、生产配置检查及 Docker/Nginx 部署基础。

## 已执行验证

| 验证 | 结果 |
| --- | --- |
| 前端 `npm run build`（含类型检查） | 通过；存在缺少 picture.jpg、重复 CSS 产物名及大包警告 |
| 后端 `npm run build` | 通过 |
| 后端 `npm test -- --runInBand` | 7 个测试套件、14 个用例通过 |
| 现有 e2e，在隔离 MongoDB 上运行 | 6 个用例中 2 通过、4 失败 |
| 注册教师后读取其他教师班级名单 | HTTP 200，返回了学生记录 |
| 注册教师后指定其他教师 assignmentId 查询提交 | HTTP 200，返回了提交内容 |
| 提交含事件处理属性的 HTML | HTTP 201，内容原样保存并通过教师接口返回 |
| 学生将已人工评为 88 分的提交另存草稿 | HTTP 201，状态变成 draft，teacherScore 变成 null |
| 非班级学生读取作业提交页面的数据接口 | HTTP 200，返回其他班级作业信息 |
| 非班级学生读取班级详情 | HTTP 200，返回入班码 |
| AI Worker 使用模拟结果处理已人工复核提交 | 状态从 teacher_reviewed 变成 ai_reviewed |
| AI Worker 模拟 fetch 抛出异常 | 数据库对象状态仍为 ai_review_queued / processing |
| 开启实际全局限流后连续访问普通 healthz 接口 | 前 10 次 200，第 11 次 429 |
| `npm audit --omit=dev --json` | 前端 6 个依赖告警（5 high/1 moderate）；后端 14 个（8 high/5 moderate/1 low） |

依赖告警数是审查当天 npm 的依赖级统计，包含传递依赖；不等于已确认可利用漏洞数量，也不代表所有前端 Node 依赖都进入浏览器产物。

## 应作为上线阻断的问题

### 1. 教师能越权读取其他教师的学生与作业提交（高危，接口已复现）

位置：`backend/src/submissions/submissions.service.ts:353`、`backend/src/classes/classes.controller.ts:81`、`backend/src/classes/classes.service.ts:211`。

提交列表先建立教师自己的 assignmentId 白名单，但随后直接用请求参数覆盖该条件。班级学生列表只检查调用者是教师，没有校验班级归属；服务方法甚至没有接收 currentUser。

复现：使用另一个教师账号请求 `GET /api/teachers/submissions/list?assignmentId=<他人作业ID>` 或 `GET /api/classes/<他人班级ID>/students`，返回了其他教师的学生姓名/学号或提交内容。公开注册允许选择 teacher 并立即获得有效令牌（`auth.service.ts:139`），降低了攻击门槛；开放教师注册是否保留可以由产品决定，但数据隔离必须独立成立。

修复：服务层统一校验资源归属；筛选参数必须与授权条件取交集，不能覆盖授权范围。补两个教师互相访问应返回 403 的测试。

### 2. 非班级成员可以获取入班码及未授权作业信息（高危，接口已复现）

位置：`backend/src/classes/classes.controller.ts:38`、`backend/src/classes/classes.service.ts:115`、`:470`、`backend/src/submissions/submissions.service.ts:236`。

任意登录用户可以读取任意班级详情，返回值包含 code；公开班级列表又提供班级 ID。新注册学生无需原本知道邀请码，即可获取邀请码。另一个 `students/submissions/my/:assignmentId` 接口只限制返回自己的提交，却没有限制其中作业信息的班级归属或草稿可见性，与正常学生作业详情接口的校验不一致。

修复：非成员只能读取明确设计的公开字段，入班码只给管理该班级的教师；所有返回作业信息的入口复用统一的成员资格及发布状态校验。

### 3. 学生保存草稿可以抹掉教师成绩，并重置提交次数限制（高危，接口已复现）

位置：`backend/src/submissions/submissions.service.ts:145`。

“已人工批改不可再提交”与“两次提交限制”均只在 `!payload.isDraft` 时检查，但草稿分支仍覆盖原提交、清空 teacherScore/teacherReviewContent，并设置状态为 draft。下一次正式提交时，existing.isDraft 又使 previousSubmittedCount 归零。

复现：教师将学生提交评为 88 分 → 学生对同一作业发送 `isDraft:true` → 请求成功，教师成绩为 null。触发条件是作业仍 published、尚未截止且学生仍为有效成员。

修复：草稿与正式版本分开保存，或禁止任何草稿请求修改已提交/已复核记录；提交次数独立累计。用原子条件更新保护状态变更，保留人工成绩修改历史。

### 4. 学生富文本可进入教师页面，存在存储型 XSS 路径（高危）

位置：`backend/src/submissions/submissions.service.ts:125` 附近的 submissionContent、`src/views/teacher/assignments/detail/components/GradingDrawer.vue:113`、`src/utils/request.ts:59`。

后端仅把 content 转字符串并 trim；教师批改抽屉通过 v-html 渲染。隔离接口已验证 `<img src=x onerror="window.__auditXss=1">` 原样存储并返回。前端令牌位于 localStorage；若浏览器执行注入内容，可在教师权限下调用接口或读取令牌。本次没有在浏览器执行恶意内容，结论依据完整的数据流及原样保存证据。

修复：在可信边界使用 HTML 白名单清洗，显示端也做防御性清洗；Markdown 转 HTML 同样处理，统一封装富文本渲染组件。CSP 作为辅助防线，不能替代清洗。

### 5. AI 队列没有保护人工复核状态和提交版本（高优先级，Worker 模拟已复现）

位置：`backend/src/submissions/ai-review.processor.ts:48`、`:82`、`:108`、`backend/src/submissions/ai-review-queue.service.ts:8`。

Worker 不检查 teacher_reviewed，开始和结束都直接写状态。已人工复核的记录会被改回 ai_reviewed；此处不会直接清空 teacherScore，但状态保护失效后，其他提交路径可能再清空成绩。任务数据也只有 submissionId，没有提交修订号；旧任务或重试结果可能落到更新后的提交记录上。

修复：任务包含 submissionId + revision；只对匹配版本及允许状态的记录执行原子写入。人工复核设不可被 AI 改写的终态。任务去重、旧任务结果丢弃都应有测试。

### 6. 一份生产部署模板将无认证数据库直接暴露到宿主机（高危，配置证据）

位置：`backend/compose.prod.yml:34`、`:48`。

MongoDB 和 Redis 都映射至宿主机所有接口，没有在 Compose 中开启数据库认证。按 README 的后端独立部署路径上线，且服务器防火墙允许这些端口时，外部可直接访问数据库/队列。根目录 docker-compose.yml 没有发布这两个端口，本问题特指 backend/compose.prod.yml，不表示线上服务器已实际暴露。

修复：合并并明确唯一生产入口，移除数据库公网端口映射；需要运维入口时仅绑定回环或使用隧道。启用数据库凭证与网络访问限制，并检查服务器实际监听和防火墙。

### 7. 上传文件没有持久化，重建后端容器会丢失（高优先级，配置证据）

位置：`backend/src/teacher-tools/teacher-tools.service.ts:876`、`backend/src/teacher-tools/teacher-tools.constants.ts:3`、`docker-compose.yml:18`、`backend/compose.prod.yml:2`。

图片写到 process.cwd() 下的 uploads/teacher-tools，MongoDB 只保存路径。两份生产 Compose 均未给后端挂载上传目录。重建或替换容器后，原图片丢失，尚未完成的任务/重试会找不到文件；多实例部署也无法共享文件。

修复：至少挂载 /app/uploads 的持久卷并纳入备份；多实例使用共享存储或对象存储，保存对象标识而非机器绝对路径。通过“上传→排队→重建容器→继续处理”的部署测试验收。

## 上线前应继续处理的问题

### 8. 登录限流误作用于普通接口（高优先级，已复现）

位置：`backend/src/app.module.ts:76`、`src/views/student/submissions/composables/useAiReviewPolling.ts:21`。

default 和 auth 两个限流器均注册为全局，普通接口没有跳过 auth，因此也受默认每分钟 10 次的限制。隔离环境启用实际限流配置后，普通接口第 11 次请求返回 429。前端开始时每 3 秒轮询，单个用户就可能碰到限制，同校出口 IP 共用会加重问题。

修复：认证入口单独应用认证限流；业务接口按用户及业务类型限流，并验证轮询场景。现有 TRUST_PROXY=true 还需与可信代理范围配套，避免随意信任客户端提供的转发头。

### 9. AI 故障时可能一直显示“处理中”，入队失败缺少恢复路径（高优先级）

位置：`backend/src/submissions/doubao-ai-review.service.ts:46`、`backend/src/submissions/ai-review.processor.ts:82`、`backend/src/submissions/submissions.service.ts:520`。

普通作业 AI fetch 没有显式超时；网络/JSON 异常会直接抛出，Worker 的失败状态处理只覆盖 result.success=false 的情况。模拟 fetch 抛错后状态停留在 ai_review_queued/processing。BullMQ 可以重试，但重复抛异常直至耗尽后，应用记录仍可能显示处理中。另有“先保存已提交/已排队状态，再向 Redis 入队”的窗口；入队失败或进程退出会留下没有实际队列任务的记录。

修复：明确请求超时；在异常和最终重试耗尽时落库失败状态；增加人工重试入口、超时任务巡检，以及可靠的待投递记录/补偿机制。避免用户因错误响应重试而多消耗提交次数。

### 10. 上传大小限制冲突，并有内存与磁盘增长风险（中高优先级）

位置：`backend/src/teacher-tools/teacher-tools.controller.ts:112`、`:153`、`nginx.conf:24`。

接口允许 100/105 张图片，每张 15 MiB，使用默认内存上传，而 Nginx 整个请求上限是 50M。真实班级批量上传很容易先被网关拒绝；直接访问后端时，单个请求理论上可让图片缓冲超过 1 GiB。仅凭客户端 MIME 判断图像类型；未见上传总容量、用户存储配额或文件清理任务，预览和失败任务的文件也可能长期累积。

修复：统一前后端/网关限制，按总字节数控制批次，采用分批或对象存储上传；在接收前后限制资源，检验真实文件格式，设置配额和到期清理。不要只把 Nginx 限制调大。

### 11. 初始弱密码仍可访问业务接口，强制改密仅靠前端流程（高优先级）

位置：`backend/src/users/users.service.ts:330`、`:389`、`backend/src/auth/guards/jwt-auth.guard.ts:19`、`backend/src/auth/auth-context.service.ts:55`。

批量导入及默认重置密码仍使用固定 123456。mustChangePassword 被放进用户上下文，但后端守卫不据此限制业务接口。登录后直接请求 API 可以跳过前端改密页。

修复：使用随机一次性激活凭证；未完成首次改密只允许必要的个人资料、改密和退出接口，完成后再获得业务权限。生产禁用演示 seed 已存在，但不等于从旧数据库迁移来的演示账号已经清除。

### 12. 就绪检查不会发现依赖故障（中高优先级）

位置：`backend/src/app.controller.ts:18`、`backend/src/app.service.ts:16`、`backend/scripts/healthcheck.js:2`。

healthz 和 readyz 使用同一方法，固定返回 ok:true，不检查 MongoDB 或 Redis；容器健康检查只访问 healthz。启动以后数据库/队列不可用时，服务仍可能被判断为健康。

修复：保留轻量存活检查，单独实现带短超时的数据库/必需队列就绪检查，并返回明确的失败 HTTP 状态；配套错误率、队列积压、磁盘容量监控告警。

### 13. 已有端到端测试过期，不能作为发布保障（中高优先级，实际运行失败）

位置：`backend/test/app.e2e-spec.ts:160`、`:264`、`backend/src/auth/dto/login.dto.ts:4`。

4 项失败均在登录相关请求收到 400；测试仍发送 usernameOrEmailOrStudentId，而当前接口要求 usernameOrStudentId。测试还期待邮箱注册/邮箱登录等已经变化的行为。单元测试通过不表示主要业务链路及权限边界受到有效保护。

修复：按实际产品约定更新 e2e；加入本报告的跨教师访问、入班码保护、已复核转草稿、AI 延迟结果、队列断连、容器重建文件恢复等测试。将构建和测试设为发布门槛。测试环境 seed 会 dropDatabase，TEST_MONGODB_URI 必须始终指向可销毁隔离库。

### 14. 运行依赖存在已知安全告警（需逐项分诊）

来源：审查当天分别在前后端执行 `npm audit --omit=dev --json`。

- 前端：6 个告警，含 axios、echarts、xlsx 及传递依赖。
- 后端：14 个告警，含 NestJS 相关包、multer、mongoose、bullmq 等。
- xlsx 0.18.5 是实际使用的 Excel 导入依赖，npm audit 显示无直接修复版本；不能期待只运行 npm audit fix 就全部解决。

先核对可达代码路径、受影响条件和修复版本，再升级锁文件并回归上传/导入/队列。SheetJS 官方说明公共 npm 源的 xlsx 停留在 0.18.5，当前发行包通过其 CDN 获取，参考[官方安装说明](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)；ReDoS 受影响范围见[安全公告](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)。

## 另外需要明确的产品与运维事项

- 找回密码：auth.service.ts:233 生成重置令牌，生产环境不返回令牌，但没有邮件/短信等交付路径。目前不是完整可用的自助找回功能，应实现验证渠道或明确走管理员重置。
- AI 配置：普通作业 DoubaoAiReviewService 要求传入教师个人 Key，仅设置环境 DOUBAO_API_KEY 不会让该路径成功。README/设置页/就绪诊断需要统一，并在发布或提交前提示缺失配置。
- AI 输出：普通作业仅提示模型输出 0–100，结果读取没有对应的完整结构与分值边界校验。正式成绩需要教师复核及明确的发布策略；不能把提示词当作校验器。
- 备份恢复：仓库未提供数据库与上传文件的定时备份、恢复演练及版本回退流程；需核查服务器是否另有配置。
- 学生信息：需要明确采集字段、发送 AI 的内容、保留期限、访问范围、删除流程和演示/真实数据隔离。本次没有进行法律合规结论判断。
- 前端体验：构建报告了缺少 /picture.jpg、重复空 CSS 文件名；ai_loading.gif 约 6 MiB，Element Plus 分包约 1 MiB。应在普通手机和弱网络下验收，但优先级低于访问控制和数据安全。

## 建议实施顺序与上线验收

1. 先修权限与数据完整性：问题 1–5、11，并添加对应的失败访问与状态转换测试。
2. 再收敛生产配置：问题 6–10、12，完成数据库断连、队列异常及容器重建验证。
3. 更新依赖和 e2e，补备份恢复、监控、AI 配置提示；用 MongoDB 7/Redis 7 和真实反向代理完成预发布验收。
4. 先以小范围、非敏感样本试点；验收教师人工成绩不被覆盖、跨教师不能读取数据、异常任务可恢复后再扩展真实使用。

本报告给出的是代码和隔离测试层面的上线准备度，服务器端口、证书、备份、实际 AI 服务表现和承载能力仍需部署环境验收。
