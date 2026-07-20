/* ===========================================================================
   ReelForge -- API 接入中心（用户自带大模型 API，加密存储）
   两步骤弹窗：先选供应商（已接入/未接入分组列表）→ 再填写配置
   =========================================================================== */
(function () {
  var RF = window.ReelForge;
  var $ = function(id) { return document.getElementById(id); };

  // 单一真源：来自 providers.js（与工作台模型下拉共用），保证两处永远一致
  var PROVIDERS = window.ReelForgeProviders || [
    { id: 'openai', label: 'OpenAI', icon: '🤖', base: 'https://api.openai.com/v1', models: 'GPT‑4o, GPT‑4.1' },
    { id: 'anthropic', label: 'Anthropic Claude', icon: '🧠', base: 'https://api.anthropic.com', models: 'Claude 4 Sonnet' },
    { id: 'google', label: 'Google Gemini', icon: '🌐', base: 'https://generativelanguage.googleapis.com/v1beta', models: 'Gemini 2.5 Pro' },
    { id: 'deepseek', label: 'DeepSeek', icon: '🔍', base: 'https://api.deepseek.com/v1', models: 'DeepSeek‑V3, DeepSeek‑R1' },
    { id: 'qwen', label: '阿里云 · 通义', icon: '☁️', base: 'https://dashscope.aliyuncs.com', models: 'Qwen‑Max, Qwen‑Plus, wanx2.1‑t2v‑turbo, wanx2.1‑i2v‑turbo' },
    { id: 'zhipu', label: '智谱 GLM', icon: '🔬', base: 'https://open.bigmodel.cn/api/paas/v4', models: 'GLM‑5, GLM‑4 Plus' },
    { id: 'moonshot', label: 'Kimi / 月之暗面', icon: '🌙', base: 'https://api.moonshot.cn/v1', models: 'Kimi K2.5' },
    { id: 'doubao', label: '豆包 / 字节火山引擎', icon: '🫘', base: 'https://ark.cn-beijing.volces.com/api/v3', models: 'Doubao‑pro‑32k' },
    { id: 'baidu', label: '百度千帆 (文心)', icon: '🐻', base: 'https://qianfan.baidubce.com/v2', models: 'ERNIE 4.0' },
    { id: 'minimax', label: 'MiniMax / 海螺 AI', icon: '🐚', base: 'https://api.minimax.chat/v1', models: 'MiniMax‑Text‑01' },
    { id: 'tencent', label: '腾讯混元', icon: '🐧', base: 'https://api.hunyuan.cloud.tencent.com/v1', models: 'hunyuan‑pro' },
    { id: 'spark', label: '讯飞星火', icon: '✨', base: 'https://spark-api.xfyun.cn/v1', models: 'Spark Pro' },
    { id: 'kling', label: '可灵 AI（视频）', icon: '🎬', base: 'https://api.klingai.com', models: 'kling‑v3' },
    { id: 'jimeng', label: '即梦 AI（视频）', icon: '🎥', base: 'https://api.jimeng.jianying.com', models: '即梦 v1' },
    { id: 'runway', label: 'Runway Gen‑4/Gen‑3', icon: '🏃', base: 'https://api.runwayml.com/v1', models: 'gen‑4' },
    { id: 'vidu', label: 'Vidu AI（视频）', icon: '🎞️', base: 'https://api.vidu.ai', models: 'vidu‑1' },
    { id: 'siliconflow', label: '硅基流动 SiliconFlow', icon: '💎', base: 'https://api.siliconflow.cn/v1', models: '聚合多模型' },
    { id: 'openrouter', label: 'OpenRouter（聚合）', icon: '🔗', base: 'https://openrouter.ai/api/v1', models: '聚合数百模型' },
    { id: 'custom', label: '自定义 / 其他', icon: '⚙️', base: '', models: '请自行填写模型名' },
  ];
  var PROV_MAP = {};
  PROVIDERS.forEach(function(p) { PROV_MAP[p.id] = p; });
  var PLAN_CN = { experience: '体验版', pro: '专业版', enterprise: '旗舰版' };

  var KEYS_CACHE = [];

  function esc(s) { return RF.escapeHtml(s); }

  async function ensureAuth() {
    var user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return false; }
    return true;
  }

  function renderKeys(keys) {
    KEYS_CACHE = keys;
    var grid = $('keyGrid');
    if (!keys.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        '<h3 style="margin:0 0 8px">还没有接入任何 API</h3>' +
        '<p>接入你自己的大模型 API 后，即可用 ReelForge 制作视频。模型 token 费由你的 API 自行承担。</p>' +
        '<button class="btn btn-primary" onclick="window.ApiKeys.openModal()">+ 接入新 API</button>' +
      '</div>';
      return;
    }
    grid.innerHTML = keys.map(function(k) {
      return '<div class="project-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<span class="type-tag">' + esc(PROV_MAP[k.provider] ? PROV_MAP[k.provider].label : k.provider) + '</span>' +
          (k.is_default ? '<span class="status done">默认</span>' : '') +
        '</div>' +
        '<h4 style="margin-top:10px">' + esc(k.name) + '</h4>' +
        '<div class="meta">' + (k.model ? '模型：' + esc(k.model) : '<span class="muted">未指定模型</span>') + '</div>' +
        '<div class="meta" style="margin-top:6px">' + (k.base_url ? esc(k.base_url) : '<span class="muted">使用供应商默认地址</span>') + '</div>' +
        '<div class="project-actions">' +
          '<button class="icon-btn" data-edit="' + k.id + '">编辑</button>' +
          '<button class="icon-btn danger" data-del="' + k.id + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
    grid.querySelectorAll('[data-edit]').forEach(function(b) { b.addEventListener('click', function() { openModal(+b.dataset.edit); }); });
    grid.querySelectorAll('[data-del]').forEach(function(b) { b.addEventListener('click', function() { delKey(+b.dataset.del); }); });
  }

  function renderMember() {
    var m = RF.getMembership && RF.getMembership();
    var txt = $('memberText');
    if (m && m.isActive) {
      txt.innerHTML = '当前会员：<b>' + (PLAN_CN[m.plan] || m.plan) + '</b> · 有效期至 ' + (m.expires_at || '');
    } else {
      txt.textContent = '你已接入 API，但需开通会员才能制作视频。';
    }
  }

  async function loadKeys() {
    var res = await RF.api('GET', '/apikeys');
    if (!res.ok) { if (res.data && res.data.error) RF.toast(res.data.error, 'err'); return; }
    renderKeys(res.data.keys || []);
    if ($('modal').classList.contains('open')) renderProviderList();
  }

  // ======================== 新弹窗：供应商列表 → 表单 ========================

  function buildProvRow(p, extraClass, rightHtml) {
    return '<div class="prov-row ' + extraClass + '" data-provider="' + p.id + '">' +
      '<div class="prov-info">' +
        '<span class="prov-icon">' + p.icon + '</span>' +
        '<div class="prov-text">' +
          '<span class="prov-label">' + esc(p.label) + '</span>' +
          '<span class="prov-meta">' + esc(p.models) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="prov-actions">' + rightHtml + '</div>' +
    '</div>';
  }

  function renderProviderList() {
    var connectedIds = {};
    KEYS_CACHE.forEach(function(k) {
      if (!connectedIds[k.provider]) connectedIds[k.provider] = [];
      connectedIds[k.provider].push(k);
    });

    var connected = PROVIDERS.filter(function(p) { return connectedIds[p.id]; });
    var unconnected = PROVIDERS.filter(function(p) { return !connectedIds[p.id]; });

    // 已接入
    var gConnected = $('provGroupConnected');
    if (connected.length > 0) {
      gConnected.style.display = '';
      $('provCountConnected').textContent = Object.keys(connectedIds).length + ' 个';
      $('provListConnected').innerHTML = connected.map(function(p) {
        var keys = connectedIds[p.id];
        var names = keys.map(function(k) { return esc(k.name); }).join(', ');
        var right = '<span class="prov-status done">已接入</span>' +
          '<button type="button" class="btn btn-ghost btn-sm prov-edit-btn" data-provider="' + p.id + '">管理</button>';
        return buildProvRow(p, 'connected', right).replace('<span class="prov-meta">' + esc(p.models) + '</span>', '<span class="prov-meta">' + names + '</span>');
      }).join('');
    } else {
      gConnected.style.display = 'none';
    }

    // 未接入
    $('provCountUnconnected').textContent = unconnected.length + ' 个';
    $('provListUnconnected').innerHTML = unconnected.map(function(p) {
      return buildProvRow(p, 'unconnected', '<button type="button" class="btn btn-primary btn-sm prov-connect-btn" data-provider="' + p.id + '">接入</button>');
    }).join('');

    // 绑定事件
    function bind(listEl) {
      if (!listEl) return;
      listEl.querySelectorAll('.prov-connect-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); selectProvider(btn.dataset.provider); });
      });
      listEl.querySelectorAll('.prov-edit-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var pid = btn.dataset.provider;
          var keys = connectedIds[pid];
          if (keys && keys.length > 0) editKey(keys[0].id);
        });
      });
      listEl.querySelectorAll('.prov-row.unconnected').forEach(function(row) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function() { selectProvider(row.dataset.provider); });
      });
    }
    bind($('provListConnected'));
    bind($('provListUnconnected'));

    $('apikeyStepList').style.display = '';
    $('apikeyStepForm').style.display = 'none';
    $('modalTitle').textContent = '接入大模型 API';
  }

  function selectProvider(providerId, keyData) {
    var p = PROV_MAP[providerId];
    if (!p) return;

    $('apikeyStepList').style.display = 'none';
    $('apikeyStepForm').style.display = '';
    $('formTitle').textContent = keyData ? '编辑 ' + p.label + ' API' : '接入 ' + p.label + ' API';

    $('pscIcon').textContent = p.icon;
    $('pscName').textContent = p.label;
    $('pscModels').textContent = p.models;

    $('kErr').textContent = '';
    $('saveBtn').textContent = keyData ? '保存修改' : '接入';
    $('kName').value = keyData ? keyData.name : '';
    $('kKey').value = '';
    $('kKey').type = 'password';
    $('kToggle').textContent = '显示';
    $('kBase').value = keyData ? (keyData.base_url || '') : (p.base || '');
    $('kModel').value = keyData ? (keyData.model || '') : '';
    $('kDefault').checked = keyData ? !!keyData.is_default : false;
    $('keyId').value = keyData ? keyData.id : '';

    $('keyForm').setAttribute('data-provider', providerId);

    if (!keyData && p.base) {
      $('kBase').placeholder = p.base;
    }
  }

  function editKey(keyId) {
    var k = KEYS_CACHE.find(function(x) { return x.id === keyId; });
    if (!k) return;
    var modal = $('modal');
    if (!modal.classList.contains('open')) {
      modal.classList.add('open');
      renderProviderList();
    }
    selectProvider(k.provider, k);
  }

  function showListView() {
    $('apikeyStepList').style.display = '';
    $('apikeyStepForm').style.display = 'none';
    $('modalTitle').textContent = '接入大模型 API';
    renderProviderList();
  }

  function openModal(id) {
    var modal = $('modal');
    modal.classList.add('open');
    renderProviderList();
    if (id) editKey(id);
  }

  function closeModal() {
    $('modal').classList.remove('open');
  }

  // ======================== 保存 Key ========================

  var saving = false;
  async function saveKey(e) {
    e.preventDefault();
    if (saving) return;
    var id = $('keyId').value;
    var provider = $('keyForm').getAttribute('data-provider') || 'openai';
    var name = $('kName').value.trim() || (PROV_MAP[provider].label + ' ' + new Date().toLocaleDateString());
    var body = {
      provider: provider,
      name: name,
      api_key: $('kKey').value,
      base_url: $('kBase').value.trim(),
      model: $('kModel').value.trim(),
      is_default: $('kDefault').checked,
    };
    var btn = $('saveBtn');
    saving = true;
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '保存中…';
    $('kErr').textContent = '';
    try {
      var res = id
        ? await RF.api('PUT', '/apikeys/' + id, { body: body })
        : await RF.api('POST', '/apikeys', { body: body });
      if (res.ok) { closeModal(); RF.toast(id ? '已保存' : 'API 已接入', 'ok'); loadKeys(); }
      else { $('kErr').textContent = (res.data && res.data.error) || '保存失败'; btn.disabled = false; btn.textContent = old; }
    } catch (err) {
      $('kErr').textContent = '网络异常，请重试';
      RF.toast('保存失败，请重试', 'err');
      btn.disabled = false; btn.textContent = old;
    } finally {
      saving = false;
    }
  }

  async function delKey(id) {
    if (!confirm('确定删除该 API 接入？')) return;
    var res = await RF.api('DELETE', '/apikeys/' + id);
    if (res.ok) { RF.toast('已删除', 'ok'); loadKeys(); }
    else RF.toast((res.data && res.data.error) || '删除失败', 'err');
  }

  // ---------- Wire up ----------
  window.ApiKeys = { openModal: openModal };
  $('newBtn').addEventListener('click', function() { openModal(); });
  $('cancelBtn').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function(e) { if (e.target === $('modal')) closeModal(); });
  $('keyForm').addEventListener('submit', saveKey);
  $('backToListBtn').addEventListener('click', showListView);
  $('kToggle').addEventListener('click', function() {
    var inp = $('kKey');
    var t = $('kToggle');
    if (inp.type === 'password') { inp.type = 'text'; t.textContent = '隐藏'; }
    else { inp.type = 'password'; t.textContent = '显示'; }
  });

  (async function init() {
    if (!(await ensureAuth())) return;
    renderMember();
    loadKeys();
  })();
})();
