# ReelForge

> 开源、供应商中立的 AI 视频内容生产基础设施 —— 官网 + 演示后台（前端 + 后端 API + 真实数据库，所有接口与页面均可实际运行）。

ReelForge 把「一句话出片」的视频生产流程做成了可运行的演示站点：内容官网、账号体系、项目管理、模板项目、视频项目工作台、智能装配 Agent，以及统一的大模型 API 接入与供应商能力体系。生成能力在配置 API Key 后走真实供应商（通义万相），未配置时优雅降级为演示态，不影响任何流程跑通。

## 技术栈

- **后端**：Node.js 22 + Express 5
- **数据库**：Node 内置 `node:sqlite`（文件型关系库，零原生依赖）；另附 `sql/mysql_schema.sql` 可直接迁移到 MySQL 8.0
- **前端**：原生 HTML / CSS / JavaScript（无构建步骤，离线可用），含统一设计系统与动态内容渲染
- **部署依赖**：仅 `express` 与 `multer`

## 快速开始

```bash
npm install
npm start            # 等价于 node --experimental-sqlite server.js
# 打开 http://localhost:3000
```

> `node:sqlite` 为 Node 22 实验特性，需 `--experimental-sqlite` 启动参数（已写入 `npm start`）。
> 如需自定义端口：`PORT=8080 npm start`。

### 安全配置（发布 / 生产必看）

本项目对敏感数据做了「排除 + 加固」处理：

- **运行时数据不入库**：用户、API Key、会话等仅存于本地 `data/*.db`（已被 `.gitignore` 忽略），仓库内无任何真实数据。
- **API Key 加密主密钥**：`REELFORGE_MASTER_KEY` 用于加密「API 接入」页存储的模型 Key（AES-256-GCM）。
  - 生产环境（`NODE_ENV=production`）**必须**设置，否则服务拒绝启动；建议值：`openssl rand -hex 32`。
  - 开发 / 演示环境未设置时，使用本次进程内随机密钥（仅本地可用，重启后已存 Key 不可解密，并在启动日志告警）。
- **演示管理员**：默认**不创建**（避免公开仓库泄露已知凭证）。需要演示账号时，设置 `REELFORGE_SEED_ADMIN=1`（并建议同时设强随机 `REELFORGE_ADMIN_PASSWORD`）。

```bash
# .env 关键安全项
REELFORGE_MASTER_KEY=$(openssl rand -hex 32)   # 生产必填
REELFORGE_SEED_ADMIN=1                           # 可选：启用演示管理员
REELFORGE_ADMIN_PASSWORD=改成你自己的强密码       # 可选：覆盖演示管理员密码
```

### 演示账号（仅当启用播种时存在）

- 设置 `REELFORGE_SEED_ADMIN=1` 后：管理员 `admin@reelforge.dev` / `REELFORGE_ADMIN_PASSWORD` 的值（默认 `reelforge-admin`，请务必修改）
- 或在 `/auth.html` 自行注册新账号
- **默认（未设置 `REELFORGE_SEED_ADMIN`）不创建任何管理员账号**

## 配置真实视频生成（可选）

默认生成走演示态。要真正出片，在「API 接入」页接入**通义万相（视频）** 即可（无需改代码）：

1. 打开左侧导航 → **API 接入**，新增供应商「通义万相（视频）」（阿里云百炼 DashScope）
2. 填入 API Key（阿里云百炼免费额度即可），模型默认 `wanx2.1-t2v-turbo`，设为默认
3. 进入模板工作台点「一键生成」即真实出片

或复制 `.env.example` 为 `.env` 填入 `REELFORGE_VIDEO_API_KEY`（后端兜底读取）：

```bash
cp .env.example .env
# 编辑 .env 填入 REELFORGE_VIDEO_API_KEY=你的密钥
```

## 已实现功能

**内容站（由数据库驱动）**
- 首页、特性、架构、定价、文档、关于、联系、404 共 8 页
- 主题预览 / 配色 / 变体 3 个设计系统演示页

**账号与控制台**
- 注册 / 登录 / 登出（HTTP-only 会话 Cookie，密码 scrypt 加盐哈希）
- 控制台（dashboard）：视频项目 / 模板项目 / 我的资产 三个视图

**视频项目工作台（studio.html，5 步）**
- ① 剧本 → ② 人物主题 → ③ 分镜 → ④ 视频生成 → 全流程
- 人物管理、分镜管理独立工作台；模型选择器与「API 接入」页已接入模型**实时联动**

