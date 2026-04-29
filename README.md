# Dashboard

给 `Cyberboss` 用的本地查看面板。

它主要解决两件事：

- 不上云端也能在手机或电脑浏览器里查看 `timeline / diary / memory / state / conversation`
- 把 `thinking`、工具调用、对话消息整理成更适合日常查看的移动端界面

## 仓库结构

```text
dashboard/
  backend/   Fastify API
  frontend/  Vue 3 + Vite + Vant
```

## 运行时读取哪些数据

默认读取下面这些本地目录：

- `~/.cyberboss`

其中：

- `timeline / diary / memory / state` 来自 `~/.cyberboss`
- `conversation` 读取 `~/.cyberboss/conversations/*.jsonl`

这个仓库本身不包含你的个人数据，它只是在运行时去读这些目录。

## 环境要求

- Node.js `>= 18`
- 一份正在运行或已经产出数据的 `Cyberboss`

## 开发模式

### 1. 启动后端

```bash
cd backend
npm install
npm run dev
```

默认监听：

- `http://0.0.0.0:3011`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认监听：

- `http://0.0.0.0:5174`

前端开发服务器会把 `/api` 和 `/timeline-site` 代理到 `3011`。

## 单服务部署

如果你想只开一个服务，先构建前端：

```bash
cd frontend
npm install
npm run build
```

然后启动后端：

```bash
cd backend
npm install
npm start
```

当 `frontend/dist/index.html` 存在时，后端会自动托管前端页面。

## 可配置环境变量

常用环境变量如下：

- `CYBERBOSS_STATE_DIR`
- `CYBERBOSS_DASHBOARD_HOST`
- `CYBERBOSS_DASHBOARD_PORT`
- `CYBERBOSS_DASHBOARD_AUTH_PASSWORD`
- `CYBERBOSS_DASHBOARD_AUTH_SESSION_DAYS`
- `CYBERBOSS_DASHBOARD_DIST_DIR`
- `CYBERBOSS_PROJECT_ROOT`
- `CYBERBOSS_WEIXIN_INSTRUCTIONS_FILE`

示例见 `backend/.env.example`。

注意：

- 这个项目不会自动读取 `.env` 文件
- 这些变量需要由你的 shell、pm2、systemd 或部署平台注入

## 鉴权

支持一个适合个人部署和小范围分享的最小鉴权层。

只要设置：

```bash
CYBERBOSS_DASHBOARD_AUTH_PASSWORD=your-password
```

后端就会：

- 保护所有 `/api/*` 数据接口
- 保护 `/timeline-site/*` 完整时间轴静态页面
- 放行登录页和前端静态资源

前端会自动显示登录页。登录成功后，会把会话 token 保存在浏览器本地，并在后续请求里自动带上。

补充说明：

- 如果没有设置 `CYBERBOSS_DASHBOARD_AUTH_PASSWORD`，鉴权就是关闭状态，任何能访问服务的人都能直接读取数据
- 当前鉴权是“单口令 + Bearer token + 浏览器本地存储”的最小方案，适合个人使用、内网访问或小范围可信分享
- token 默认有效期是 30 天，可通过 `CYBERBOSS_DASHBOARD_AUTH_SESSION_DAYS` 调整
- 修改 `CYBERBOSS_DASHBOARD_AUTH_PASSWORD` 后，旧 token 会失效，需要重新登录
- 退出登录只会清掉当前浏览器本地 token；这个项目没有服务端会话吊销列表
- 如果你要把它暴露到公网，至少应放在 HTTPS、反向代理、内网穿透鉴权或 VPN 后面，不要把裸服务直接公开

## 对话页接入 Cyberboss

`timeline / diary / memory / state` 只要本地状态目录存在就能工作。  
`conversation` 页面额外要求 `Cyberboss` 主项目把对话过程写入：

- `~/.cyberboss/conversations/YYYY-MM-DD.jsonl`

推荐直接按当前这份 `Cyberboss` 源码的结构接入，重点是下面几处：

### 1. 在主项目配置里增加 conversation 目录

在 `src/core/config.js` 增加：

- `config.conversationDir = path.join(config.stateDir, "conversations")`

### 2. 增加结构化会话记录器

新增 `src/services/conversation-recorder.js`，职责保持简单：

- 按天写入 `jsonl`
- 一行一个事件
- 至少写入这些字段：
  - `id`
  - `type`
  - `timestamp`
  - `threadId`
  - `turnId`
  - `workspaceRoot`
  - `text`
  - `meta`

事件类型至少覆盖：

- `user`
- `assistant`
- `thinking`
- `tool_use`
- `tool_result`
- `approval`

### 3. 在 `src/core/app.js` 里接入记录器

按当前项目的组织方式，做两件事：

- 在应用初始化时创建 `ConversationRecorder({ dirPath: config.conversationDir })`
- 在收到用户消息、进入 runtime 之前，先记录一条 `user`
- 在 runtime 事件处理链里，把可展示事件继续写入会话文件

也就是说，`app.js` 里至少要有两个记录入口：

- inbound message -> `recordInboundMessage(...)`
- runtime event -> `recordRuntimeEvent(event)`

### 4. 让 runtime adapter 提供可记录的标准事件

`dashboard` 的对话页依赖主项目 runtime adapter 输出标准化事件。  
参考当前源码里的这两个文件：

- `src/adapters/runtime/claudecode/events.js`
- `src/adapters/runtime/codex/events.js`

需要确保它们能产出这些事件名，并带上 `threadId / turnId / timestamp`：

- `runtime.reply.completed`
- `runtime.thinking`
- `runtime.tool.use`
- `runtime.tool.result`
- `runtime.approval.requested`

如果 adapter 里本来只有原始 provider 事件，先在这里完成映射，再交给 `app.js` 记录。

### 5. Dashboard 默认期待的数据效果

只要主项目能稳定写出上面的 `jsonl`，对话页就能展示：

- 用户消息
- assistant 消息
- thinking 折叠块
- tool use / tool result 折叠块
- 基于 `threadId` 的线程识别

不需要把 provider 的原始日志格式直接喂给前端。

## 分享给别人前需要注意

- 不要把你自己的 `~/.cyberboss`、截图缓存或对话日志一起提交
- 不要提交 `.env`、私钥、证书、日志文件或任何临时导出的状态数据
- 不要提交 `node_modules` 和 `dist`
- 如果你改过 `Cyberboss` 主项目来生成结构化会话记录，建议在说明里写清楚版本或补丁来源

## 当前包含的页面

- 对话
- 时间轴
- 日记
- 记忆
- 状态
- 微信指令查看

## 适合的使用方式

- 自己本地运行，浏览器直接访问
- 部署在自己的云主机上，通过手机浏览器查看
- 作为 `Cyberboss` 的配套只读面板分享给其他使用者
