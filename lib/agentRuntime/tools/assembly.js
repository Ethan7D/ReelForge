'use strict';

const crypto = require('crypto');
const gateway = require('../../modelGateway');
const { buildAssemblyPrompt } = require('../prompts/buildAssemblyPrompt');
const { getTemplatePack } = require('./templatePack');
const { queryMaterialLibrary } = require('./materialLibrary');

const AssemblyResultSchema = {
  type: 'object',
  properties: {
    scriptId: { type: 'string' },
    scriptTitle: { type: 'string' },
    bindings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slot: { type: 'string' },
          target: { type: 'string' },
          materialId: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['slot', 'target', 'materialId', 'reason'],
      },
    },
    unmatched: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slot: { type: 'string' },
          target: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['slot', 'suggestion'],
      },
    },
    script: { type: 'object' },
    rationale: { type: 'string' },
  },
  required: ['scriptId', 'bindings', 'unmatched', 'script', 'rationale'],
};

/**
 * 提议装配方案。
 * 支持两种模式：
 *   1) library_id — 从预置素材库文件读取（旧版兼容）
 *   2) materials  — 接收前端上传的素材数组（新版：用户上传 → 自动匹配）
 */
async function proposeAssembly({ library_id, pack_id, providerOptions = {}, materials }) {
  const pack = getTemplatePack(pack_id);

  // 构建统一的 library 对象 { id, name, items[] }
  let library;
  if (materials && Array.isArray(materials) && materials.length > 0) {
    // 新模式：用户直接上传的素材
    library = {
      id: 'user_upload_session',
      name: '用户上传素材',
      items: materials,
    };
  } else {
    // 旧模式：从素材库文件读取
    library = queryMaterialLibrary(library_id);
  }

  const prompt = buildAssemblyPrompt(pack, library);

  if (providerOptions.provider || process.env.OPENAI_API_KEY || process.env.OLLAMA_FORCE === '1') {
    try {
      const result = await gateway.structured([{ role: 'user', content: prompt }], AssemblyResultSchema, providerOptions);
      return sanitizeAssemblyResult(result, pack, library);
    } catch (err) {
      return { ...fallbackAssembly(pack, library), modelWarning: err.message };
    }
  }

  return fallbackAssembly(pack, library);
}

