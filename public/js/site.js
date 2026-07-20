/* ===========================================================================
   ReelForge — 全站共享脚本（导航注入 / 认证态 / API 封装 / 提示）
   =========================================================================== */
(function () {
  const API_BASE = '/api';

  // ---------- DOM helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    try { const d = new Date(iso); return (d.getMonth()+1) + '/' + d.getDate(); }
    catch(e) { return iso || ''; }
  }

  // ---------- API ----------
  async function api(method, path, opts = {}) {
    const { body, auth = true } = opts;
    const headers = {};
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- Toast ----------
  function toast(msg, type = 'info') {
    let wrap = qs('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 3200);
  }

  // ---------- Auth state ----------
  let currentUser = null;
  let currentMembership = null;
  const PLAN_LABEL = { free: '免费', experience: '体验版', pro: '专业版', enterprise: '旗舰版' };
  async function refreshAuth() {
    const { ok, data } = await api('GET', '/auth/me', { auth: false });
    currentUser = ok ? data.user : null;
    currentMembership = currentUser && currentUser.membership ? currentUser.membership : null;
    paintAuth();
    return currentUser;
  }
  function paintAuth() {
    qsa('[data-auth]').forEach((el) => {
      const mode = el.getAttribute('data-auth'); // 'guest' | 'user'
      if (mode === 'guest') el.style.display = currentUser ? 'none' : '';
      if (mode === 'user') el.style.display = currentUser ? '' : 'none';
    });
    qsa('[data-membership]').forEach((el) => {
      if (!currentUser) { el.style.display = 'none'; return; }
      el.style.display = '';
      if (currentMembership && currentMembership.isActive) {
        el.className = 'member-badge ok';
        const planName = PLAN_LABEL[currentMembership.plan] || currentMembership.plan;
        const exp = currentMembership.expiresAt ? (' · ' + fmtDate(currentMembership.expiresAt)) : '';
        el.innerHTML = '<a href="/pricing.html" style="color:inherit;text-decoration:none">' + escapeHtml(planName + exp) + '</a>';
      } else {
        el.className = 'member-badge warn btn-like';
        el.innerHTML = '<a href="/pricing.html" style="color:inherit;text-decoration:none">开通会员</a>';
      }
    });
  }
  async function logout() {
    await api('POST', '/auth/logout', { auth: false });
    currentUser = null;
    toast('已退出登录', 'ok');
    setTimeout(() => (location.pathname = '/'), 500);
  }

  // ---------- Header / Footer ----------
  const NAV = [
    { href: '/', key: 'home', label: '首页' },
    { href: '/features.html', key: 'features', label: '能力' },
    { href: '/architecture.html', key: 'architecture', label: '工作流' },
    { href: '/pricing.html', key: 'pricing', label: '套餐' },
    { href: '/apikeys.html', key: 'apikeys', label: 'API 接入' },
    { href: '/docs.html', key: 'docs', label: '案例' },
    { href: '/about.html', key: 'about', label: '关于' },
  ];
  const LOGO = `<svg class="logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ReelForge">
    <rect width="32" height="32" rx="8" fill="url(#rf)"/>
    <path d="M12 9.5v13l11-6.5-11-6.5z" fill="#fff"/>
    <defs><linearGradient id="rf" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6d5efc"/><stop offset="1" stop-color="#d946a6"/></linearGradient></defs>
  </svg>`;

  function renderHeader(active) {
    const header = qs('header.site-header');
    if (!header) return;
    // 顶部导航不显示「API 接入」（仅出现在控制台左侧边栏）
    const topNav = NAV.filter((n) => n.key !== 'apikeys');
    const links = topNav.map((n) =>
      `<a href="${n.href}" class="${n.key === active ? 'active' : ''}">${n.label}</a>`
    ).join('');
    // 公共页面（首页/能力/工作流/套餐/案例/关于/联系）：不显示「控制台」和会员徽章
  const PUBLIC_PAGES = ['home', 'index', 'features', 'architecture', 'pricing', 'docs', 'about', 'contact', 'auth'];
  const isPublicPage = PUBLIC_PAGES.indexOf(active) !== -1;

  header.innerHTML = `
      <div class="container nav">
        <a class="brand" href="/">${LOGO}<span>ReelForge</span></a>
        <nav class="nav-links" id="navLinks">${links}</nav>
        <div class="nav-right">
          <a class="btn btn-ghost" href="/contact.html" data-auth="guest">联系我们</a>
          <a class="btn btn-ghost" href="/auth.html" data-auth="guest">登录</a>${isPublicPage ? '' : `
          <a class="btn btn-primary" id="consoleBtn" href="/dashboard.html" title="控制台">控制台</a>
          <span class="member-badge" data-membership></span>
          <a class="btn btn-primary" href="/auth.html#register" data-auth="guest">免费开始</a>`}
          <button class="nav-toggle" id="navToggle" aria-label="菜单">☰</button>
        </div>
      </div>`;
    const toggle = qs('#navToggle');
    if (toggle) toggle.addEventListener('click', () => qs('#navLinks').classList.toggle('open'));
  }

  // ---------- Console Sidebar（单一真源，所有控制台页共用） ----------
  const CONSOLE_SIDEBAR = [
    { key: 'projects', label: '视频项目', href: 'dashboard.html?tab=projects' },
    { key: 'templates', label: '模板项目', href: 'templates.html' },
    { key: 'assets', label: '我的资产', href: 'dashboard.html?tab=assets' },
    { key: 'agent', label: '智能装配', href: 'agent.html' },
    { key: 'apikeys', label: 'API 接入', href: 'apikeys.html' },
    { key: 'pricing', label: '会员套餐', href: 'pricing.html?from=console' },
  ];
  function getSidebarActive() {
    const path = location.pathname;
    if (path.endsWith('agent.html')) return 'agent';
    if (path.endsWith('apikeys.html')) return 'apikeys';
    if (path.endsWith('templates.html')) return 'templates';
    if (path.endsWith('dashboard.html')) {
      const t = new URLSearchParams(location.search).get('tab');
      if (t === 'templates' || t === 'assets' || t === 'projects') return t;
      return 'projects';
    }
    return '';
  }
  function renderSidebar(activeKey) {
    const aside = qs('aside.sidebar');
    if (!aside) return;
    const links = CONSOLE_SIDEBAR.map((item) =>
      '<a href="' + item.href + '" class="' + (item.key === activeKey ? 'active' : '') + '">' + item.label + '</a>'
    ).join('');
    aside.innerHTML =
      '<div class="sb-brand"><span style="color:var(--brand);font-weight:800">ReelForge</span></div>' +
      links +
      '<a href="#" id="logoutBtn">退出登录</a>';
    const lb = qs('#logoutBtn', aside);
    if (lb) lb.addEventListener('click', function (e) { e.preventDefault(); logout(); });
  }

  function renderFooter() {
    const footer = qs('footer.site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="brand" href="/">${LOGO}<span>ReelForge</span></a>
            <p style="margin-top:12px">ReelForge 是极简的 AI 视频生产 Agent：你只管提需求，Agent 自动完成从角色设定到成片交付的全流程。</p>
            <p style="margin-top:10px"><span class="pill">一句话出片</span> <span class="pill pill-line">全包交付</span></p>
          </div>
          <div>
            <h4>产品</h4>
            <a href="/features.html">核心能力</a>
            <a href="/architecture.html">Agent 工作流</a>
            <a href="/pricing.html">套餐方案</a>
            <a href="/docs.html">客户案例</a>
          </div>
          <div>
            <h4>客户</h4>
            <a href="/features.html#industries">适用行业</a>
            <a href="/architecture.html#quality">质量管控</a>
            <a href="/about.html">关于 ReelForge</a>
            <a href="/contact.html">联系我们</a>
          </div>
          <div>
            <h4>开始使用</h4>
            <a href="/auth.html#register">开始制作</a>
            <a href="/dashboard.html" data-console-gate>演示控制台</a>
            <a href="/contact.html">商务合作</a>
            <a href="/about.html">加入我们</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ReelForge · 极简的 AI 视频生产 Agent</span>
          <span>本站为演示站点 · 后端 API 与数据库均为真实可用</span>
        </div>
      </div>`;
  }

  // ---------- Init ----------
  function initSite(active) {
    renderHeader(active);
    renderFooter();
    renderSidebar(getSidebarActive());
    refreshAuth();
    const toggle = qs('#navToggle');
    if (toggle) toggle.addEventListener('click', () => qs('#navLinks') && qs('#navLinks').classList.toggle('open'));

    // 进入控制台需登录：未登录点击「控制台 / 演示控制台」跳转登录页
    document.addEventListener('click', function (e) {
      var target = e.target.closest('#consoleBtn, [data-console-gate]');
      if (!target) return;
      if (!currentUser) {
        e.preventDefault();
        location.href = '/auth.html';
      }
    });
  }

  // ---------- Icons ----------
  const ICONS = {
    gateway: '<path d="M4 12h16M14 7l5 5-5 5M10 7l-5 5 5 5" />',
    flow: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><path d="M10 7.5h4a3 3 0 0 1 3 3V13"/>',
    script: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 11h6M9 15h6"/>',
    queue: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    assets: '<path d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"/>',
    locale: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    observe: '<path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/>',
    opensource: '<path d="M12 3a9 9 0 0 0-3 17.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.300000-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.7.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.6.9.6 1.9v2.8c0 .3.2.6.7.5A9 9 0 0 0 12 3z"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    bolt: '<path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.5-2-4.5-5-5"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  };
  function icon(name, cls = 'feature-icon') {
    const p = ICONS[name] || ICONS.bolt;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  // expose
  window.ReelForge = { api, toast, logout, refreshAuth, escapeHtml, initSite, icon, LOGO, getMembership: () => currentMembership };
  document.addEventListener('DOMContentLoaded', () => {
    const active = document.body.getAttribute('data-page');
    if (active) initSite(active);
  });
})();
