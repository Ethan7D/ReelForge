/* ===========================================================================
   ReelForge -- 控制台逻辑（需要登录）
   3 个视图：视频项目 / 模板项目 / 我的资产
   =========================================================================== */
(function () {
  const RF = window.ReelForge;
  const $ = (id) => document.getElementById(id);

  async function ensureAuth() {
    const user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return false; }
    return true;
  }

  const TYPE_LABEL = { short_video: '短视频', ad: '广告', course: '课程', news: '资讯', other: '其他' };
  const STATUS_LABEL = { draft: '草稿', queued: '排队中', rendering: '渲染中', done: '已完成', failed: '失败' };

  let ALL_PROJECTS = [];
  let batchMode = { projects: false, templates: false };
  let batchSelected = { projects: new Set(), templates: new Set() };
  let searchTerm = { projects: '', templates: '' };

  function isTemplateProject(p) {
    return p.meta && p.meta.template_id;
  }

  function renderProjects(projects) {
    const grid = $('projectGrid');
    if (!projects.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        '<h3 style="margin:0 0 8px">还没有视频项目</h3>' +
        '<p>从零开始创建你自己的 AI 视频生产流水线。</p>' +
        '<button class="btn btn-primary" onclick="window.Dash.createQuick()">+ 新建项目</button>' +
      '</div>';
      return;
    }
    var isBatch = batchMode.projects;
    grid.innerHTML = projects.map(function(p) {
      return '<div class="project-card' + (isBatch ? ' batch-mode' : '') + '" data-pid="' + p.id + '">' +
        (isBatch
          ? '<label class="batch-check"><input type="checkbox" value="' + p.id + '" class="batch-cb-proj" /><span></span></label>'
          : ''
        ) +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<span class="type-tag">' + (TYPE_LABEL[p.type] || p.type) + '</span>' +
          '<span class="status ' + p.status + '">' + (STATUS_LABEL[p.status] || p.status) + '</span>' +
        '</div>' +
        '<h4 style="margin-top:10px">' + RF.escapeHtml(p.title) + '</h4>' +
        '<div class="meta">' + (p.prompt ? RF.escapeHtml(p.prompt) : '<span class="muted">暂无创意描述</span>') + '</div>' +
        '<div class="meta" style="margin-top:6px">更新于 ' + RF.escapeHtml(p.updated_at) + '</div>' +
        (!isBatch ? '<div class="project-actions">' +
          '<a class="icon-btn" href="/studio.html?id=' + p.id + '">工作台</a>' +
          '<button class="icon-btn" data-edit="' + p.id + '">编辑</button>' +
          '<button class="icon-btn danger" data-del="' + p.id + '">删除</button>' +
        '</div>' : '') +
      '</div>';
    }).join('');
    if (!isBatch) {
      grid.querySelectorAll('[data-edit]').forEach(function(b) {
        b.addEventListener('click', function() { openModal(+b.dataset.edit); });
      });
      grid.querySelectorAll('[data-del]').forEach(function(b) {
        b.addEventListener('click', function() { delProject(+b.dataset.del); });
      });
    } else {
      // 批量模式：绑定 checkbox 事件
      grid.querySelectorAll('.batch-cb-proj').forEach(function(cb) {
        cb.addEventListener('change', function() {
          if (cb.checked) batchSelected.projects.add(+cb.value);
          else batchSelected.projects.delete(+cb.value);
          updateBatchBar('projects');
        });
        if (batchSelected.projects.has(+cb.value)) cb.checked = true;
      });
      updateBatchBar('projects');
    }
  }

  function renderTemplateProjects(projects) {
    var grid = $('templateGrid');
    if (!projects.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        '<h3 style="margin:0 0 8px">还没有模板项目</h3>' +
        '<p>从预设模板开始，只需上传素材即可一键生成视频。</p>' +
        '<button class="btn btn-primary" onclick="location.href=\'templates.html\'">从模板快速开始</button>' +
      '</div>';
      return;
    }
    var isBatch = batchMode.templates;
    grid.innerHTML = projects.map(function(p) {
      var tmplId = (p.meta && p.meta.template_id) || '';
      var tmplLabel = (p.meta && p.meta.template_label) || '模板';
      var slots = (p.meta && p.meta.material_slots) || {};
      var slotKeys = Object.keys(slots);
      var filledSlots = slotKeys.filter(function(k) { return !!slots[k]; });
      var fillPct = slotKeys.length ? Math.round(filledSlots.length / slotKeys.length * 100) : 0;
      return '<div class="project-card template-card' + (isBatch ? ' batch-mode' : '') + '" data-pid="' + p.id + '">' +
        (isBatch
          ? '<label class="batch-check"><input type="checkbox" value="' + p.id + '" class="batch-cb-tmpl" /><span></span></label>'
          : ''
        ) +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<span class="type-tag" style="background:#f0f3ff;color:#4f46e5">' + RF.escapeHtml(tmplLabel) + '</span>' +
          '<span class="status ' + p.status + '">' + (STATUS_LABEL[p.status] || p.status) + '</span>' +
        '</div>' +
        '<h4 style="margin-top:10px">' + RF.escapeHtml(p.title) + '</h4>' +
        '<div class="meta">' +
          '<span class="slot-fill-bar" style="display:inline-flex;align-items:center;gap:6px;margin-top:4px">' +
            '<span style="font-size:11px;color:var(--muted)">素材: ' + filledSlots.length + '/' + slotKeys.length + '</span>' +
            '<span style="display:inline-block;width:80px;height:4px;background:var(--line);border-radius:2px;overflow:hidden">' +
              '<span style="display:block;width:' + fillPct + '%;height:100%;background:' + (fillPct === 100 ? '#16a34a' : 'var(--brand)') + ';border-radius:2px"></span>' +
            '</span>' +
          '</span>' +
        '</div>' +
        '<div class="meta" style="margin-top:6px">更新于 ' + RF.escapeHtml(p.updated_at) + '</div>' +
        (!isBatch ? '<div class="project-actions">' +
          '<a class="icon-btn" href="/studio-template.html?id=' + p.id + '">工作台</a>' +
          '<button class="icon-btn danger" data-del="' + p.id + '">删除</button>' +
        '</div>' : '') +
      '</div>';
    }).join('');
    if (!isBatch) {
      grid.querySelectorAll('[data-del]').forEach(function(b) {
        b.addEventListener('click', function() { delProject(+b.dataset.del); });
      });
    } else {
      grid.querySelectorAll('.batch-cb-tmpl').forEach(function(cb) {
        cb.addEventListener('change', function() {
          if (cb.checked) batchSelected.templates.add(+cb.value);
          else batchSelected.templates.delete(+cb.value);
          updateBatchBar('templates');
        });
        if (batchSelected.templates.has(+cb.value)) cb.checked = true;
      });
      updateBatchBar('templates');
    }
  }

  function renderStats(projects) {
    $('stTotal').textContent = projects.length;
    $('stRendering').textContent = projects.filter(function(p) { return p.status === 'rendering' || p.status === 'queued'; }).length;
    $('stDone').textContent = projects.filter(function(p) { return p.status === 'done'; }).length;
    $('stDraft').textContent = projects.filter(function(p) { return p.status === 'draft'; }).length;
  }

  // 按视图过滤：模板判断 + 名称搜索
  function getProjectsView() {
    var term = searchTerm.projects.trim().toLowerCase();
    return ALL_PROJECTS.filter(function(p) {
      if (isTemplateProject(p)) return false;
      if (term && (p.title || '').toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
  }
  function getTemplatesView() {
    var term = searchTerm.templates.trim().toLowerCase();
    return ALL_PROJECTS.filter(function(p) {
      if (!isTemplateProject(p)) return false;
      if (term && (p.title || '').toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
  }

  async function loadProjects() {
    var res = await RF.api('GET', '/projects');
    if (!res.ok) { if (res.data && res.data.error) RF.toast(res.data.error, 'err'); return; }
    ALL_PROJECTS = res.data.projects || [];
    renderStats(ALL_PROJECTS);
    renderProjects(getProjectsView());
    renderTemplateProjects(getTemplatesView());
  }

  // ---------- Modal ----------
  function openModal(id) {
    var modal = $('modal');
    modal.classList.add('open');
    $('pErr').textContent = '';
    if (id) {
      $('modalTitle').textContent = '编辑项目';
      $('saveBtn').textContent = '保存修改';
      var res = RF.api('GET', '/projects/' + id);
      res.then(function(result) {
        if (!result.ok) return;
        var p = result.data.project;
        $('projId').value = p.id;
        $('pTitle').value = p.title;
        $('pType').value = p.type;
        $('pStatus').value = p.status;
        $('pPrompt').value = p.prompt || '';
        $('pDesc').value = p.description || '';
        $('pVendor').value = (p.meta && p.meta.vendor) || '';
        $('pDuration').value = (p.meta && p.meta.duration) || '';
      });
    } else {
      $('modalTitle').textContent = '新建项目';
      $('saveBtn').textContent = '创建';
      $('projectForm').reset();
      $('projId').value = '';
    }
  }
  function closeModal() { $('modal').classList.remove('open'); }

  var saving = false;
  async function saveProject(e) {
    e.preventDefault();
    if (saving) return;
    var id = $('projId').value;
    var meta = {};
    if ($('pVendor').value.trim()) meta.vendor = $('pVendor').value.trim();
    if ($('pDuration').value) meta.duration = Number($('pDuration').value);
    var body = {
      title: $('pTitle').value.trim(),
      type: $('pType').value,
      status: $('pStatus').value,
      prompt: $('pPrompt').value.trim(),
      description: $('pDesc').value.trim(),
      meta: meta,
    };
    var btn = $('saveBtn');
    saving = true;
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '保存中…';
    $('pErr').textContent = '';
    try {
      var result = id
        ? await RF.api('PUT', '/projects/' + id, { body: body })
        : await RF.api('POST', '/projects', { body: body });
      if (result.ok) {
        closeModal();
        RF.toast(id ? '已保存' : '项目已创建', 'ok');
        loadProjects();
      } else {
        $('pErr').textContent = (result.data && result.data.error) || '保存失败';
        btn.disabled = false;
        btn.textContent = oldText;
      }
    } catch (err) {
      $('pErr').textContent = '网络异常，请检查连接后重试';
      RF.toast('保存失败，请重试', 'err');
      btn.disabled = false;
      btn.textContent = oldText;
    } finally {
      saving = false;
    }
  }

  async function delProject(id) {
    if (!confirm('确定删除该项目？此操作不可恢复。')) return;
    var res = await RF.api('DELETE', '/projects/' + id);
    if (res.ok) { RF.toast('已删除', 'ok'); loadProjects(); }
    else RF.toast((res.data && res.data.error) || '删除失败', 'err');
  }

  // ---------- 批量管理 ----------
  function updateBatchBar(type) {
    var set = type === 'projects' ? batchSelected.projects : batchSelected.templates;
    var countEl = type === 'projects' ? $('batchProjCount') : $('batchTmplCount');
    countEl.textContent = set.size;
    updateSelAllLabel(type);
  }

  function updateSelAllLabel(type) {
    var selAllBtn = type === 'projects' ? $('batchProjSelAllBtn') : $('batchTmplSelAllBtn');
    if (!selAllBtn) return;
    var checkboxes = type === 'projects'
      ? document.querySelectorAll('#projectGrid .batch-cb-proj')
      : document.querySelectorAll('#templateGrid .batch-cb-tmpl');
    if (!checkboxes.length) { selAllBtn.textContent = '全选'; selAllBtn.disabled = true; return; }
    selAllBtn.disabled = false;
    var allChecked = true;
    checkboxes.forEach(function(cb) { if (!cb.checked) allChecked = false; });
    selAllBtn.textContent = allChecked ? '取消全选' : '全选';
  }

  function toggleSelectAll(type) {
    var checkboxes = type === 'projects'
      ? document.querySelectorAll('#projectGrid .batch-cb-proj')
      : document.querySelectorAll('#templateGrid .batch-cb-tmpl');
    var set = type === 'projects' ? batchSelected.projects : batchSelected.templates;
    if (!checkboxes.length) return;
    var allChecked = true;
    checkboxes.forEach(function(cb) { if (!cb.checked) allChecked = false; });
    checkboxes.forEach(function(cb) {
      cb.checked = !allChecked;
      if (!allChecked) set.add(+cb.value);
      else set.delete(+cb.value);
    });
    updateBatchBar(type);
  }

  function toggleBatchMode(type) {
    batchMode[type] = !batchMode[type];
    var btn = type === 'projects' ? $('batchProjectsBtn') : $('batchTemplatesBtn');
    var bar = type === 'projects' ? $('batchProjectsBar') : $('batchTemplatesBar');
    if (batchMode[type]) {
      btn.textContent = '退出批量';
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-primary');
      bar.style.display = '';
      if (type === 'projects') renderProjects(getProjectsView());
      else renderTemplateProjects(getTemplatesView());
    } else {
      btn.textContent = '批量管理';
      btn.classList.add('btn-ghost');
      btn.classList.remove('btn-primary');
      bar.style.display = 'none';
      var selAllBtn = type === 'projects' ? $('batchProjSelAllBtn') : $('batchTmplSelAllBtn');
      if (selAllBtn) selAllBtn.textContent = '全选';
      if (type === 'projects') { batchSelected.projects.clear(); renderProjects(getProjectsView()); }
      else { batchSelected.templates.clear(); renderTemplateProjects(getTemplatesView()); }
    }
  }

  async function batchDelete(type) {
    var set = type === 'projects' ? batchSelected.projects : batchSelected.templates;
    var ids = Array.from(set);
    if (!ids.length) { RF.toast('请先选择要删除的项目', 'err'); return; }
    if (!confirm('确定删除选中的 ' + ids.length + ' 个项目？此操作不可恢复。')) return;
    var okCount = 0;
    for (var i = 0; i < ids.length; i++) {
      try {
        var res = await RF.api('DELETE', '/projects/' + ids[i]);
        if (res.ok) okCount++;
      } catch (e) { /* skip */ }
    }
    set.clear();
    RF.toast('成功删除 ' + okCount + '/' + ids.length + ' 个项目', 'ok');
    toggleBatchMode(type); // exit batch mode
    loadProjects();
  }

  var PLAN_CN = { experience: '体验版', pro: '专业版', enterprise: '旗舰版' };
  function renderMemberState() {
    var el = $('memberState');
    if (!el) return;
    var m = RF.getMembership && RF.getMembership();
    if (m && m.isActive) {
      el.innerHTML = '会员状态：<b style="color:#15803d">' + (PLAN_CN[m.plan] || m.plan) + '</b> · 有效期至 ' + (m.expires_at || '') + ' · 享优先渲染';
    } else {
      el.innerHTML = '当前未开通会员，<a href="/pricing.html" style="color:var(--brand)">开通会员</a>可享优先渲染与更高并发额度（创建项目免费）。';
    }
  }

  // ---------- Wire up ----------
  window.Dash = { openModal: openModal, createQuick: createQuickProject };
  $('newBtn').addEventListener('click', createQuickProject);
  $('cancelBtn').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function(e) { if (e.target === $('modal')) closeModal(); });
  $('goTemplatesBtn').addEventListener('click', function() { location.href = 'templates.html'; });

  // 批量管理按钮
  $('batchProjectsBtn').addEventListener('click', function() { toggleBatchMode('projects'); });
  $('batchTemplatesBtn').addEventListener('click', function() { toggleBatchMode('templates'); });
  $('batchProjCancelBtn').addEventListener('click', function() { toggleBatchMode('projects'); });
  $('batchTmplCancelBtn').addEventListener('click', function() { toggleBatchMode('templates'); });
  $('batchProjDelBtn').addEventListener('click', function() { batchDelete('projects'); });
  $('batchTmplDelBtn').addEventListener('click', function() { batchDelete('templates'); });
  $('batchProjSelAllBtn').addEventListener('click', function() { toggleSelectAll('projects'); });
  $('batchTmplSelAllBtn').addEventListener('click', function() { toggleSelectAll('templates'); });

  // 搜索框：按项目名称实时过滤（render 函数内部已根据 isBatch 标志处理批量模式）
  $('projSearchInput').addEventListener('input', function() {
    searchTerm.projects = this.value;
    renderProjects(getProjectsView());
  });
  $('tmplSearchInput').addEventListener('input', function() {
    searchTerm.templates = this.value;
    renderTemplateProjects(getTemplatesView());
  });

  // ===== 控制台主区视图切换（由 URL ?tab= 驱动，侧栏导航由 site.js 统一渲染） =====
  var projView = $('dashViewProjects');
  var tmplView = $('dashViewTemplates');
  var assetView = $('dashViewAssets');
  function switchDashTab(tab) {
    projView.style.display = (tab === 'projects') ? '' : 'none';
    tmplView.style.display = (tab === 'templates') ? '' : 'none';
    assetView.style.display = (tab === 'assets') ? '' : 'none';
  }

  // 资产分类标签切换
  document.querySelectorAll('.asset-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.asset-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
    });
  });
  $('assetQueryBtn').addEventListener('click', function() { RF.toast('资产查询功能（演示占位）', 'ok'); });
  $('assetUploadBtn').addEventListener('click', function() { RF.toast('上传功能：选择本地文件上传到素材库（演示占位）', 'ok'); });

  var quickCreating = false;
  async function createQuickProject() {
    if (quickCreating) return;
    quickCreating = true;
    try {
      var res = await RF.api('POST', '/projects', {
        body: {
          title: '未命名项目',
          type: 'short_video',
          status: 'draft',
          prompt: '',
          description: '',
          meta: { make_mode: 'quick' },
        },
      });
      if (res.ok && res.data.project) {
        location.href = '/studio.html?id=' + res.data.project.id;
        return;
      }
      RF.toast((res.data && res.data.error) || '创建失败', 'err');
    } catch (err) {
      RF.toast('网络异常，请重试', 'err');
    } finally {
      quickCreating = false;
    }
  }
  $('projectForm').addEventListener('submit', saveProject);

  (async function init() {
    if (!(await ensureAuth())) return;
    renderMemberState();
    loadProjects();

    // 根据 URL 参数 ?tab= 切换初始视图（使外部链接 /templates.html 的「返回项目」、
    // studio.html 的「返回项目」跳转到对应的项目目录页）
    var initTab = (new URLSearchParams(location.search).get('tab') || 'projects');
    if (['projects', 'templates', 'assets'].indexOf(initTab) === -1) initTab = 'projects';
    switchDashTab(initTab);
  })();
})();