**模板项目工作台（studio-template.html，3 步）**
- 选模板（按客户群体：短剧文旅 / 电商带货 / 企业品牌）→ 确认剧本 / 上传素材填槽位 → 一键生成
- 真实读取 API 接入的 Key 驱动生成（未配置则降级演示）

**智能装配 Agent（agent.html）**
- 用户上传素材 → 选模板包 → 智能体自动匹配槽位
- 无模型 Key 时走本地规则兜底（关键词匹配），有 OpenAI / Ollama Key 时走模型网关

**统一 API 接入（apikeys.html）**
- 20+ 供应商单一真源（`public/js/providers.js`）：OpenAI / Anthropic / Google / 通义千问 / 智谱 / DeepSeek / 可灵 / 即梦 / 通义万相 / Runway / Vidu / MiniMax / 硅基流动 / OpenRouter / 自定义 …
- 每个供应商带 `caps` 能力标签（text / image / video），工作台据此精确筛选可用模型
- 模型下拉「已接入优先」，未接入显示引导并一键跳配置页

## 目录结构

```
ReelForge/
├── server.js                 # Express 服务 + 所有 REST 接口
├── db.js                     # SQLite 建表与种子数据
├── auth.js                   # 密码哈希与会话工具
├── gen.js                    # 视频生成适配层（通义万相，可优雅降级）
├── routes/agent.js           # 智能装配 Agent 路由（素材上传 / 装配）
├── lib/
│   ├── agentRuntime/         # Agent 循环 / 工具注册 / prompts / tools
│   └── modelGateway/         # 模型网关（openai / ollama）
├── sql/mysql_schema.sql      # 生产环境 MySQL Schema
├── public/                   # 前端（HTML/CSS/JS）
│   ├── index.html features.html architecture.html pricing.html
│   ├── docs.html about.html contact.html 404.html auth.html
│   ├── dashboard.html studio.html studio-template.html
│   ├── agent.html apikeys.html templates.html
│   ├── themes-preview.html themes-schemes.html themes-variants.html
│   ├── css/styles.css
│   └── js/                   # site.js / studio.js / studio-template.js /
│                             #   agent.js / apikeys.js / dashboard.js /
│                             #   templates.js / providers.js / templates-page.js
├── data/                     # 种子数据（运行时数据库会自动生成）
│   ├── template_packs/       # 模板包 JSON
│   └── material_libraries/   # 素材库 JSON
├── .env.example              # 环境变量模板
└── package.json
```

> 注：`public/uploads/`（用户上传）、`data/*.db`（运行时数据库）、`node_modules/` 均不入库，详见 `.gitignore`。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/content` | 站点内容（特性 / 场景 / 指标 / 文档） |
| GET | `/api/stats` | 运行数据 |
| POST | `/api/auth/register` · `/login` · `/logout` | 认证 |
| GET | `/api/auth/me` | 当前用户 |
| GET/POST | `/api/projects` | 项目列表 / 新建（需登录） |
| GET/PUT/DELETE | `/api/projects/:id` | 项目详情 / 修改 / 删除（需登录） |
| GET | `/api/apikeys` | 已接入的 API 密钥（驱动模型目录） |
| GET | `/api/gen-config` | 视频生成是否已配置 |
| POST | `/api/projects/:id/generate` | 触发视频生成（真实 / 演示降级） |
| GET | `/api/tasks/:taskId` | 生成任务状态轮询 |
| POST | `/api/agent/materials` | 智能装配：素材上传 |
| POST | `/api/agent/assemble` | 智能装配：槽位匹配 |

## 设计要点

- **供应商单一真源**：`public/js/providers.js`（`window.ReelForgeProviders`）同时驱动「API 接入」页与所有工作台模型选择器，保证两处永远一致。
- **能力精确筛选**：每个模型带 `text / image / video` 能力标签，工作台按步骤只展示可用模型（如剧本步骤排除纯视频模型，视频步骤只显示视频模型）。
- **生成优雅降级**：`gen.js` 在未配置 Key 时 `isConfigured()=false` 不报错，前端自动回退演示，现有流程不受影响。
- **演示态边界**：内容站、账号、项目管理、API 接入、模型联动、智能装配均为真实可用；视频成片在未接入供应商 Key 时为演示占位。

## License

Apache-2.0
