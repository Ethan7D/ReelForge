'use strict';
// ReelForge — backend server (Express + built-in node:sqlite)
const path = require('path');
const fs = require('fs');
const express = require('express');
const { db, seedIfEmpty } = require('./db');
const { hashPassword, verifyPassword, newSessionToken, sessionExpiry, encrypt, decrypt } = require('./auth');
const multer = require('multer');

// 极简 .env 加载（无外部依赖）：存在 .env 时注入 process.env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
} catch (e) { /* 忽略 .env 读取错误 */ }

const gen = require('./gen');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function loadUserFromSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.rf_session;
  if (!token) return null;
  const row = db
    .prepare('SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.plan, u.membership_status, u.membership_started_at, u.membership_expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    plan: row.plan || 'free',
    membership_status: row.membership_status || 'inactive',
    membership_started_at: row.membership_started_at || null,
    membership_expires_at: row.membership_expires_at || null,
  };
}

function requireAuth(req, res, next) {
  const user = loadUserFromSession(req);
  if (!user) return res.status(401).json({ error: '未登录或会话已过期' });
  req.user = user;
  next();
}

function isMembershipActive(u) {
  if (u.role === 'admin') return true; // 平台方默认可制作
  if (!u.membership_status || u.membership_status !== 'active') return false;
  if (!u.membership_expires_at) return false;
  const exp = new Date(u.membership_expires_at.replace(' ', 'T') + 'Z');
  return exp > new Date();
}

// 制作视频前必须开通有效会员（管理员豁免）
function requireActiveMembership(req, res, next) {
  const user = loadUserFromSession(req);
  if (!user) return res.status(401).json({ error: '未登录或会话已过期' });
  if (!isMembershipActive(user)) {
    return res.status(403).json({ error: '请先开通会员，才能制作视频', code: 'MEMBERSHIP_REQUIRED' });
  }
  req.user = user;
  next();
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    membership: {
      plan: u.plan || 'free',
      status: u.membership_status || 'inactive',
      started_at: u.membership_started_at || null,
      expires_at: u.membership_expires_at || null,
      isActive: isMembershipActive(u),
    },
  };
}

// ---------------------------------------------------------------------------
// Public content
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ ok: true, product: 'ReelForge', time: new Date().toISOString() }));

app.get('/api/content', (req, res) => {
  const features = db.prepare('SELECT id, title, summary, icon, sort_order FROM features ORDER BY sort_order').all();
  const useCases = db.prepare('SELECT id, title, description, sort_order FROM use_cases ORDER BY sort_order').all();
  const metrics = db.prepare('SELECT id, label, value, sort_order FROM metrics ORDER BY sort_order').all();
  const docs = db.prepare('SELECT id, title, category, body, sort_order FROM docs ORDER BY sort_order').all();
  res.json({ features, useCases, metrics, docs });
});

app.get('/api/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const projects = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  const contacts = db.prepare('SELECT COUNT(*) c FROM contacts').get().c;
  const subscribers = db.prepare('SELECT COUNT(*) c FROM subscribers').get().c;
  res.json({ users, projects, contacts, subscribers });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (!name || !name.trim()) return res.status(400).json({ error: '请填写姓名/团队名' });
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: '该邮箱已注册' });
  const h = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(String(email).toLowerCase(), name.trim(), h, 'member');
  const user = { id: info.lastInsertRowid, email: String(email).toLowerCase(), name: name.trim(), role: 'member' };
  const token = newSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, sessionExpiry());
  res.cookie('rf_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !password) return res.status(400).json({ error: '请输入邮箱与密码' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  const token = newSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, row.id, sessionExpiry());
  res.cookie('rf_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ user: publicUser(row) });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.rf_session) db.prepare('DELETE FROM sessions WHERE token = ?').run(cookies.rf_session);
  res.clearCookie('rf_session');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = loadUserFromSession(req);
  if (!user) return res.status(401).json({ error: '未登录' });
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// Projects (protected)
// ---------------------------------------------------------------------------
const PROJECT_TYPES = ['short_video', 'ad', 'course', 'news', 'other'];
const PROJECT_STATUS = ['draft', 'queued', 'rendering', 'done', 'failed'];

app.get('/api/projects', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.id);
  res.json({ projects: rows.map(withMeta) });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { title, type, status, prompt, description, meta } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: '请填写项目标题' });
  const t = PROJECT_TYPES.includes(type) ? type : 'short_video';
  const st = PROJECT_STATUS.includes(status) ? status : 'draft';
  const metaStr = meta ? JSON.stringify(meta) : null;
  const info = db
    .prepare(
      `INSERT INTO projects (user_id, title, type, status, prompt, description, meta, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(req.user.id, title.trim(), t, st, prompt || null, description || null, metaStr);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ project: withMeta(row) });
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '项目不存在' });
  res.json({ project: withMeta(row) });
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '项目不存在' });
  const { title, type, status, prompt, description, meta } = req.body || {};
  const t = PROJECT_TYPES.includes(type) ? type : row.type;
  const st = PROJECT_STATUS.includes(status) ? status : row.status;
  db.prepare(
    `UPDATE projects SET title=?, type=?, status=?, prompt=?, description=?, meta=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(
    (title || row.title).toString().trim(),
    t,
    st,
    prompt !== undefined ? prompt : row.prompt,
    description !== undefined ? description : row.description,
    meta !== undefined ? JSON.stringify(meta) : row.meta,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: withMeta(updated) });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: '项目不存在' });
  res.json({ ok: true });
});

