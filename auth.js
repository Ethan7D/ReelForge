'use strict';
// ReelForge — auth helpers (password hashing + session tokens)
const crypto = require('crypto');

const SESSION_TTL_DAYS = 7;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionExpiry() {
  const d = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  // SQLite datetime format
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

// ---------------------------------------------------------------------------
// API Key encryption (AES-256-GCM)
// Master key MUST come from env REELFORGE_MASTER_KEY.
//  - 生产环境(NODE_ENV=production)未设置则拒绝启动（避免 API Key 被公开兜底密钥加密）
//  - 开发/演示环境未设置则使用本次进程内随机密钥（仅本地可用，重启后已存 Key 不可解密）
// ---------------------------------------------------------------------------
function resolveMasterKey() {
  const fromEnv = process.env.REELFORGE_MASTER_KEY;
  if (fromEnv && fromEnv.trim()) {
    return Buffer.from(fromEnv.slice(0, 32).padEnd(32, '0'), 'utf8');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[ReelForge] 安全启动被拒绝：生产环境必须设置 REELFORGE_MASTER_KEY 用于加密存储的 API Key。' +
      '请复制 .env.example 为 .env 并填入强随机密钥（如 `openssl rand -hex 32`）。'
    );
  }
  const devKey = crypto.randomBytes(32);
  console.warn(
    '[ReelForge] 警告：未设置 REELFORGE_MASTER_KEY，已使用进程内随机密钥加密 API Key。' +
    '该密钥仅本次运行有效，重启后已存 Key 将无法解密；请勿在生产环境使用此模式。'
  );
  return devKey;
}
const MASTER_KEY = resolveMasterKey();

function encrypt(text) {
  if (text == null || text === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(stored) {
  if (!stored) return '';
  const [ivHex, tagHex, encHex] = stored.split(':');
  if (!ivHex || !tagHex || !encHex) return stored; // 兼容明文（历史数据）
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch (_) {
    return '';
  }
}

module.exports = { hashPassword, verifyPassword, newSessionToken, sessionExpiry, encrypt, decrypt, SESSION_TTL_DAYS };
