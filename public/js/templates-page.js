/* ===========================================================================
   ReelForge -- 模板选择页
   =========================================================================== */
(function () {
  var RF = window.ReelForge;
  var $ = function(id) { return document.getElementById(id); };
  var templates = window.ReelForgeTemplates || [];

  async function ensureAuth() {
    var user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return; }
  }

  function renderTemplates(filter) {
    var filtered = templates;
    if (filter && filter !== 'all') {
      filtered = templates.filter(function(t) { return t.category === filter; });
    }
    var grid = $('tmplGrid');
    var empty = $('tmplEmpty');
    if (!filtered.length) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    grid.style.display = '';
    grid.innerHTML = filtered.map(function(t) {
      var slotCount = 0;
      if (t.studio && t.studio.storyboard) {
        t.studio.storyboard.forEach(function(s) {
          if (s.slots) slotCount += s.slots.length;
        });
      }
      return '<div class="tmpl-card" onclick="window.TmplPage.select(\'' + t.id + '\')">' +
        '<div class="tmpl-thumb" style="background:linear-gradient(135deg,' + (
          t.category === 'tourism' ? '#e8f5e9,#c8e6c9' :
          t.category === 'ecommerce' ? '#fce4ec,#f8bbd0' : '#e3f2fd,#bbdefb'
        ) + ')">' +
          '<span class="tmpl-cat-badge">' + RF.escapeHtml(t.categoryLabel) + '</span>' +
          '<span class="tmpl-dur-badge">' + t.duration + 's</span>' +
        '</div>' +
        '<div class="tmpl-body">' +
          '<h4>' + RF.escapeHtml(t.name) + '</h4>' +
          '<p class="muted">' + RF.escapeHtml(t.desc) + '</p>' +
          '<div class="tmpl-meta">' +
            '<span>' + t.studio.storyboard.length + ' 个分镜</span>' +
            '<span>' + slotCount + ' 个素材槽位</span>' +
          '</div>' +
          '<div class="tmpl-tags">' +
            (t.tags || []).map(function(tag) { return '<span class="tmpl-tag">' + tag + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.TmplPage = {
    select: async function(tmplId) {
      var t = templates.find(function(x) { return x.id === tmplId; });
      if (!t) return;
      try {
        var res = await RF.api('POST', '/projects', {
          body: {
            title: t.name,
            type: 'short_video',
            status: 'draft',
            prompt: t.desc,
            description: '',
            meta: {
              make_mode: 'template',
              template_id: t.id,
              template_label: t.name,
              template_category: t.category,
              studio: t.studio,
              material_slots: {},
            },
          },
        });
        if (res.ok && res.data.project) {
          location.href = '/studio-template.html?id=' + res.data.project.id;
        } else {
          RF.toast((res.data && res.data.error) || '创建失败', 'err');
        }
      } catch (err) {
        RF.toast('网络异常，请重试', 'err');
      }
    }
  };

  // 分类标签切换
  document.querySelectorAll('.tmpl-cat-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tmpl-cat-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderTemplates(btn.dataset.cat);
    });
  });

  (async function init() {
    await ensureAuth();
    renderTemplates('all');
  })();
})();