function withMeta(row) {
  if (!row) return row;
  let meta = null;
  try { meta = row.meta ? JSON.parse(row.meta) : null; } catch { meta = null; }
  const { meta: _m, ...rest } = row;
  return { ...rest, meta };
}

// ---------------------------------------------------------------------------
// Contact + Subscribe
// ---------------------------------------------------------------------------
app.post('/api/contact', (req, res) => {
  const { name, email, company, message } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '请填写称呼' });
  if (!isEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (!message || !message.trim()) return res.status(400).json({ error: '请填写留言内容' });
  db.prepare('INSERT INTO contacts (name, email, company, message) VALUES (?, ?, ?, ?)')
    .run(name.trim(), String(email).toLowerCase(), company || null, message.trim());
  res.status(201).json({ ok: true, message: '已收到，我们会尽快联系你' });
});

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  const e = String(email).toLowerCase();
  const exists = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(e);
  if (exists) return res.status(200).json({ ok: true, message: '你已经订阅过啦' });
  db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(e);
  res.status(201).json({ ok: true, message: '订阅成功，欢迎加入 ReelForge 社区' });
});

// ---------------------------------------------------------------------------
// Membership (演示开通：选套餐即生效，无需真实支付)
// ---------------------------------------------------------------------------
const PLAN_DAYS = { experience: 30, pro: 30, enterprise: 365 };
app.post('/api/membership', requireAuth, (req, res) => {
  const { plan } = req.body || {};
  if (!PLAN_DAYS[plan]) return res.status(400).json({ error: '无效的套餐' });
  const startedStr = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const expStr = new Date(Date.now() + PLAN_DAYS[plan] * 24 * 3600 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  db.prepare(
    "UPDATE users SET plan=?, membership_status='active', membership_started_at=?, membership_expires_at=? WHERE id=?"
  ).run(plan, startedStr, expStr, req.user.id);
  const row = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ ok: true, membership: publicUser(row).membership, message: '会员开通成功' });
});

// ---------------------------------------------------------------------------
// User-owned API keys (自带大模型 API，加密存储，按用户隔离)
// ---------------------------------------------------------------------------
app.get('/api/apikeys', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, provider, name, base_url, model, is_default, created_at FROM user_api_keys WHERE user_id=? ORDER BY is_default DESC, id DESC')
    .all(req.user.id);
  res.json({ keys: rows });
});

app.post('/api/apikeys', requireAuth, (req, res) => {
  const { provider, name, api_key, base_url, model, is_default } = req.body || {};
  if (!provider || !provider.trim()) return res.status(400).json({ error: '请选择供应商' });
  if (!api_key || !api_key.trim()) return res.status(400).json({ error: '请填写 API Key' });
  const def = is_default ? 1 : 0;
  const info = db
    .prepare(
      `INSERT INTO user_api_keys (user_id, provider, name, api_key, base_url, model, is_default, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(req.user.id, provider.trim(), (name || provider).trim(), encrypt(api_key.trim()), base_url || null, model || null, def);
  if (def) db.prepare('UPDATE user_api_keys SET is_default=0 WHERE user_id=? AND id!=?').run(req.user.id, info.lastInsertRowid);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/apikeys/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM user_api_keys WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '密钥不存在' });
  const { provider, name, api_key, base_url, model, is_default } = req.body || {};
  const def = is_default ? 1 : 0;
  const enc = api_key && api_key.trim() ? encrypt(api_key.trim()) : row.api_key;
  db.prepare(
    `UPDATE user_api_keys SET provider=?, name=?, api_key=?, base_url=?, model=?, is_default=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    provider ? provider.trim() : row.provider,
    name ? name.trim() : row.name,
    enc,
    base_url !== undefined ? (base_url || null) : row.base_url,
    model !== undefined ? (model || null) : row.model,
    def,
    req.params.id
  );
  if (def) db.prepare('UPDATE user_api_keys SET is_default=0 WHERE user_id=? AND id!=?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/apikeys/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM user_api_keys WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '密钥不存在' });
  db.prepare('DELETE FROM user_api_keys WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  if (row.is_default) {
    const next = db.prepare('SELECT id FROM user_api_keys WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
    if (next) db.prepare('UPDATE user_api_keys SET is_default=1 WHERE id=?').run(next.id);
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: list all projects (admin only)
// ---------------------------------------------------------------------------
app.get('/api/admin/projects', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const rows = db.prepare('SELECT p.*, u.email AS owner FROM projects p JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC').all();
  res.json({ projects: rows.map(withMeta) });
});

// ---------------------------------------------------------------------------
// File uploads (template materials)
// ---------------------------------------------------------------------------
const uploadDir = path.join(__dirname, 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E6) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 32 * 1024 * 1024 } });

app.post('/api/projects/:id/materials', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const url = '/uploads/' + req.file.filename;
  res.json({ ok: true, url, name: req.file.originalname });
});

