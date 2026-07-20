/* ===========================================================================
   ReelForge -- 模板极简工作台（3 步骤）
   1. 确认剧本 → 2. 上传素材 → 3. 一键生成
   =========================================================================== */
(function () {
  var RF = window.ReelForge;
  var $ = function(id) { return document.getElementById(id); };
  var esc = function(s) { return RF.escapeHtml(s); };

  var proj = null;
  var studio = null;
  var currentStep = 0;

  function goStep(i) {
    currentStep = i;
    document.querySelectorAll('.stage').forEach(function(s) {
      s.style.display = (+s.dataset.stage === i) ? '' : 'none';
    });
    document.querySelectorAll('.step').forEach(function(s) {
      s.classList.toggle('active', +s.dataset.step === i);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function persist() {
    var meta = Object.assign({}, proj.meta || {}, { studio: studio });
    var body = { title: proj.title, type: proj.type, status: proj.status, prompt: proj.prompt, description: proj.description, meta: meta };
    var res = await RF.api('PUT', '/projects/' + proj.id, { body: body });
    if (res.ok && res.data.project) proj = res.data.project;
    return res.ok;
  }

  // ======================== 渲染 ========================

  function renderStep0() {
    var sb = studio.storyboard || [];
    $('shotCount').textContent = sb.length;

    // 摘要
    var chars = studio.characters || [];
    var scenes = studio.scenes || [];
    $('tmplPreviewSummary').innerHTML =
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">' +
        '<div class="tmpl-sum-stat"><b>' + sb.length + '</b><span>个分镜</span></div>' +
        '<div class="tmpl-sum-stat"><b>' + (chars.length) + '</b><span>个角色</span></div>' +
        '<div class="tmpl-sum-stat"><b>' + (scenes.length) + '</b><span>个场景</span></div>' +
        '<div class="tmpl-sum-stat"><b>' + (studio.requirement ? studio.requirement.duration || '-' : '-') + 's</b><span>时长</span></div>' +
      '</div>';

    // 分镜表格
    var tbody = $('shotList');
    tbody.innerHTML = sb.map(function(s, i) {
      var slotLabels = (s.slots && s.slots.length) ? s.slots.map(function(sl) { return esc(sl.label); }).join(', ') : '-';
      return '<tr>' +
        '<td class="col-num"><span class="shot-num">' + (i + 1) + '</span></td>' +
        '<td class="col-scene">' + esc(s.scene || '') + '</td>' +
        '<td>' + esc(s.shot_size || '') + '</td>' +
        '<td>' + esc(s.movement || '') + '</td>' +
        '<td>' + esc(s.angle || '') + '</td>' +
        '<td>' + esc(s.dialogue || '') + '</td>' +
        '<td class="col-slot" style="font-size:12px;max-width:140px">' + slotLabels + '</td>' +
      '</tr>';
    }).join('');
  }

  // 预览模板弹窗
  function openTmplPreview() {
    var sb = studio.storyboard || [];
    var chars = studio.characters || [];
    var scenes = studio.scenes || [];

    // 角色列表
    var charHtml = chars.length ? '<div style="margin-bottom:14px"><span class="sub-head">👤 角色设定</span>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">' +
      chars.map(function(c) { return '<div class="pv-char-card"><b>' + esc(c.name) + '</b><p class="muted" style="font-size:11.5px;margin:2px 0 0">' + esc(c.desc) + '</p><span style="font-size:11px;color:var(--brand);font-weight:600">' + esc(c.role) + '</span></div>'; }).join('') +
      '</div></div>' : '';

    // 场景列表
    var sceneHtml = scenes.length ? '<div style="margin-bottom:14px"><span class="sub-head">🎬 场景设定</span>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">' +
      scenes.map(function(s) { return '<div class="pv-scene-card"><b>' + esc(s.name) + '</b><p class="muted" style="font-size:11.5px;margin:2px 0 0">' + esc(s.desc) + '</p></div>'; }).join('') +
      '</div></div>' : '';

    // 分镜时间轴
    var tlHtml = sb.map(function(s, i) {
      var dur = s.duration || 5;
      var hasSlot = !!(s.slots && s.slots.length);
      return '<div class="pv-tl-item" style="flex-basis:' + (dur * 3) + '%;min-width:60px">' +
        '<div class="pv-tl-thumb' + (hasSlot ? ' has-slot' : '') + '">' +
          '<span class="pv-tl-num">' + (i + 1) + '</span>' +
          (hasSlot ? '<span class="pv-tl-slot-badge">需素材</span>' : '') +
        '</div>' +
        '<p class="pv-tl-scene" title="' + esc(s.scene) + '">' + esc((s.scene || '').slice(0, 20)) + '</p>' +
        '<p class="pv-tl-dur">' + dur + 's</p>' +
      '</div>';
    }).join('');

    $('previewModalTitle').textContent = '模板预览 · ' + esc(proj.title);
    $('tmplPreviewBody').innerHTML =
      charHtml + sceneHtml +
      '<div><span class="sub-head">🎞️ 分镜时间轴</span>' +
        '<div class="pv-timeline" style="margin-top:8px;display:flex;gap:6px;padding:10px;background:var(--bg,#f6f7fb);border-radius:var(--radius);overflow-x:auto">' + tlHtml + '</div>' +
      '</div>' +
      (studio.requirement ? '<div style="margin-top:14px"><span class="sub-head">📋 基础需求</span>' +
        '<div class="req-grid" style="margin-top:8px">' +
          '<div class="req-group"><div class="group-title">风格基调</div><p>' + (esc(studio.requirement.tone) || '-') + '</p></div>' +
          '<div class="req-group"><div class="group-title">目标受众</div><p>' + (esc(studio.requirement.audience) || '-') + '</p></div>' +
          '<div class="req-group"><div class="group-title">画幅比例</div><p>' + (esc(studio.requirement.ratio) || '-') + '</p></div>' +
          '<div class="req-group"><div class="group-title">情绪氛围</div><p>' + (esc(studio.requirement.mood) || '-') + '</p></div>' +
        '</div></div>' : '') +
      '<p class="muted" style="margin-top:12px;font-size:11.5px;text-align:center">演示预览 · 实际成片由你接入的大模型 API 渲染生成</p>';

    $('previewModal').style.display = '';
  }

  function closeTmplPreview() {
    $('previewModal').style.display = 'none';
  }

  function renderStep1() {
    var slots = [];
    var sb = studio.storyboard || [];
    var matSlots = (proj.meta && proj.meta.material_slots) || {};

    sb.forEach(function(s, shotIdx) {
      if (s.slots && s.slots.length) {
        s.slots.forEach(function(sl) {
          slots.push({
            shotIdx: shotIdx,
            slotId: sl.id,
            label: sl.label,
            type: sl.type,
            hint: sl.hint,
            category: sl.category || 'scene',
            scene: s.scene,
            url: matSlots[sl.id] || '',
          });
        });
      }
    });

    if (!slots.length) {
      $('slotList').innerHTML = '<p class="muted" style="padding:20px;text-align:center">该模板不需要额外上传素材，可直接生成。</p>';
      return;
    }

    // 按分类分组
    var charSlots = slots.filter(function(s) { return s.category === 'character'; });
    var sceneSlots = slots.filter(function(s) { return s.category === 'scene'; });

    function renderSlotCard(sl) {
      return '<div class="slot-upload-card" id="slotCard_' + sl.slotId + '">' +
        '<div class="suc-left">' +
          '<span class="suc-badge">第 ' + (sl.shotIdx + 1) + ' 镜</span>' +
          '<div class="suc-scene">' + esc(sl.scene.slice(0, 60)) + '</div>' +
          '<div class="suc-label">' +
            '<span class="suc-type ' + sl.type + '">' + (sl.type === 'video' ? '视频' : '图片') + '</span>' +
            esc(sl.label) +
          '</div>' +
          '<div class="suc-hint">' + esc(sl.hint) + '</div>' +
        '</div>' +
        '<div class="suc-right">' +
          (sl.url
            ? '<div class="suc-preview"><img src="' + esc(sl.url) + '" onerror="this.style.display=\'none\'" /><button class="suc-remove" data-slot="' + sl.slotId + '">&times;</button></div>'
            : '<div class="suc-upload" data-slot="' + sl.slotId + '" data-type="' + sl.type + '">' +
                '<span class="suc-upload-icon">+</span>' +
                '<span style="font-size:11px;color:var(--muted)">点击上传</span>' +
                '<input type="file" class="suc-file-input" accept="' + (sl.type === 'video' ? 'video/*' : 'image/*') + '" style="display:none" />' +
              '</div>'
          ) +
        '</div>' +
      '</div>';
    }

    var leftHtml = charSlots.length
      ? '<div class="slot-col-header"><span class="slot-col-icon">👤</span><b>人物素材</b><span class="slot-col-count">' + charSlots.length + ' 项</span></div>' +
        charSlots.map(renderSlotCard).join('')
      : '<div style="padding:24px;text-align:center;color:var(--muted)">该模板暂无人物素材槽位</div>';

    var rightHtml = sceneSlots.length
      ? '<div class="slot-col-header"><span class="slot-col-icon">🎬</span><b>场景素材</b><span class="slot-col-count">' + sceneSlots.length + ' 项</span></div>' +
        sceneSlots.map(renderSlotCard).join('')
      : '<div style="padding:24px;text-align:center;color:var(--muted)">该模板暂无场景素材槽位</div>';

    $('slotList').innerHTML =
      '<div class="slot-two-col">' +
        '<div class="slot-column slot-col-char">' + leftHtml + '</div>' +
        '<div class="slot-column slot-col-scene">' + rightHtml + '</div>' +
      '</div>';

    // 绑定上传事件
    document.querySelectorAll('.suc-upload').forEach(function(el) {
      el.addEventListener('click', function() {
        var inp = el.querySelector('.suc-file-input');
        inp.click();
      });
    });
    document.querySelectorAll('.suc-file-input').forEach(function(inp) {
      inp.addEventListener('change', function() { handleSlotUpload(inp); });
    });
    document.querySelectorAll('.suc-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeSlotMaterial(btn.dataset.slot);
        renderStep1();
      });
    });
  }

  async function handleSlotUpload(input) {
    var file = input.files[0];
    if (!file) return;
    var slotId = input.parentElement.dataset.slot;

    // 上传到后端
    var formData = new FormData();
    formData.append('file', file);
    try {
      var resp = await fetch('/api/projects/' + proj.id + '/materials', {
        method: 'POST',
        body: formData,
      });
      var data = await resp.json();
      if (data.ok && data.url) {
        // 保存槽位映射
        var slots = (proj.meta && proj.meta.material_slots) || {};
        slots[slotId] = data.url;
        proj.meta.material_slots = slots;
        await persist();
        RF.toast('素材已上传', 'ok');
        renderStep1();
      } else {
        RF.toast(data.error || '上传失败', 'err');
      }
    } catch (err) {
      RF.toast('上传失败，请重试', 'err');
    }
  }

  async function removeSlotMaterial(slotId) {
    var slots = (proj.meta && proj.meta.material_slots) || {};
    delete slots[slotId];
    proj.meta.material_slots = slots;
    await persist();
    RF.toast('素材已移除', 'ok');
  }

  function renderStep2() {
    var sb = studio.storyboard || [];
    var slotCount = 0;
    var filledCount = 0;
    var matSlots = (proj.meta && proj.meta.material_slots) || {};
    sb.forEach(function(s) {
      if (s.slots && s.slots.length) {
        s.slots.forEach(function(sl) {
          slotCount++;
          if (matSlots[sl.id]) filledCount++;
        });
      }
    });
    $('tmplGenSummary').innerHTML =
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px">' +
        '<div class="tmpl-sum-stat"><b>' + sb.length + '</b><span>分镜</span></div>' +
        '<div class="tmpl-sum-stat"><b>' + filledCount + '/' + slotCount + '</b><span>素材已上传</span></div>' +
      '</div>';
  }

  function renderProdStatus(status) {
    var statusEl = $('prodStatus');
    var labels = { idle: '未开始', queued: '排队中', rendering: '渲染中', done: '已完成', failed: '失败' };
    statusEl.textContent = labels[status] || status;
    statusEl.className = 'prod-status ' + (status || 'idle');
  }

  function renderPreview() {
    var el = $('preview');
    var sb = studio.storyboard || [];
    var dur = (proj.meta && proj.meta.duration) || sb.length * 5;
    var matSlots = (proj.meta && proj.meta.material_slots) || {};
    el.style.display = '';
    var frameHtml = sb.map(function(s, i) {
      var hasMaterial = false;
      if (s.slots) {
        s.slots.forEach(function(sl) {
          if (matSlots[sl.id]) hasMaterial = true;
        });
      }
      return '<div class="merged-frame"><div class="mf-thumb" style="background:' +
        (hasMaterial ? '#e8f5e9' : '#f1f3f9') + ';display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted)">' +
        (hasMaterial ? '已上传' : 'AI') + '</div><div class="mf-label">镜' + (i + 1) + '</div></div>';
    }).join('');
    var videoHtml = (studio.production && studio.production.videoUrl)
      ? '<div class="mp-video"><video src="' + esc(studio.production.videoUrl) + '" controls style="width:100%;border-radius:12px;background:#000;max-height:360px"></video></div>'
      : '';
    el.innerHTML =
      '<div class="mp-title">成片预览 · ' + dur + 's · ' + esc(proj.title) + '</div>' +
      '<div class="merged-timeline">' + frameHtml + '</div>' +
      videoHtml +
      '<div class="mp-card"><div class="mp-thumb"></div><div class="pv-meta"><div class="pv-title">' + esc(proj.title) + '</div><div class="pv-sub">' + sb.length + ' 个镜头 · 含 ' +
        Object.keys(matSlots).length + ' 个用户素材</div></div></div>' +
      '<p class="muted" style="margin-top:10px;font-size:12px">' + (studio.production && studio.production.videoUrl ? '真实成片（由通义万相渲染生成）。' : '演示占位画面。实际成片由你接入的大模型 API 渲染生成。') + '</p>';
  }

  // ======================== 生成 ========================

  var genTimer = null;
  var genPollTimer = null;

  // 根据项目/分镜拼出传给 AI 的生成提示词
  function buildGenPrompt() {
    var parts = [];
    if (proj && proj.title) parts.push('主题：' + proj.title);
    var sb = studio.storyboard || [];
    sb.forEach(function(s, i) {
      var d = s.desc || s.prompt || s.note || s.text || '';
      if (d) parts.push('镜头' + (i + 1) + '：' + d);
    });
    return parts.join('；') || (proj && proj.title) || '一段高质量的短视频';
  }

  function startGenerate() {
    if (!studio.production) studio.production = {};
    tryGenerateReal().catch(function() { startGenerateDemo(); });
  }

  // 真实生成：提交后端 -> 轮询任务状态；未配置或失败回退演示
  async function tryGenerateReal() {
    var prompt = buildGenPrompt();
    var submit = await RF.api('POST', '/projects/' + proj.id + '/generate', { prompt: prompt });
    if (!submit.ok || !submit.data || !submit.data.configured) {
      return startGenerateDemo();
    }
    if (genPollTimer) clearInterval(genPollTimer);
    studio.production.status = 'queued';
    renderProdStatus('queued');
    persist();
    var btn = $('genBtn');
    btn.disabled = true;
    btn.textContent = '生成中…';
    RF.toast('已提交生成任务，等待渲染…', 'ok');
    pollTask(submit.data.taskId);
  }

  function pollTask(taskId) {
    genPollTimer = setInterval(async function() {
      try {
        var r = await RF.api('GET', '/tasks/' + taskId);
        if (!r.ok || !r.data) return;
        studio.production.status = r.data.status;
        renderProdStatus(r.data.status);
        persist();
        if (r.data.status === 'done') {
          clearInterval(genPollTimer);
          studio.production.videoUrl = r.data.videoUrl;
          renderPreview();
          var btn = $('genBtn');
          btn.disabled = false;
          btn.textContent = '重新生成';
          $('genBtn').classList.add('done');
          RF.toast('成片已完成', 'ok');
        } else if (r.data.status === 'failed') {
          clearInterval(genPollTimer);
          RF.toast('真实生成失败，已回退演示模式', 'err');
          startGenerateDemo();
        }
      } catch (e) { /* 轮询瞬时错误忽略 */ }
    }, 3000);
  }

  // 演示模式（无 API Key 时）：状态机模拟 queued -> rendering -> done
  function startGenerateDemo() {
    if (!studio.production) studio.production = {};
    studio.production.status = 'queued';
    renderProdStatus('queued');
    persist();
    var btn = $('genBtn');
    btn.disabled = true;
    btn.textContent = '生成中…';

    function advance() {
      if (studio.production.status === 'queued') studio.production.status = 'rendering';
      else if (studio.production.status === 'rendering') studio.production.status = 'done';
      renderProdStatus(studio.production.status);
      persist();
      if (studio.production.status === 'done') {
        renderPreview();
        var btn = $('genBtn');
        btn.disabled = false;
        btn.textContent = '重新生成';
        $('genBtn').classList.add('done');
        RF.toast('成片已完成（演示）', 'ok');
        return;
      }
      genTimer = setTimeout(function() { advance(); }, studio.production.status === 'rendering' ? 2400 : 900);
    }
    genTimer = setTimeout(function() { advance(); }, 900);
  }

  // ======================== 项目名称编辑 ========================

  var originalTitle = '';

  function startEditTitle() {
    if (!proj) return;
    originalTitle = proj.title;
    var textEl = $('projTitleText');
    var inputEl = $('projTitleInput');
    var editBtn = $('projTitleEditBtn');

    textEl.style.display = 'none';
    editBtn.style.display = 'none';
    inputEl.style.display = '';
    inputEl.value = proj.title;
    inputEl.focus();
    inputEl.select();
  }

  function saveTitle() {
    var inputEl = $('projTitleInput');
    var newTitle = inputEl.value.trim();
    if (!newTitle) {
      cancelEditTitle();
      return;
    }
    // 立即更新本地和 UI
    proj.title = newTitle;
    $('projTitleText').textContent = newTitle;
    showTitleMode();
    // 异步保存到后端
    persist().then(function(ok) {
      if (ok) RF.toast('项目名称已更新', 'ok');
      else { proj.title = originalTitle; $('projTitleText').textContent = originalTitle; RF.toast('保存失败', 'err'); }
    });
  }

  function cancelEditTitle() {
    $('projTitleInput').value = originalTitle;
    showTitleMode();
  }

  function showTitleMode() {
    $('projTitleText').style.display = '';
    $('projTitleEditBtn').style.display = '';
    $('projTitleInput').style.display = 'none';
  }

  // ======================== Wire ========================

  function wire() {
    // 项目名称编辑
    $('projTitleText').addEventListener('click', startEditTitle);
    $('projTitleEditBtn').addEventListener('click', startEditTitle);
    var titleInput = $('projTitleInput');
    titleInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEditTitle(); }
    });
    titleInput.addEventListener('blur', saveTitle);

    // 步骤切换
    $('next0Btn').addEventListener('click', function() { goStep(1); renderStep1(); });
    $('back0Btn').addEventListener('click', function() { goStep(0); });
    $('next1Btn').addEventListener('click', function() { goStep(2); renderStep2(); });
    $('back1Btn').addEventListener('click', function() { goStep(1); renderStep1(); });

    // 预览模板
    $('previewTmplBtn').addEventListener('click', openTmplPreview);
    $('previewCloseBtn').addEventListener('click', closeTmplPreview);
    $('previewModal').addEventListener('click', function(e) { if (e.target === $('previewModal')) closeTmplPreview(); });

    // stepper 点击
    document.querySelectorAll('.step').forEach(function(s) {
      s.addEventListener('click', function() { goStep(+s.dataset.step); });
    });

    // 生成
    $('genBtn').addEventListener('click', function() {
      var btn = $('genBtn');
      btn.disabled = true;
      btn.textContent = '生成中…';
      startGenerate();
    });

    $('logoutBtn') && $('logoutBtn').addEventListener('click', function(e) { e.preventDefault(); RF.logout(); });
  }

  // ======================== Init ========================

  async function init() {
    var user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return; }

    // 根据 URL 参数加载项目
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    if (!id) { location.href = '/dashboard.html'; return; }

    var res = await RF.api('GET', '/projects/' + id);
    if (!res.ok) { RF.toast('项目加载失败', 'err'); location.href = '/dashboard.html'; return; }
    proj = res.data.project;
    studio = (proj.meta && proj.meta.studio) || { storyboard: [] };

    $('projTitleText').textContent = proj.title;
    $('projSub').textContent = (proj.meta && proj.meta.template_label) || '模板项目';

    renderStep0();
    wire();
  }

  init();
})();