function applyAssembly({ proposal, library_id, pack_id }, ctx = {}) {
  const db = ctx.db;
  const id = crypto.randomUUID();
  const payload = {
    id,
    libraryId: library_id || proposal.libraryId || null,
    packId: pack_id || proposal.packId || null,
    ...proposal,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    db.prepare(
      `INSERT INTO assembly_results (id, user_id, library_id, pack_id, script_id, result_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id,
      ctx.user?.id || null,
      payload.libraryId || 'user_upload',   // 用户上传模式标记
      payload.packId,
      payload.scriptId || null,
      JSON.stringify(payload)
    );
  }

  return { ok: true, id, result: payload };
}

function fallbackAssembly(pack, library) {
  const script = (pack.scriptTemplates || [])[0] || { id: 'default', title: 'Untitled', slots: [] };
  const used = new Set();
  const bindings = [];
  const unmatched = [];

  for (const slot of script.slots || []) {
    const target = slot.bind || slot.type || slot.slot;
    const need = slot.needMaterial || targetHint(target, pack) || slot.hint || '';
    const match = bestMaterial(need, library.items || [], used);
    if (match && match.score > 0) {
      used.add(match.item.id);
      bindings.push({
        slot: slot.slot,
        target,
        materialId: match.item.id,
        confidence: Number(Math.min(0.98, 0.55 + match.score / 12).toFixed(2)),
        reason: `素材 ${match.item.id} 的类型/标签/描述与 "${need || target}" 匹配。`,
      });
    } else if (slot.needMaterial || String(target).startsWith('scene:') || String(target).startsWith('character:')) {
      unmatched.push({
        slot: slot.slot,
        target,
        suggestion: `请补充适合 "${need || target}" 的素材。`,
      });
    }
  }

  return {
    scriptId: script.id,
    scriptTitle: script.title || script.id,
    bindings,
    unmatched,
    script: buildScriptJson(script, bindings, unmatched, library),
    rationale: '当前未配置外部模型，已使用 ReelForge 内置标签/类型匹配策略生成装配提案。',
  };
}

function bestMaterial(need, items, used) {
  const needTokens = tokenize(need);
  let best = null;
  for (const item of items) {
    if (used.has(item.id)) continue;
    const haystack = [item.type, item.text, ...(item.tags || [])].join(' ');
    const itemTokens = tokenize(haystack);
    let score = 0;
    for (const token of needTokens) {
      if (itemTokens.includes(token)) score += token.length > 1 ? 3 : 1;
    }
    if (need && item.type && String(need).includes(item.type)) score += 5;
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}

function targetHint(target, pack) {
  const [kind, id] = String(target || '').split(':');
  const list = kind === 'character' ? pack.characters : kind === 'scene' ? pack.scenes : [];
  const found = (list || []).find((entry) => entry.id === id);
  if (!found) return '';
  return [found.name, found.role, found.assetSpec].filter(Boolean).join(' ');
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[\s,，.。:：;；/|、\-_]+/)
    .filter(Boolean);
}

function buildScriptJson(script, bindings, unmatched, library) {
  const bySlot = new Map(bindings.map((b) => [b.slot, b]));
  return {
    id: script.id,
    title: script.title || script.id,
    shots: (script.slots || []).map((slot, index) => {
      const binding = bySlot.get(slot.slot);
      const material = binding ? (library.items || []).find((item) => item.id === binding.materialId) : null;
      return {
        order: index + 1,
        slot: slot.slot,
        target: slot.bind || slot.type || slot.slot,
        materialId: material?.id || null,
        materialType: material?.type || null,
        voiceover: slot.type === 'text' ? deriveVoiceover(slot, library) : null,
        status: binding ? 'bound' : unmatched.some((item) => item.slot === slot.slot) ? 'unmatched' : 'template',
      };
    }),
  };
}

function deriveVoiceover(slot, library) {
  const textItem = (library.items || []).find((item) => item.type === '文案' || (item.tags || []).includes('文案'));
  return textItem?.text || slot.hint || '';
}

function sanitizeAssemblyResult(result, pack, library) {
  const ids = new Set((library.items || []).map((item) => item.id));
  const bindings = (result.bindings || []).filter((item) => ids.has(item.materialId));
  return {
    ...result,
    bindings,
    unmatched: Array.isArray(result.unmatched) ? result.unmatched : [],
    script: result.script || buildScriptJson((pack.scriptTemplates || [])[0] || {}, bindings, [], library),
    rationale: result.rationale || '由模型网关生成装配提案。',
  };
}

function registerAssemblyTools(registry) {
  registry.registerTool({
    name: 'propose_assembly',
    description: 'Generate an AssemblyResult by matching a material library to a template pack.',
    input_schema: {
      type: 'object',
      properties: {
        library_id: { type: 'string' },
        pack_id: { type: 'string' },
      },
      required: ['library_id', 'pack_id'],
    },
    handler: async ({ library_id, pack_id }, ctx) => proposeAssembly({ library_id, pack_id, providerOptions: ctx.providerOptions || {} }),
  });

  registry.registerTool({
    name: 'apply_assembly',
    description: 'Persist an accepted AssemblyResult.',
    input_schema: {
      type: 'object',
      properties: {
        library_id: { type: 'string' },
        pack_id: { type: 'string' },
        proposal: { type: 'object' },
      },
      required: ['proposal'],
    },
    handler: async (args, ctx) => applyAssembly(args, ctx),
  });
}

module.exports = {
  AssemblyResultSchema,
  proposeAssembly,
  applyAssembly,
  registerAssemblyTools,
};
