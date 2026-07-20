'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { listTemplatePacks, getTemplatePack } = require('../lib/agentRuntime/tools/templatePack');
const { proposeAssembly, applyAssembly } = require('../lib/agentRuntime/tools/assembly');

/* ── 素材上传（复用项目已有的 multer 配置） ── */
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const name = 'agent_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 32 * 1024 * 1024 } });

function createAgentRouter({ db, requireAuth }) {
  const router = express.Router();

  /* ── 模板包 ── */
  router.get('/template-packs', requireAuth, (_req, res) => {
    res.json({ packs: listTemplatePacks() });
  });

  router.get('/template-packs/:id', requireAuth, (req, res) => {
    try { res.json({ pack: getTemplatePack(req.params.id) }); }
    catch (_err) { res.status(404).json({ error: '模板包不存在' }); }
  });

  /* ── 用户素材上传（新） ── */
  router.post('/agent/materials', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '未收到文件' });

    // 从 body 取 type 和 tags
    let matType = (req.body.type || '图片').trim();
    let tags = [];
    try { tags = JSON.parse(req.body.tags || '[]'); }
    catch (_) { tags = []; }

    const materialId = 'mat_' + crypto.randomUUID().slice(0, 8);
    const imagePath = '/uploads/' + req.file.filename;

    res.json({
      ok: true,
      material_id: materialId,
      image_path: imagePath,
      original_name: req.file.originalname,
      size: req.file.size,
      type: matType,
      tags,
    });
  });

  /* ── 智能装配（改造：接受用户上传素材，不再依赖素材库 ID） ── */
  router.post('/agent/assemble', requireAuth, async (req, res) => {
    const { packId, materials, apply = true } = req.body || {};
    if (!packId) return res.status(400).json({ error: 'packId 必填' });
    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: '请至少上传一个素材' });
    }

    try {
      // 把前端传来的素材数组组装成 "虚拟素材库" 的格式，复用现有匹配引擎
      const virtualLibrary = {
        id: 'user_upload_' + Date.now(),
        name: '当前会话上传素材',
        items: materials.map(m => ({
          id: m.id,
          type: m.type || '图片',
          text: m.text || '',
          image_path: m.image_path || null,
          tags: m.tags || [],
        })),
      };

      const proposal = await proposeAssembly({
        library_id: null,       // 不再读文件
        pack_id: packId,
        materials: virtualLibrary.items,  // 直接传入素材数组
      });
      const saved = apply
        ? applyAssembly({ proposal, packId }, { db, user: req.user })
        : { ok: false, id: null, result: proposal };
      res.json({ proposal, saved });
    } catch (err) {
      console.error('[agent] assemble error:', err);
      res.status(500).json({ error: err.message || '智能装配失败' });
    }
  });

  /* ── 历史装配结果 ── */
  router.get('/agent/assemblies', requireAuth, (req, res) => {
    const rows = db.prepare(
      `SELECT id, library_id, pack_id, script_id, result_json, created_at
       FROM assembly_results
       WHERE user_id IS NULL OR user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    ).all(req.user.id);
    res.json({
      assemblies: rows.map((row) => ({
        id: row.id,
        libraryId: row.library_id,
        packId: row.pack_id,
        scriptId: row.script_id,
        createdAt: row.created_at,
        result: JSON.parse(row.result_json),
      })),
    });
  });

  /* ── 兼容旧接口（可选保留，标记 deprecated） ── */
  router.get('/material-libraries', requireAuth, (_req, res) => {
    // 返回空列表——新版不需要预置素材库
    res.json({ libraries: [] });
  });

  router.get('/material-libraries/:id', requireAuth, (req, res) => {
    res.status(410).json({ error: '已废弃：请使用上传素材功能替代' });
  });

  return router;
}

module.exports = { createAgentRouter };
