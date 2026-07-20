'use strict';
// ReelForge — database layer (Node.js built-in SQLite, node:sqlite)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword, sessionExpiry } = require('./auth');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.REELFORGE_DB || path.join(DATA_DIR, 'reelforge.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',   -- member | admin
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'short_video', -- short_video | ad | course | news | other
  status      TEXT NOT NULL DEFAULT 'draft',        -- draft | queued | rendering | done | failed
  prompt      TEXT,
  description TEXT,
  meta        TEXT,                                  -- JSON: model vendor, duration, etc.
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  company    TEXT,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS features (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'spark',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS use_cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metrics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS docs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'guide',
  body        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
`);

// ---------------------------------------------------------------------------
// Tiny transaction helper (node:sqlite has no .transaction())
// ---------------------------------------------------------------------------
function tx(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Seed (only when content tables are empty)
// ---------------------------------------------------------------------------
function seedIfEmpty() {
  const countFeatures = db.prepare('SELECT COUNT(*) AS c FROM features').get().c;
  if (countFeatures > 0) return;

  const insertFeature = db.prepare(
    'INSERT INTO features (title, summary, icon, sort_order) VALUES (?, ?, ?, ?)'
  );
  const features = [
    ['供应商中立的模型网关', '统一接入自研、开源与商业文/图生视频大模型，一处配置、自由切换，彻底告别供应商锁定。', 'gateway', 1],
    ['可视化生产流水线', '拖拽式编排脚本、分镜、配音、字幕、合成等节点，流程可复用、可版本化、可协作。', 'flow', 2],
    ['剧本与分镜助手', '基于大模型的选题、脚本、分镜自动生成与改写，把创意到成片的距离缩短到分钟级。', 'script', 3],
    ['批量与队列渲染', '任务队列、并发控制、断点续渲与成本估算，让大规模内容生产稳定可控。', 'queue', 4],
    ['素材与资产管理', '统一管理图片、音频、视频、字体与模板，支持标签、检索与权限共享。', 'assets', 5],
    ['字幕与多语言本地化', '自动字幕、翻译与多语种配音，一键生成同一内容的多语言版本。', 'locale', 6],
    ['可观测与成本治理', 'Token/算力用量、成本看板、配额与审计，让每一分预算都看得见。', 'observe', 7],
    ['开源与自托管', 'Apache-2.0 协议，支持私有化部署与插件化扩展，数据完全掌握在自己手中。', 'opensource', 8],
  ];
  tx(() => features.forEach(f => insertFeature.run(...f)));

  const insertUse = db.prepare(
    'INSERT INTO use_cases (title, description, sort_order) VALUES (?, ?, ?)'
  );
  const uses = [
    ['营销短视频团队', '统一生产品牌短视频，按渠道批量生成不同尺寸与风格的成片。', 1],
    ['电商与直播带货', '为商品快速生成卖点短视频与种草内容，旺季也能弹性扩产。', 2],
    ['教育培训', '把课程大纲自动转译为带字幕与配音的教学短视频。', 3],
    ['媒体与自媒体', '热点选题到成片的全流程自动化，显著提升更新频率。', 4],
    ['企业内部沟通', '批量生成培训、公告与活动视频，降低制作门槛与外包成本。', 5],
  ];
  tx(() => uses.forEach(u => insertUse.run(...u)));

  const insertMetric = db.prepare(
    'INSERT INTO metrics (label, value, sort_order) VALUES (?, ?, ?)'
  );
  const metrics = [
    ['开源协议', 'Apache-2.0', 1],
    ['可接入模型供应商', '12+', 2],
    ['平均生产成本下降', '60%', 3],
    ['内容生产提速', '5×', 4],
  ];
  tx(() => metrics.forEach(m => insertMetric.run(...m)));

  const insertDoc = db.prepare(
    'INSERT INTO docs (title, category, body, sort_order) VALUES (?, ?, ?, ?)'
  );
  const docs = [
    ['快速开始', 'guide',
`# 快速开始

ReelForge 是开源、供应商中立的 AI 视频内容生产基础设施。

## 1. 自托管（Docker）

` + '```bash' + `
docker run -d -p 8080:8080 ghcr.io/reelforge/reelforge:latest
` + '```' + `

## 2. 使用 CLI 创建第一条流水线

` + '```bash' + `
reelforge pipeline create --name "my-first-reel" \\
  --model vendor:open --script "夏日新品发布" \\
  --voice zh-CN-female
` + '```' + `

## 3. 通过 API 提交渲染任务

` + '```bash' + `
curl -X POST http://localhost:8080/api/v1/render \\
  -H "Authorization: Bearer $RF_TOKEN" \\
  -d '{"pipeline":"my-first-reel","quantity":3}'
` + '```' + `

更多内容请参阅「架构」与「文档」页面。`, 1],
    ['核心概念：模型网关', 'concept',
`# 模型网关（Model Gateway）

模型网关是 ReelForge 的「供应商中立」核心。它通过统一的适配层接入多种文生视频 / 图生视频模型：

- 自研模型（私有部署）
- 开源模型（如开源视频扩散模型）
- 商业模型（第三方 API）

你只需在配置中声明供应商与密钥，业务代码无需任何改动即可切换。`, 2],
    ['API 参考', 'api',
`# API 参考（摘要）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/v1/render | 提交渲染任务 |
| GET | /api/v1/projects | 列出项目 |
| GET | /api/v1/projects/:id | 获取项目详情 |
| POST | /api/v1/webhooks | 接收渲染完成回调 |

本站点同时提供演示用的 REST 接口（见 /api 前缀）。`, 3],
  ];
  tx(() => docs.forEach(d => insertDoc.run(...d)));

  // 演示管理员见下方 ensureDemoAdmin()（每次启动按环境变量决定是否保种，独立于内容播种）
}

// ---------------------------------------------------------------------------
// Schema extensions (idempotent — safe to run on an existing DB)
// ---------------------------------------------------------------------------
function ensureSchemaExtensions() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const add = [
    ['plan', "TEXT NOT NULL DEFAULT 'free'"],
    ['membership_status', "TEXT NOT NULL DEFAULT 'inactive'"],
    ['membership_started_at', 'TEXT'],
    ['membership_expires_at', 'TEXT'],
  ];
  for (const [name, def] of add) {
    if (!cols.includes(name)) {
      db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${def}`).run();
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      model TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assembly_results (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      library_id TEXT,
      pack_id TEXT,
      script_id TEXT,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  // 演示：平台管理员默认拥有有效会员，便于后台演示「制作视频」
  db.prepare(
    "UPDATE users SET plan='enterprise', membership_status='active', membership_started_at=datetime('now'), membership_expires_at=? WHERE role='admin'"
  ).run(sessionExpiry());
}

