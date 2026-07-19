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
// Master key from env REELFORGE_MASTER_KEY, fallback to a dev key (demo only).
// ---------------------------------------------------------------------------
const MASTER_KEY = Buffer.from(
  (process.env.REELFORGE_MASTER_KEY || 'reelforge-dev-master-key-change-me!!')
    .slice(0, 32)
    .padEnd(32, '0'),
  'utf8'
);

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
