(function () {
  var RF = window.ReelForge;
  function $(id) { return document.getElementById(id); }

  /* ── 状态 ── */
  var materials = [];       // { id, file, name, type, text, image_path, tags, uploaded }
  var packId = '';

  /* ── 认证 ── */
  async function ensureAuth() {
    var user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return false; }
    return true;
  }

  /* ── 加载模板包列表 ── */
  async function loadPacks() {
    try {
      var res = await RF.api('GET', '/template-packs');
      if (!res.ok) throw new Error('加载模板包失败');
      $('packSelect').innerHTML = (res.data.packs || []).map(function (p) {
        return '<option value="' + RF.escapeHtml(p.id) + '">' + RF.escapeHtml(p.name) + '</option>';
      }).join('');
      checkReady();
    } catch (err) {
      RF.toast(err.message, 'err');
    }
  }

  /* ═══════════════════ 素材上传 ═══════════════════ */

  var uploadZone = $('uploadZone');
  var fileInput = $('fileInput');

  uploadZone.addEventListener('click', function () { fileInput.click(); });
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', function () {
    handleFiles(fileInput.files);
    fileInput.value = ''; // 允许重复选同一文件
  });

  function handleFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      if (file.size > 32 * 1024 * 1024) {
        RF.toast(file.name + ' 超过 32MB 限制', 'err');
        return;
      }

      // 判断类型：图片 vs 文本描述（通过扩展名或 MIME）
      var isImage = file.type.startsWith('image/');
      var matId = 'mat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      var entry = {
        id: matId,
        file: file,
        name: file.name,
        type: isImage ? '图片' : '文本',
        text: '',
        image_path: null,
        tags: [],
        uploaded: false,
        localUrl: isImage ? URL.createObjectURL(file) : null
      };

      // 图片自动打标签提示，文本需要手动输入
      if (isImage) {
        // 默认标签：按文件名启发
        var autoTags = inferTagsFromName(file.name);
        entry.tags = autoTags;
        entry.type = guessImageType(file.name, autoTags);
      }

      materials.push(entry);
      renderMaterialList();
      uploadToServer(entry);

      function inferTagsFromName(name) {
        var map = {
          '美食': ['美食','食物','菜','饭','糕','面','汤'],
          '美景': ['风景','景','山','水','湖','海','公园','地标','城','街巷'],
          '人物': ['人','主持','主播','肖像','半身','照','像'],
          '产品': ['商品','货','包装','瓶','盒']
        };
        var lower = name.toLowerCase();
        var tags = [];
        for (var cat in map) {
          if (map[cat].some(function(k) { return lower.indexOf(k) >= 0; })) {
            tags.push(cat);
          }
        }
        return tags.length ? tags : ['素材'];
      }

      function guessImageType(name, tags) {
        if (tags.indexOf('人物') >= 0) return '人物';
        if (tags.indexOf('美食') >= 0) return '美食';
        if (tags.indexOf('美景') >= 0) return '美景';
        if (tags.indexOf('产品') >= 0) return '产品';
        return '图片';
      }
    });
  }

  /* 上传单个文件到服务器 */
  async function uploadToServer(entry) {
    try {
      var fd = new FormData();
      fd.append('file', entry.file);
      fd.append('type', entry.type);
      fd.append('tags', JSON.stringify(entry.tags));

      var raw = await fetch('/api/agent/materials', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (RF.getToken?.() || document.cookie.match(/rf_session=([^;]+)/)?.[1] || '') },
        body: fd
      });
      var res = await raw.json();

      if (!raw.ok || !res.ok) {
        entry.uploaded = false;
        RF.toast((res && res.error) || '上传失败：' + entry.name, 'err');
        return;
      }

      // 更新为服务端返回的信息
      entry.uploaded = true;
      entry.image_path = res.image_path || null;
      entry.serverId = res.material_id || entry.id;

      renderMaterialList();
      checkReady();
    } catch (err) {
      entry.uploaded = false;
      RF.toast('网络错误：' + entry.name, 'err');
      renderMaterialList();
    }
  }

  /* 渲染素材列表 */
  function renderMaterialList() {
    var wrap = $('materialListWrap');
    var list = $('materialList');
    var countEl = $('materialCount');

    countEl.textContent = '(' + materials.length + ')';

    if (materials.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = '';
    list.innerHTML = materials.map(function (m, idx) {
      var thumbHtml;
      if (m.localUrl) {
        thumbHtml = '<img class="thumb" src="' + m.localUrl + '" alt="" />';
      } else {
        thumbHtml = '<div class="thumb">' + (m.type === '文本' ? '📝' : '🖼️') + '</div>';
      }

      var statusIcon = m.uploaded
        ? '<span style="color:#16a34a;font-size:11px">✓ 已上传</span>'
        : '<span style="color:#d97706;font-size:11px">⏳ 上传中...</span>';

      var tagsHtml = (m.tags || []).map(function(t) {
        return '<span style="font-size:10px;color:var(--muted);background:var(--panel);padding:1px 6px;border-radius:3px;margin-right:3px">' + RF.escapeHtml(t) + '</span>';
      }).join('');

      return '<div class="material-item" data-idx="' + idx + '">' +
        thumbHtml +
        '<div class="info">' +
          '<div class="name">' + RF.escapeHtml(m.name) + '</div>' +
          '<div class="meta">' + statusIcon + ' &nbsp;' + tagsHtml + '</div>' +
        '</div>' +
        '<span class="type-tag">' + RF.escapeHtml(m.type) + '</span>' +
        '<button class="rm-btn" data-idx="' + idx + '" title="移除">×</button>' +
      '</div>';
    }).join('');

    // 绑定删除
    list.querySelectorAll('.rm-btn').forEach(function(btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        var removed = materials.splice(idx, 1)[0];
        if (removed.localUrl) URL.revokeObjectURL(removed.localUrl);
        renderMaterialList();
        checkReady();
      });
    });
  }

  /* 检查是否可以装配 */
  function checkReady() {
    var btn = $('assembleBtn');
    var hasPack = !!$('packSelect').value;
    var hasMats = materials.length > 0 && materials.some(function(m) { return m.uploaded; });
    btn.disabled = !(hasPack && hasMats);
  }

  $('packSelect').addEventListener('change', function () {
    packId = this.value;
    checkReady();
  });

  /* ═══════════════════ 执行装配 ═══════════════════ */

  async function assemble() {
    var selectedPackId = $('packSelect').value;
    if (!selectedPackId) { RF.toast('请选择模板包', 'err'); return; }

    var readyMaterials = materials.filter(function(m) { return m.uploaded; });
    if (readyMaterials.length === 0) { RF.toast('请先上传并等待素材完成上传', 'err'); return; }

    var btn = $('assembleBtn');
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '智能匹配中...';

    $('resultWrap').innerHTML =
      '<div class="agent-empty">🤖 正在分析模板槽位与你的素材…</div>';

    try {
      // 构造发送给后端的素材数据（不含 File 对象，只发元信息）
      var payloadMaterials = readyMaterials.map(function(m) {
        return {
          id: m.serverId || m.id,
          type: m.type,
          text: m.text || '',
          image_path: m.image_path || null,
          tags: m.tags || []
        };
      });

      var body = {
        packId: selectedPackId,
        materials: payloadMaterials,
        apply: true
      };
      var res = await RF.api('POST', '/agent/assemble', { body: body });
      if (!res.ok) throw new Error((res.data && res.data.error) || '装配失败');

      renderResult(res.data.proposal, res.data.saved);
      RF.toast('智能装配完成', 'ok');
    } catch (err) {
      $('resultWrap').innerHTML =
        '<div class="agent-empty">❌ ' + RF.escapeHtml(err.message) + '</div>';
      RF.toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  /* ═══════════════════ 渲染结果 ═══════════════════ */

  function renderResult(proposal, saved) {
    var bindings = proposal.bindings || [];
    var unmatched = proposal.unmatched || [];

    // 统计摘要
    var summaryHtml = '<div class="result-summary">' +
      '<span class="stat">已匹配 <b>' + bindings.length + '</b> 个槽位</span>' +
      '<span class="stat">未匹配 <b>' + unmatched.length + '</b> 个槽位</span>' +
      '<span class="stat">总槽位 <b>' + (bindings.length + unmatched.length) + '</b> 个</span>' +
      (saved && saved.id ? '<span class="stat" style="margin-left:auto">保存 ID: <b>' + saved.id.slice(0,8) + '…</b></span>' : '') +
    '</div>';

    // 绑定关系卡片
    var bindingHtml = bindings.length ? bindings.map(function(item) {
      var conf = item.confidence || 0;
      var confPct = Math.round(conf * 100);
      var confLevel = conf >= 0.7 ? 'high' : conf >= 0.4 ? 'mid' : 'low';

      // 尝试找到对应素材的缩略图
      var matThumb = '';
      var mat = findMaterialById(item.materialId);
      if (mat && mat.localUrl) {
        matThumb = '<img class="mini-thumb" src="' + mat.localUrl + '" alt="" />';
      } else if (mat && mat.image_path) {
        matThumb = '<img class="mini-thumb" src="' + mat.image_path + '" alt="" onerror="this.style.display=\'none\'" />';
      }

      return '<div class="binding-row">' +
        '<div>' +
          '<div class="slot-name">' + RF.escapeHtml(item.slot) + ' → ' + RF.escapeHtml(item.target || '') + '</div>' +
          '<div class="reason">' + RF.escapeHtml(item.reason || '') + '</div>' +
        '</div>' +
        '<div class="match-material">' + matThumb +
          '<span class="mat-name">' + RF.escapeHtml(item.materialId) + '</span>' +
        '</div>' +
        '<span class="conf-badge ' + confLevel + '">' + confPct + '%</span>' +
      '</div>';
    }).join('') : '';

    // 未匹配项
    var unmatchedHtml = unmatched.length
      ? '<h4 style="color:#dc2626;margin:14px 0 8px;font-size:14px">未匹配槽位</h4>'
        + unmatched.map(function(item) {
          return '<div class="unmatched-card">' +
            '<div class="slot-name">⚠ ' + RF.escapeHtml(item.slot) + '（' + RF.escapeHtml(item.target || '') + '）</div>' +
            '<div class="suggestion">' + RF.escapeHtml(item.suggestion || '建议补充相关素材') + '</div>' +
          '</div>';
        }).join('')
      : '';

    // JSON 展示
    var jsonHtml = '<h4 style="margin:14px 0 8px;font-size:14px;color:var(--ink)">完整 AssemblyResult</h4>' +
      '<pre class="json-view">' + RF.escapeHtml(JSON.stringify(proposal, null, 2)) + '</pre>';

    $('resultWrap').innerHTML = summaryHtml +
      (bindingHtml ? '<h4 style="margin:14px 0 8px;font-size:14px;color:var(--ink)">绑定关系</h4>' + bindingHtml : '<div class="agent-empty">没有生成任何绑定。</div>') +
      unmatchedHtml +
      jsonHtml;
  }

  function findMaterialById(id) {
    // 先按 serverId 匹配，再按原始 id
    return materials.find(function(m) { return (m.serverId || m.id) === id; }) ||
           materials.find(function(m) { return m.id === id; }) ||
           null;
  }

  /* ═══════════════════ 初始化 ═══════════════════ */

  $('assembleBtn').addEventListener('click', assemble);

  (async function init() {
    if (!(await ensureAuth())) return;
    await loadPacks();
  })();
})();
