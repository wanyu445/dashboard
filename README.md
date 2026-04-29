# Dashboard

给 `Cyberboss` 用的本地查看面板。
`Cyberboss`的项目地址：`https://github.com/WenXiaoWendy/cyberboss`

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

- `http://0.0.0.0:30xx`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认监听：

- `http://0.0.0.0:51xx`

前端开发服务器会把 `/api` 和 `/timeline-site` 代理到后端的 `30xx` 端口。

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

- 后端会自动读取 `backend/.env` 和 `backend/.env.local`
- shell / pm2 / systemd 注入的同名环境变量优先级更高

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

## 对话页接入 Cyberboss

`timeline / diary / memory / state` 只要本地状态目录存在就能工作。  
`conversation` 页面额外要求 `Cyberboss` 主项目把结构化会话日志写入：

- `~/.cyberboss/conversations/YYYY-MM-DD.jsonl`

这一块建议直接按当前 `Cyberboss` 源码的组织方式改。  
如果你让 `Codex` 来复现，重点让它看下面这些文件并按职责接线即可：

- `src/core/config.js`
- `src/services/conversation-recorder.js`
- `src/core/app.js`
- `src/adapters/runtime/claudecode/events.js`
- `src/adapters/runtime/codex/events.js`

### 1. 在配置层提供 conversations 目录

在 `src/core/config.js` 里增加一个会话日志目录配置，指向状态目录下的 `conversations` 子目录。

当前源码可参考的目标形态是：

- `conversationDir = path.join(stateDir, "conversations")`

这样 `dashboard` 就能稳定从 `~/.cyberboss/conversations/*.jsonl` 读取数据。

### 2. 增加一个按天落盘的会话记录器

新增 `src/services/conversation-recorder.js`，职责尽量单一：

- 按天写入 `jsonl`
- 一行一个事件
- 文件名按日期切分
- 不直接依赖前端格式，只输出稳定的中间记录

建议至少保留这些字段：

- `id`
- `type`
- `timestamp`
- `threadId`
- `turnId`
- `workspaceRoot`
- `text`
- `meta`

`type` 至少覆盖：

- `user`
- `assistant`
- `thinking`
- `tool_use`
- `tool_result`
- `approval`

### 3. 在 app 主流程里接两个记录入口

在 `src/core/app.js` 里做两类接线：

- 应用初始化时创建 `ConversationRecorder({ dirPath: config.conversationDir })`
- 收到用户消息时先落一条 `user`
- runtime adapter 回来的标准事件继续落盘

对 `Codex` 来说，真正需要改的是两段路径：

- inbound message 路径：用户消息刚进入系统、还没送去 runtime 之前
- runtime event 路径：统一事件链里收到 provider 映射后的事件时

换句话说，`app.js` 里至少要存在这两种调用：

- `recordInboundMessage(...)`
- `recordRuntimeEvent(event)`

### 4. 用户消息要把附件一起写进去

如果希望 `dashboard` 的对话页显示图片，单纯写文本不够。  
在记录 `user` 消息时，要把附件信息保留到 `meta.attachments` 里。

建议每个附件至少保留：

- `kind`
- `label`
- `fileName`
- `filePath`

当前 `dashboard` 会优先用真实文件路径渲染图片，所以这里最关键的是：

- `meta.attachments[].filePath` 必须可用

如果主项目里已有附件对象但字段名不同，也可以在记录器里做一次归一化；当前源码就是按 `entry.filePath || entry.absolutePath` 这类思路做兼容。

### 5. adapter 层要先把 provider 事件映射成标准事件

`dashboard` 不直接吃 provider 原始事件，它期待的是主项目 runtime adapter 已经映射好的标准事件。

参考：

- `src/adapters/runtime/claudecode/events.js`
- `src/adapters/runtime/codex/events.js`

优先保证这些事件能够产出，并带上 `threadId / turnId / timestamp`：

- `runtime.reply.completed`
- `runtime.thinking`
- `runtime.tool.use`
- `runtime.tool.result`
- `runtime.approval.requested`

如果 provider 原本吐的是更底层的原始消息，就先在 adapter 里做映射，再交给 `app.js` 统一记录。

### 6. ClaudeCode 和 Codex 的差异要接受降级

当前这份源码里，`ClaudeCode` adapter 已经能映射：

- 回复完成
- thinking
- tool use / result
- approval

而 `Codex` adapter 目前更接近：

- 回复完成
- approval
- turn / context 一类状态事件

也就是说，如果你接的是 `Codex`，对话页可以正常显示消息和部分工具/审批信息，但不一定能拿到像 `ClaudeCode` 那样完整的 `thinking` 文本。  
这不是 `dashboard` 的问题，而是主项目 runtime adapter 当前能否拿到并映射这些事件的问题。

### 7. Codex 复现时最低目标

只要主项目最终能稳定写出上面的 `jsonl`，`dashboard` 对话页就能工作。最低可用效果是：

- 用户消息
- assistant 消息
- 基于 `threadId` 的线程识别
- thinking 折叠块（如果上游提供）
- tool use / tool result 折叠块（如果上游提供）
- 图片附件显示（如果 `meta.attachments[].filePath` 可用）

不需要把 provider 自己的原始日志格式直接喂给前端。

## 分享给别人前需要注意

- 不要把你自己的 `~/.cyberboss`、截图缓存或对话日志一起提交
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