ensureSchemaExtensions();

// ---------------------------------------------------------------------------
// 演示管理员（独立于内容播种，每次启动按环境变量决定是否保种）
// 默认不创建（避免公开仓库泄露已知凭证）；设置 REELFORGE_SEED_ADMIN=1 时确保存在。
// ---------------------------------------------------------------------------
function ensureDemoAdmin() {
  if (process.env.REELFORGE_SEED_ADMIN !== '1' && process.env.REELFORGE_SEED_ADMIN !== 'true') {
    return; // 未启用：不创建、不打印，避免每次启动刷屏
  }
  const adminEmail = (process.env.REELFORGE_ADMIN_EMAIL || 'admin@reelforge.dev').trim();
  const adminPassword = (process.env.REELFORGE_ADMIN_PASSWORD || 'reelforge-admin').trim();
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (existingAdmin) return;
  const h = hashPassword(adminPassword);
  db.prepare("INSERT INTO users (email, name, password_hash, role, plan, membership_status, membership_started_at, membership_expires_at) VALUES (?, ?, ?, 'admin', 'enterprise', 'active', datetime('now'), ?)")
    .run(adminEmail, 'ReelForge 管理员', h, sessionExpiry());
  console.log(`[ReelForge] 已创建演示管理员账号 ${adminEmail}，请尽快修改密码。`);
}
ensureDemoAdmin();

module.exports = { db, seedIfEmpty, ensureDemoAdmin };