app.put('/api/projects/:id/slots', requireAuth, (req, res) => {
  const proj = db.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!proj) return res.status(404).json({ error: '项目不存在' });
  const meta = typeof proj.meta === 'string' ? JSON.parse(proj.meta) : (proj.meta || {});
  meta.material_slots = Object.assign(meta.material_slots || {}, req.body.slots || {});
  db.prepare('UPDATE projects SET meta=?, updated_at=datetime(\'now\') WHERE id=?').run(JSON.stringify(meta), req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 视频生成（适配层：当前通义万相 / DashScope；未配置 key 时前端自动回退演示）
// ---------------------------------------------------------------------------
const genTasks = new Map();
let genTaskSeq = 1;

// 从用户已接入的 Key 中选出用于视频生成的那个（优先默认的视频供应商）
function pickVideoKey(rows) {
  if (!rows || !rows.length) return null;
  const video = rows.filter(function (r) { return gen.VIDEO_PROVIDERS.indexOf(r.provider) >= 0; });
  if (!video.length) return null;
  const def = video.find(function (r) { return r.is_default; }) || video[0];
  return { apiKey: def.api_key, baseUrl: def.base_url, model: def.model, provider: def.provider };
}

app.get('/api/gen-config', requireAuth, async (req, res) => {
  const rows = db.prepare('SELECT provider, api_key, is_default FROM user_api_keys WHERE user_id=?').all(req.user.id);
  const userKey = pickVideoKey(rows);
  res.json({
    configured: !!(userKey || process.env.REELFORGE_VIDEO_API_KEY),
    provider: userKey ? userKey.provider : (process.env.REELFORGE_VIDEO_API_KEY ? gen.provider : null),
    userConfigurable: true,
  });
});

app.post('/api/projects/:id/generate', requireAuth, async (req, res) => {
  const rows = db.prepare('SELECT provider, api_key, base_url, model, is_default FROM user_api_keys WHERE user_id=?').all(req.user.id);
  const userKey = pickVideoKey(rows);
  const envKey = process.env.REELFORGE_VIDEO_API_KEY;
  if (!userKey && !envKey) {
    return res.status(501).json({ error: '生成服务未配置 API Key：请在「API 接入」接入通义万相（视频）并设为默认，或在服务器配置 REELFORGE_VIDEO_API_KEY', configured: false });
  }
  const prompt = (req.body && (req.body.prompt || req.body.script)) || '';
  if (!prompt) return res.status(400).json({ error: '缺少生成提示词（prompt/script）' });
  const opts = userKey ? { apiKey: userKey.apiKey, baseUrl: userKey.baseUrl, model: userKey.model } : {};
  try {
    const { taskId } = await gen.submitTextToVideo(prompt, opts);
    const localId = 'G' + (genTaskSeq++);
    genTasks.set(localId, { providerTaskId: taskId, status: 'queued', videoUrl: null, projectId: req.params.id, createdAt: Date.now(), opts: opts });
    res.json({ ok: true, taskId: localId, configured: true });
  } catch (e) {
    res.status(500).json({ error: e.message, configured: true });
  }
});

app.get('/api/tasks/:taskId', requireAuth, async (req, res) => {
  const t = genTasks.get(req.params.taskId);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  if (t.status === 'queued' || t.status === 'rendering') {
    try {
      const r = await gen.queryTask(t.providerTaskId, t.opts || {});
      t.status = r.status;
      if (r.videoUrl) t.videoUrl = r.videoUrl;
    } catch (e) { /* 瞬时错误忽略，下次轮询 */ }
  }
  res.json({ taskId: req.params.taskId, status: t.status, videoUrl: t.videoUrl || null });
});

// ---------------------------------------------------------------------------
// ReelForge 智能装配 Agent（增量挂载，不替换现有路由）
// ---------------------------------------------------------------------------
const { createAgentRouter } = require('./routes/agent');
app.use('/api', createAgentRouter({ db, requireAuth }));

// 404 fallback for unknown API
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 404 page for unknown non-API GET routes
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.status(404).json({ error: '未找到' });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
seedIfEmpty();
app.listen(PORT, () => {
  console.log(`ReelForge running at http://localhost:${PORT}`);
});
