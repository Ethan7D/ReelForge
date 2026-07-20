/* ===========================================================================
   ReelForge — 专属视频工作台（需要登录，按 ?id 加载项目）
   阶段：需求分析 → 剧本 → 人物主题 → 分镜 → 视频制作
   工作台状态持久化在项目 meta.studio 中。

   一键生成模式（quick）：第一步填写需求 + 为每一步选择大模型，点「开始一键生成」
   后由 Agent 自动跑完后续全部流程，过程中可随时暂停并修改任意步骤细节。
   （系统仅保留此一种制作模式。）
   =========================================================================== */
(function () {
  const RF = window.ReelForge;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => RF.escapeHtml(s);

  let proj = null;
  let studio = null;
  let currentStep = 0;
  let mode = 'quick';

  const STEP_LABEL = ['', '剧本', '人物主题', '分镜', '视频制作'];
  const STEP_KEY = ['', 'script', 'characters', 'storyboard', 'production'];
  const STEP_DEFAULT = {
    script: 'claude-3-5-sonnet',
    characters: 'qwen-vl-max',
    storyboard: 'gemini-1.5-pro',
    production: 'kling-v1',
  };
  const STEP_DELAY = 1100;

  // 第一步需求字段 schema：控件 id <-> studio.requirement 路径（单向绑定驱动）
  const REQ_FIELDS = [
    { el: 'reqText', path: 'text' },
    { el: 'reqTone', path: 'tone' },
    { el: 'reqAud', path: 'audience' },
    { el: 'reqParsed', path: 'parsed' },
    { el: 'reqDuration', path: 'duration' },
    { el: 'reqRatio', path: 'ratio' },
    { el: 'reqSubtitle', path: 'subtitle' },
    { el: 'reqMood', path: 'mood' },
    { el: 'reqVoice', path: 'voice' },
    { el: 'reqMusic', path: 'music' },
    { el: 'reqReference', path: 'reference' },
    { el: 'reqSelling', path: 'selling' },
    { el: 'reqMust', path: 'mustHave' },
    { el: 'reqAvoid', path: 'avoid' },
  ];

  // 景别 / 运动 / 角度选项
  const SHOT_SIZES = ['大特写', '特写', '近景', '中景', '全景', '远景', '大远景'];
  const MOVEMENTS = ['固定', '推', '拉', '摇', '移', '跟', '升', '降', '俯仰', '环绕'];
  const ANGLES = ['平拍', '俯拍', '仰拍', '鸟瞰', '倾斜'];

  // 模型级别能力覆盖（用于工作台按步骤精确筛选）
  // 不在映射中的模型默认继承供应商 caps；tag 含义: text/脚本, image/图片, video/视频
  // 键使用 slug 格式（全小写，空格/特殊符→连字符）
  const MODEL_CAPS = {
    // OpenAI
    'gpt-4o': ['text'], 'gpt-4.1': ['text'], 'gpt-4.1-mini': ['text'],
    'o1': ['text'], 'o3-mini': ['text'], 'dall-e-3': ['image'],
    // Anthropic / Mistral / xAI: 纯文本
    'claude-4-sonnet': ['text'], 'claude-3.5-sonnet': ['text'], 'claude-3-opus': ['text'],
    'mistral-large': ['text'], 'codestral': ['text'], 'pixtral-12b': ['text'],
    'grok-3': ['text'], 'grok-2': ['text'],
    // Google
    'gemini-2.5-pro': ['text','image'], 'gemini-2.0-flash': ['text','image'],
    'gemma-3': ['text'],
    // DeepSeek / Kimi / 讯飞星火
    'deepseek-v3': ['text'], 'deepseek-r1': ['text'],
    'deepseek-v3.2': ['text'], 'coder-v2': ['text'],
    'kimi-k2.5': ['text'], 'kimi-k2': ['text'],
    'moonshot-v1-128k': ['text'], 'moonshot-v1-auto': ['text'],
    'spark-lite': ['text'], 'spark-pro': ['text'], 'spark-max': ['text'],
    'spark-4.0-ultra': ['text'],
    // 阿里云·通义
    'qwen-max': ['text'], 'qwen-plus': ['text'], 'qwen-vl-max': ['text'],
    'qwen3-235b-a22b': ['text'],
    'wanx2.1': ['image'], 'wanx-v1': ['image'],
    'wanx2.1-t2v-turbo': ['video'], 'wanx2.1-i2v-turbo': ['video'],
    // 智谱
    'glm-5': ['text'], 'glm-4-plus': ['text'],
    'glm-4v': ['text'], 'glm-4.7-flash': ['text'], 'cogview-4': ['image'],
    // 豆包
    'doubao-pro-32k': ['text','image','video'], 'doubao-lite-32k': ['text'],
    'doubao-seed-1.6': ['text','image'],
    // 百度千帆
    'ernie-4.0': ['text','image'], 'ernie-speed': ['text'],
    'ernie-lite': ['text'], 'ernie-3.5': ['text'],
    // MiniMax
    'minimax-text-01': ['text'], 'abab-6.5s-chat': ['text'],
    // 腾讯混元
    'hunyuan-pro': ['text','image'], 'hunyuan-lite': ['text'], 'hunyuan-vision': ['text'],
    // 视频厂商
    'kling-v3': ['video'], 'kling-v2.6': ['video'], 'kling-v1': ['video'],
    'kling-video-o1': ['video'],
    'jimeng-v1': ['video'], 'runway-gen-4': ['video'], 'runway-gen-3-turbo': ['video'],
    'vidu-1': ['video'], 'vidu-1.5': ['video'],
  };

  /** 将模型名转换为 slug 用于 caps 匹配（全小写，所有特殊符→连字符） */
  function slugModelId(raw) {
    return raw
      .replace(/[^a-z0-9\.]/gi, '-') // 非字母数字全部替换为连字符
      .replace(/-+/g, '-')            // 合并连续连字符
      .replace(/^-|-$/g, '')          // 去掉首尾连字符
      .toLowerCase();
  }

  // 模型目录（通用模型库 + 用户已接入的 API）
  const PROV_LABEL = {
    openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', mistral: 'Mistral', xai: 'xAI',
    deepseek: 'DeepSeek', qwen: '阿里云-通义', zhipu: '智谱', moonshot: 'Kimi',
    doubao: '豆包', baidu: '百度千帆', minimax: 'MiniMax', tencent: '腾讯混元', spark: '讯飞星火',
    kling: '可灵', jimeng: '即梦',
    runway: 'Runway', vidu: 'Vidu', siliconflow: '硅基流动', openrouter: 'OpenRouter', custom: '自定义',
  };
  // 模型 ID → 显示名（中文 + 英文）
  const MODEL_DISPLAY = {
    // OpenAI
    'gpt-4o': 'GPT‑4o', 'gpt-4.1': 'GPT‑4.1', 'gpt-4.1-mini': 'GPT‑4.1 Mini',
    'dall-e-3': 'DALL·E 3', 'o1': 'o1', 'o3-mini': 'o3‑mini',
    // Anthropic
    'claude-4-sonnet': 'Claude 4 Sonnet', 'claude-3-5-sonnet': 'Claude 3.5 Sonnet', 'claude-3-opus': 'Claude 3 Opus',
    // Google
    'gemini-2.5-pro': 'Gemini 2.5 Pro', 'gemini-2.0-flash': 'Gemini 2.0 Flash', 'gemma-3': 'Gemma 3',
    // DeepSeek
    'deepseek-v3': 'DeepSeek‑V3', 'deepseek-r1': 'DeepSeek‑R1',
    'deepseek-chat': 'DeepSeek Chat', 'deepseek-reasoner': 'DeepSeek Reasoner',
    // 通义
    'qwen-max': '通义千问 Max', 'qwen-plus': '通义千问 Plus', 'qwen-vl-max': '通义千问 VL‑Max',
    // 智谱
    'glm-5': 'GLM‑5', 'glm-4-plus': 'GLM‑4 Plus', 'glm-4v': 'GLM‑4V', 'glm-4.7-flash': 'GLM‑4.7‑Flash',
    // Kimi
    'kimi-k2.5': 'Kimi K2.5', 'kimi-k2': 'Kimi K2',
    // 豆包
    'doubao-pro-32k': 'Doubao Pro 32K', 'doubao-lite-32k': 'Doubao Lite 32K',
    // 百度
    'ernie-4.0': 'ERNIE 4.0', 'ernie-speed': 'ERNIE Speed', 'ernie-lite': 'ERNIE Lite',
    // 视频
    'kling-v3': '可灵 v3', 'kling-v2.6': '可灵 v2.6', 'kling-v1': '可灵 v1',
    'jimeng-v1': '即梦 v1', 'runway-gen-4': 'Runway Gen‑4', 'vidu-1': 'Vidu‑1',
    'wanx2.1-t2v-turbo': '万相 t2v', 'wanx2.1-i2v-turbo': '万相 i2v',
    // Mistral / xAI
    'mistral-large': 'Mistral Large', 'grok-3': 'Grok 3',
  };
  function modelName(m) { return MODEL_DISPLAY[m] || m; }
  // 供应商与模型列表统一来自 providers.js（window.ReelForgeProviders），
  // 与「API 接入」页共用同一份真源，下拉据此渲染已接入/未接入状态。

  /* ================================================================
     工作台联动模型表：{ 模式 → { 供应商id → { name, icon, desc, models[] } } }
     左侧选模式+子模式 → 右侧显示对应供应商tab → 选供应商后显示模型版本
     ================================================================ */
  const MPM = {
    // ===== 图片生成 =====
    text2img: {
      jimeng:  { name: '即梦', icon: '🚀', desc: '精准控制画面细节，生成自然、图片排版、色彩更和谐',
                 models: [{ id:'seedream-5.0-pro', name:'Seedream 5.0 Pro', def:true },{ id:'seedream-5.0-lite', name:'Seedream 5.0 Lite' },{ id:'seedream-4.5', name:'Seedream 4.5' },{ id:'seedream-4.0', name:'Seedream 4.0' }] },
      kling:   { name: '可灵', icon: '🌀', desc: '基础图像生成成高阶细节编辑，全链路无感衔接',
                 models: [{ id:'kling-o1', name:'可灵 O1', def:true }] },
      qizhi:   { name: '寄智', icon: '🧠', desc: '极速出图，文本渲染效果更好，更强一致性',
                 models: [{ id:'inb-2', name:'INB 2（测试版）' },{ id:'inbp', name:'INBP（测试版）' },{ id:'igi-2', name:'IGI 2（测试版）' },{ id:'imj-8', name:'IMJ 8' },{ id:'imj-7', name:'IMJ 7', def:true }] },
    },
    imgblend: {
      jimeng:  { name: '即梦', icon: '🚀', desc: '精准控制画面细节，生成自然、图片排版、色彩更和谐',
                 models: [{ id:'seedream-5.0-pro', name:'Seedream 5.0 Pro', def:true },{ id:'seedream-5.0-lite', name:'Seedream 5.0 Lite' },{ id:'seedream-4.5', name:'Seedream 4.5' },{ id:'seedream-4.0', name:'Seedream 4.0' }] },
      kling:   { name: '可灵', icon: '🌀', desc: '基础图像生成成高阶细节编辑，全链路无感衔接',
                 models: [{ id:'kling-o1', name:'可灵 O1', def:true }] },
      qizhi:   { name: '寄智', icon: '🧠', desc: '极速出图，文本渲染效果更好，更强一致性',
                 models: [{ id:'inb-2', name:'INB 2（测试版）' },{ id:'inbp', name:'INBP（测试版）' },{ id:'igi-2', name:'IGI 2（测试版）' },{ id:'imj-8', name:'IMJ 8' },{ id:'imj-7', name:'IMJ 7', def:true }] },
    },

    // ===== 视频生成：文生视频 / 首尾帧 =====
    'vid-text': {
      jimeng:     { name: '即梦', icon: '🚀', desc: '音画同步', models: [{ id:'seedance-2.0', name:'Seedance 2.0', def:true },{ id:'seedance-2.0-fast', name:'Seedance 2.0 Fast' },{ id:'seedance-2.0-mini', name:'Seedance 2.0 Mini' },{ id:'seedance-1.5-pro', name:'Seedance 1.5 Pro' }] },
      kling:      { name: '可灵', icon: '🌀', desc: '可灵最新大模型，支持多模态输入', models: [{ id:'kling-3.0-omni', name:'可灵 3.0 Omni', def:true },{ id:'kling-3.0', name:'可灵 3.0' },{ id:'kling-2.6', name:'可灵 2.6' },{ id:'kling-o1', name:'可灵 O1' },{ id:'kling-2.5', name:'可灵 2.5' }] },
      happyhorse: { name: 'Happy Horse', icon: '🐴', desc: '阿里最新大模型，已支持真人图片及视频', models: [{ id:'hh-1.1', name:'Happy Horse 1.1', def:true },{ id:'hh-1.0', name:'Happy Horse 1.0' }] },
      vidu:       { name: 'Vidu', icon: '🎬', desc: '支持视频分镜', models: [{ id:'vidu-q3', name:'Vidu Q3', def:true },{ id:'vidu-q2', name:'Vidu Q2' }] },
      hailuo:     { name: '海螺', icon: '🐚', desc: '动作表现力最佳', models: [{ id:'hailuo-2.3', name:'海螺 2.3', def:true },{ id:'hailuo-2.0', name:'海螺 2.0' }] },
      tongyi:     { name: '通义', icon: '☁️', desc: '支持生成多镜头视频', models: [{ id:'wan-2.6', name:'Wan 2.6', def:true }] },
      qizhi:      { name: '寄智', icon: '🧠', desc: '指令理解强，镜头调度稳定', models: [{ id:'vgof', name:'VGOF（测试版）' },{ id:'vv-3.1', name:'VV 3.1（测试版）' },{ id:'vs', name:'VS（测试版）', def:true }] },
    },
    'vid-headtail': {
      jimeng:     { name: '即梦', icon: '🚀', desc: '音画同步', models: [{ id:'seedance-2.0', name:'Seedance 2.0', def:true },{ id:'seedance-2.0-fast', name:'Seedance 2.0 Fast' },{ id:'seedance-2.0-mini', name:'Seedance 2.0 Mini' },{ id:'seedance-1.5-pro', name:'Seedance 1.5 Pro' }] },
      kling:      { name: '可灵', icon: '🌀', desc: '首画同步', models: [{ id:'kling-3.0-omni', name:'可灵 3.0 Omni', def:true },{ id:'kling-3.0', name:'可灵 3.0' },{ id:'kling-2.6', name:'可灵 2.6' },{ id:'kling-o1', name:'可灵 O1' },{ id:'kling-2.5', name:'可灵 2.5' }] },
      happyhorse: { name: 'Happy Horse', icon: '🐴', desc: '阿里最新大模型，已支持真人图片及视频', models: [{ id:'hh-1.1', name:'Happy Horse 1.1', def:true },{ id:'hh-1.0', name:'Happy Horse 1.0' }] },
      vidu:       { name: 'Vidu', icon: '🎬', desc: '支持视频分镜', models: [{ id:'vidu-q3', name:'Vidu Q3', def:true },{ id:'vidu-q2', name:'Vidu Q2' }] },
      hailuo:     { name: '海螺', icon: '🐚', desc: '动作表现力最佳', models: [{ id:'hailuo-2.3', name:'海螺 2.3', def:true },{ id:'hailuo-2.0', name:'海螺 2.0' }] },
      tongyi:     { name: '通义', icon: '☁️', desc: '支持生成多镜头视频', models: [{ id:'wan-2.6', name:'Wan 2.6', def:true }] },
      qizhi:      { name: '寄智', icon: '🧠', desc: '音画同步', models: [{ id:'vgof', name:'VGOF（测试版）' },{ id:'vv-3.1', name:'VV 3.1（测试版）' },{ id:'vs', name:'VS（测试版）', def:true }] },
    },

    // ===== 视频生成：多参考 =====
    'vid-ref': {
      jimeng:     { name: '即梦', icon: '🚀', desc: '音画同步', models: [{ id:'seedance-2.0', name:'Seedance 2.0', def:true },{ id:'seedance-2.0-fast', name:'Seedance 2.0 Fast' },{ id:'seedance-2.0-mini', name:'Seedance 2.0 Mini' },{ id:'seedance-1.5-pro', name:'Seedance 1.5 Pro' }] },
      kling:      { name: '可灵', icon: '🌀', desc: '音画同步', models: [{ id:'kling-o1', name:'可灵 O1', def:true }] },
      happyhorse: { name: 'Happy Horse', icon: '🐴', desc: '阿里最新大模型，支持智能多模', models: [{ id:'hh-1.1', name:'Happy Horse 1.1', def:true },{ id:'hh-1.0', name:'Happy Horse 1.0' }] },
      vidu:       { name: 'Vidu', icon: '🎬', desc: '', models: [{ id:'vidu-q3', name:'Vidu Q3', def:true },{ id:'vidu-q2', name:'Vidu Q2' }] },
      hailuo:     { name: '海螺', icon: '🐚', desc: '', models: [{ id:'hailuo-2.3', name:'海螺 2.3', def:true },{ id:'hailuo-2.0', name:'海螺 2.0' }] },
      tongyi:     { name: '通义', icon: '☁️', desc: '支持生成多镜头视频', models: [{ id:'wan-2.6', name:'Wan 2.6', def:true }] },
      qizhi:      { name: '寄智', icon: '🧠', desc: '', models: [{ id:'vgof', name:'VGOF（测试版）' },{ id:'vv-3.1', name:'VV 3.1（测试版）' },{ id:'vs', name:'VS（测试版）', def:true }] },
    },

    // ===== 视频生成：动作控制 =====
    'vid-motion': {
      kling: { name: '可灵', icon: '🌀', desc: '高性价比动作控制', models: [{ id:'kling-3.0', name:'可灵 3.0', def:true },{ id:'kling-2.6', name:'可灵 2.6' }] },
    },

    // ===== 人物主题工作台：人物参图 =====
    'char-img': {
      jimeng: { name: '即梦', icon: '🚀', desc: '', models: [{ id:'seedream-5.0-pro', name:'Seedream 5.0 Pro', def:true },{ id:'seedream-5.0-lite', name:'Seedream 5.0 Lite' },{ id:'seedream-4.5', name:'Seedream 4.5' },{ id:'seedream-4.0', name:'Seedream 4.0' }] },
      kling:  { name: '可灵', icon: '🌀', desc: '', models: [{ id:'kling-o1', name:'可灵 O1', def:true }] },
      qizhi:  { name: '寄智', icon: '🧠', desc: '', models: [{ id:'inb-2', name:'INB 2（测试版）' },{ id:'imj-8', name:'IMJ 8' },{ id:'imj-7', name:'IMJ 7', def:true }] },
    },

    // ===== 人物主题工作台：动作参考视频 =====
    'char-video': {
      kling: { name: '可灵', icon: '🌀', desc: '高性价比动作控制', models: [{ id:'kling-3.0', name:'可灵 3.0', def:true },{ id:'kling-2.6', name:'可灵 2.6' }] },
    },

    // ===== 配音生成：台词配音 =====
    'voice-dub': {
      qizhi: { name: '寄智', icon: '🧠', desc: '情感表达自然，台词配音与音色转换二合一',
               models: [{ id:'qisheng-omni', name:'奇声 Omni', def:true }] },
    },

    // ===== 配音生成：音色转换（含性转优化+音调调整额外选项）=====
    'voice-clone': {
      qizhi: { name: '寄智', icon: '🧠', desc: '情感表达自然，台词配音与音色转换二合一',
               models: [{ id:'qisheng-omni', name:'奇声 Omni', def:true }] },
    },

    // ===== 音乐制作：文生音乐 =====
    'music-text': {
      qizhi: { name: '寄智', icon: '🧠', desc: '人声自然、风格多样性丰富，高保真音质',
               models: [{ id:'qizhi-ms-5.0', name:'寄智 MS 5.0（测试版）', def:true }] },
    },

    // ===== 音乐制作：音乐翻唱 =====
    'music-cover': {
      qizhi: { name: '寄智', icon: '🧠', desc: '人声自然、风格多样性丰富，高保真音质',
               models: [{ id:'qizhi-ms-5.0', name:'寄智-MS 5.0（测试版）', def:true }] },
    },
  };

  // ===== 工作台模型选择器与「API 接入页」联动 =====
  // 人物工作台(char-img) / 素材工作台(text2img / vid-*) 的模型芯片，
  // 不再使用写死的 MPM，而是从已接入的 API（AVAILABLE_MODELS）动态生成，
  // 保证「工作台选模型」与「API 接入页」永远一致。
  const SYNCED_MODES = new Set(['char-img', 'text2img', 'imgblend', 'vid-text', 'vid-headtail', 'vid-ref', 'vid-motion']);
  const MODE_CAP_BY_SYNC = {
    'char-img': 'image', 'text2img': 'image', 'imgblend': 'image',
    'vid-text': 'video', 'vid-headtail': 'video', 'vid-ref': 'video', 'vid-motion': 'video',
  };
  let DYNAMIC_MPM = {}; // mode -> { providerId: { name, icon, desc, models:[{id,name,def}] } }

  /** 根据已接入的 API 构建同步用 MPM（与 API 接入页一致） */
  function buildDynamicMPM() {
    DYNAMIC_MPM = {};
    if (!HAS_ANY_CONNECTED || !AVAILABLE_MODELS.length) return;
    Object.keys(MODE_CAP_BY_SYNC).forEach(function (mode) {
      var cap = MODE_CAP_BY_SYNC[mode];
      var byProv = {};
      AVAILABLE_MODELS.forEach(function (m) {
        if (!m.caps.includes(cap)) return;
        if (!byProv[m.provider]) {
          var p = (window.ReelForgeProviders || []).find(function (x) { return x.id === m.provider; });
          byProv[m.provider] = {
            name: p ? p.label : m.provider,
            icon: p ? (p.icon || '🧩') : '🧩',
            desc: '已接入模型 · ' + (p ? p.label : m.provider),
            models: [],
          };
        }
        byProv[m.provider].models.push({ id: m.value, name: m.model, def: byProv[m.provider].models.length === 0 });
      });
      if (Object.keys(byProv).length) DYNAMIC_MPM[mode] = byProv;
    });
  }

  /** 根据模式和当前选中供应商获取模型列表（优先用同步数据） */
  function getMPMModels(mode, providerId) {
    if (DYNAMIC_MPM[mode] && DYNAMIC_MPM[mode][providerId]) return DYNAMIC_MPM[mode][providerId].models;
    var entry = MPM[mode];
    if (!entry) return [];
    var prov = entry[providerId];
    if (!prov) return [];
    return prov.models;
  }

  /** 获取某模式下的所有供应商列表（已接入同步模式优先） */
  function getMPMProviders(mode) {
    if (SYNCED_MODES.has(mode)) {
      if (!HAS_ANY_CONNECTED) return [];                       // 完全未接入 → 引导去接入
      if (DYNAMIC_MPM[mode]) return Object.keys(DYNAMIC_MPM[mode]).map(function (pid) { return Object.assign({ id: pid }, DYNAMIC_MPM[mode][pid]); });
      return [];                                               // 已接入但无对应能力模型
    }
    var entry = MPM[mode];
    if (!entry) return [];
    return Object.keys(entry).map(function(pid) { return Object.assign({ id: pid }, entry[pid]); });
  }

  // 图片生成模型列表（人物主题工作台使用——保留向后兼容）
  const IMAGE_MODEL_LIST = [
    { id: 'seedream-5.0-lite', name: 'Seedream 5.0 Lite', icon: 'S', type: 'img', tag: '已接入', tagType: 'connected', price: '' },
    { id: 'seedream-2.0', name: 'Seedream 2.0', icon: 'S', type: 'img', tag: '已接入', tagType: 'connected', price: '', default: true },
    { id: 'cogview-3-plus', name: 'CogView-3-Plus', icon: 'C', type: 'img', tag: '已接入', tagType: 'connected', price: '' },
    { id: 'dall-e-3', name: 'DALL-E 3', icon: 'D', type: 'img', tag: '未接入', tagType: 'unconn', price: '' },
  ];

  // 视频/图片生成模型列表（素材工作台/第四步使用）
  const VIDEO_MODEL_LIST = [
    { id: 'seedance-2.0', name: 'Seedance 2.0', icon: '🎬', type: 'video', tag: '稳定版', tagType: 'promo', price: '' },
    { id: 'seedance-2.0-fast', name: 'Seedance 2.0 Fast', icon: '🎬', type: 'video', tag: '快速', tagType: 'promo', price: '' },
    { id: 'seedance-2.0-mini', name: 'Seedance 2.0 Mini', icon: '🎬', type: 'video', tag: '轻量', tagType: 'promo', price: '' },
    { id: 'seedance-1.5-pro', name: 'Seedance 1.5 Pro', icon: '🎬', type: 'video', tag: '已接入', tagType: 'connected', price: '', default: true },
    { id: 'kling-v1', name: 'Kling v1', icon: 'K', type: 'video', tag: '可灵', tagType: 'unconn', price: '' },
    { id: 'kling-v1-6', name: 'Kling v1.6', icon: 'K', type: 'video', tag: '可灵', tagType: 'unconn', price: '' },
    { id: 'vidu-1.0', name: 'Vidu 1.0', icon: 'V', type: 'video', tag: '', tagType: '', price: '' },
    { id: 'hailuo-1.0', name: '海螺 1.0', icon: 'H', type: 'video', tag: '', tagType: '', price: '' },
    { id: 'tongyi-video', name: '通义视频', icon: 'T', type: 'video', tag: '', tagType: '', price: '' },
  ];

  // 分镜镜头演示画面配色（第5步逐镜展示与合并预览使用）
  const SHOT_PALETTE = [
    ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#22d3ee'], ['#10b981', '#34d399'],
    ['#f59e0b', '#f97316'], ['#ec4899', '#f43f5e'], ['#14b8a6', '#06b6d4'],
    ['#8b5cf6', '#d946ef'], ['#f43f5e', '#fb7185'], ['#0d9488', '#2dd4bf'],
    ['#3b82f6', '#6366f1'],
  ];

  /** 渲染模型列表选择器 */
  function renderModelList(listId, models, selectedId) {
    const list = $(listId);
    if (!list) return;
    list.innerHTML = models.map(m => {
      const sel = m.id === selectedId ? ' selected' : '';
      const typeClass = m.type === 'video' ? ' video-model' : m.type === 'text' ? ' text-model' : ' img-model';
      const tagHtml = m.tag ? '<span class="mi-tag mi-tag-' + m.tagType + '">' + m.tag + '</span>' : '';
      const priceHtml = m.price ? '<span class="mi-price">' + m.price + '</span>' : '';
      return '<div class="model-item' + sel + '" data-model-id="' + m.id + '">' +
        '<span class="mi-icon' + typeClass + '">' + m.icon + '</span>' +
        '<span class="mi-name">' + m.name + '</span>' +
        tagHtml + priceHtml +
        '</div>';
    }).join('');
    // 点击选择
    list.querySelectorAll('.model-item').forEach(item => {
      item.addEventListener('click', () => {
        list.querySelectorAll('.model-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        // 触发回调：更新摘要标签等
        const evt = new CustomEvent('modelselect', { detail: { id: item.dataset.modelId, name: item.querySelector('.mi-name').textContent } });
        list.dispatchEvent(evt);
      });
    });
  }

  /** 获取模型列表当前选中项的名称 */
  function getSelectedModelName(listId) {
    const list = $(listId);
    if (!list) return null;
    const sel = list.querySelector('.model-item.selected');
    return sel ? sel.querySelector('.mi-name').textContent.trim() : null;
  }
  let CONNECTED_PROVIDERS = {};  // 真实已接入供应商（来自「API 接入」配置），供模型下拉与提醒文案使用

  // 生成任务状态机：与 DOM 解耦，UI 通过订阅渲染（将来接后端时仅把驱动源从本地定时器换成轮询）
  const auto = { timer: null, step: 1 }; // timer 仅作计时句柄；step 记录当前执行步
  function createTaskStore() {
    let state = { status: 'idle', step: 0, progress: 0, label: '', error: null, paused: false };
    const subs = new Set();
    return {
      get: () => state,
      set(patch) { state = Object.assign({}, state, patch); subs.forEach((fn) => fn(state)); },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    };
  }
  const taskStore = createTaskStore();

  function blankStudio() {
    return {
      requirement: {
        text: '', tone: '', audience: '', parsed: '',
        duration: '', ratio: '', subtitle: '', platforms: [],
        mood: '', voice: '', music: '', reference: '',
        selling: '', mustHave: '', avoid: '',
      },
      script: '',
      scriptMode: 'gen', // gen | write | upload
      characters: [],
      scenes: [],
      props: [],
      storyboard: [],
      production: { status: 'idle', style: '', note: '' },
      models: { script: '', characters: '', storyboard: '', production: '' },
      generated: { 1: false, 2: false, 3: false, 4: false },
    };
  }

  function mergeStudio(loaded) {
    const b = blankStudio();
    if (!loaded) return b;
    return {
      requirement: Object.assign(b.requirement, loaded.requirement || {}),
      script: loaded.script || '',
      scriptMode: loaded.scriptMode || 'gen',
      characters: Array.isArray(loaded.characters) ? loaded.characters : [],
      scenes: Array.isArray(loaded.scenes) ? loaded.scenes : [],
      props: Array.isArray(loaded.props) ? loaded.props : [],
      storyboard: Array.isArray(loaded.storyboard) ? loaded.storyboard : [],
      production: Object.assign(b.production, loaded.production || {}),
      models: Object.assign(b.models, loaded.models || {}),
      generated: Object.assign(b.generated, loaded.generated || {}),
    };
  }

  async function ensureAuth() {
    const user = await RF.refreshAuth();
    if (!user) { location.href = '/auth.html'; return false; }
    return true;
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // ---------- 模型目录（已接入优先设计） ----------
  // 设计原则：下拉只展示已接入的可用模型；未接入时显示引导卡片跳转配置页

  /** @type {Array<{provider:string,name:string,model:string,label:string,value:string}>} 已接入的可用模型扁平列表 */
  let AVAILABLE_MODELS = [];
  let HAS_ANY_CONNECTED = false;

  async function loadModelCatalog() {
    const PROV = (window.ReelForgeProviders || []).slice();
    let connected = {};
    try {
      const { ok, data } = await RF.api('GET', '/apikeys');
      if (ok && data.keys && data.keys.length) {
        data.keys.forEach((k) => { connected[k.provider] = k; });
      }
    } catch (_) { connected = {}; }

    HAS_ANY_CONNECTED = Object.keys(connected).length > 0;

    // 只收集已接入供应商的模型 → 扁平化列表（含能力标签）
    AVAILABLE_MODELS = [];
    PROV.forEach((p) => {
      if (!connected[p.id]) return;
      const pCaps = p.caps || ['text']; // 供应商级能力（并集）
      const models = String(p.models || '').split(',').map((s) => s.trim()).filter(Boolean);
      models.forEach((m) => {
        const mNorm = m.replace(/[\u2010-\u2015]/g, '-'); // normalize all hyphen variants (API name)
        const mSlug = slugModelId(mNorm);          // slug for caps lookup
        const modelCaps = MODEL_CAPS[mSlug] || pCaps;
        AVAILABLE_MODELS.push({
          provider: p.id,
          name: p.label,
          model: mNorm,
          caps: modelCaps,
          label: mNorm + ' · ' + p.label,
          value: p.id + '::' + mNorm,
        });
      });
    });

    CONNECTED_PROVIDERS = connected;
    buildDynamicMPM(); // 与「API 接入页」联动：用已接入模型重建工作台模型选择器
  }

  function ensureModelDefaults() {
    ['script', 'characters', 'storyboard', 'production'].forEach((k) => {
      if (!studio.models[k]) {
        const first = AVAILABLE_MODELS[0];
        studio.models[k] = first ? first.value : STEP_DEFAULT[k];
      }
    });
  }

  /**
   * 填充模型下拉框。
   * 有已接入 → 平铺「模型名 · 供应商」列表
   * 无已接入 → 显示禁用 option + 点击跳配置页
   */
  function setModelSelect(id, key) {
    const val = studio.models[key] || '';
    const el = $(id);
    if (!el) return;

    if (AVAILABLE_MODELS.length === 0) {
      el.innerHTML = '<option value="" selected disabled>🔌 请先接入大模型 API</option>';
      el.disabled = true;
      el.style.opacity = '0.6';
      el.style.cursor = 'not-allowed';
      el.onclick = function () {
        if (window.RF && RF.toast) RF.toast('请先在「API 接入」页面配置至少一个大模型的 API 密钥', 'warn');
        setTimeout(() => { location.href = 'apikeys.html'; }, 600);
      };
      return;
    }

    el.disabled = false;
    el.style.opacity = '';
    el.style.cursor = '';
    el.onclick = null;

    // 按步骤类型过滤（视频制作步骤优先展示视频模型）
    const stepModels = filterModelsForStep(key, AVAILABLE_MODELS);
    let html = '<option value="" disabled>选择模型 ↓</option>';
    stepModels.forEach((m) => {
      html += '<option value="' + esc(m.value) + '"' + (m.value === val ? ' selected' : '') + '>' + esc(m.label) + '</option>';
    });

    if (val && !stepModels.some(m => m.value === val)) {
      html = '<option value="' + esc(val) + '" selected>' + esc(modelName(val)) + '（当前）</option>' + html;
    }
    el.innerHTML = html;
    if (val && stepModels.some(m => m.value === val)) el.value = val;
  }

  /** 按步骤类型过滤模型：script=文本, characters/storyboard=文本/图片, production=视频 */
  function filterModelsForStep(stepKey, allModels) {
    if (stepKey === 'script')       return allModels.filter(m => m.caps.includes('text'));
    if (stepKey === 'characters')   return allModels.filter(m => m.caps.includes('text') || m.caps.includes('image'));
    if (stepKey === 'storyboard')   return allModels.filter(m => m.caps.includes('text') || m.caps.includes('image'));
    if (stepKey === 'production')   return allModels.filter(m => m.caps.includes('video'));
    return allModels;
  }

  /** 绑定模型下拉双向同步：主选择器 ↔ 每步独立选择器 */
  function bindModelSync() {
    const pairs = [
      ['mScriptQ', 'stepMScript'],
      ['mChars',   'stepMChars'],
      ['mBoard',   'stepMBoard'],
      ['mProd',    'stepMProd'],
    ];
    pairs.forEach(function (pair) {
      const [mainId, stepId] = pair;
      const mainEl = $(mainId);
      const stepEl = $(stepId);
      if (!mainEl || !stepEl) return;
      mainEl.addEventListener('change', function () {
        if (stepEl.value !== mainEl.value) stepEl.value = mainEl.value;
      });
      stepEl.addEventListener('change', function () {
        if (mainEl.value !== stepEl.value) mainEl.value = stepEl.value;
      });
    });
  }

  // 填充下拉框（用于分镜表格中的 select）
  function buildSelect(options, current) {
    return options.map((o) => `<option value="${o}" ${o === current ? 'selected' : ''}>${esc(o)}</option>`).join('');
  }

  // ---------- 渲染 ----------

  function fillDom() {
    $('reqText').value = studio.requirement.text || '';
    $('reqTone').value = studio.requirement.tone || '';
    $('reqAud').value = studio.requirement.audience || '';
    $('reqParsed').value = studio.requirement.parsed || '';
    $('reqDuration').value = studio.requirement.duration || '';
    $('reqRatio').value = studio.requirement.ratio || '';
    $('reqSubtitle').value = studio.requirement.subtitle || '';
    (studio.requirement.platforms || []).forEach((p) => {
      const cb = $('reqPlatforms').querySelector('input[value="' + p + '"]');
      if (cb) cb.checked = true;
    });
    $('reqMood').value = studio.requirement.mood || '';
    $('reqVoice').value = studio.requirement.voice || '';
    $('reqMusic').value = studio.requirement.music || '';
    $('reqReference').value = studio.requirement.reference || '';
    $('reqSelling').value = studio.requirement.selling || '';
    $('reqMust').value = studio.requirement.mustHave || '';
    $('reqAvoid').value = studio.requirement.avoid || '';

    // 项目基础信息（两种模式都显示）
    $('projName').value = proj.title === '未命名项目' ? '' : (proj.title || '');
    $('projType').value = proj.type || 'short_video';

    // Step 0: 模型选择器（第一步四步全选 + 每步独立选择器，便于在各步骤覆盖）
    setModelSelect('mScriptQ', 'script');
    setModelSelect('mChars', 'characters');
    setModelSelect('mBoard', 'storyboard');
    setModelSelect('mProd', 'production');
    setModelSelect('stepMScript', 'script');
    setModelSelect('stepMChars', 'characters');
    setModelSelect('stepMBoard', 'storyboard');
    setModelSelect('stepMProd', 'production');
    bindModelSync();

    // 剧本
    $('scriptText').value = studio.script || '';
    $('scriptPreview').value = studio.script || '';
    setActiveScriptTab(studio.scriptMode || 'gen');

    // 人物 / 场景 / 道具
    $('themeStyle').value = (proj.meta && proj.meta.theme) || studio.production.style || '';
    renderCharCards();
    renderSceneCards();
    renderPropCards();

    // 分镜表
    renderBoardTable();

    // 制作
    $('prodStyle').value = studio.production.style || '';
    renderProdStatus();
    renderSummary();
    renderShotVideos();
    renderGenNotes();
    if (studio.production.status === 'done') renderPreview();
  }

  // ---- 剧本 tab 切换 ----
  function setActiveScriptTab(tabId) {
    document.querySelectorAll('#scriptTabs .tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('#scriptTabs ~ .tab-panel, #scriptTabs ~ * .tab-panel').forEach((p) => {
      if (p.id && p.id.startsWith('panel_')) p.style.display = p.id === 'panel_' + tabId ? '' : 'none';
    });
    studio.scriptMode = tabId;
  }

  // ---- 人物卡片渲染（参考截图1 + 编辑按钮） ----
  function renderCharCards() {
    const wrap = $('charList');
    const emptyEl = $('emptyChars');
    if (!studio.characters.length) {
      wrap.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    wrap.innerHTML = studio.characters.map((c, i) => `
      <div class="entity-card" data-i="${i}" data-type="char">
        <div class="ec-header">
          <span class="ec-badge">${(c.looks && c.looks.length) || 0}种造型</span>
          <button type="button" class="ec-menu" title="更多">···</button>
        </div>
        <div class="ec-body">
          <div class="ec-placeholder">${c.image_url ? '<img src="' + esc(c.image_url) + '" />' : '暂无基准造型图'}</div>
        </div>
        <div class="ec-footer">
          <span class="ec-name" contenteditable="true" data-field="name">${esc(c.name || '未命名角色')}</span>
          <div class="ec-detail">
            <input class="ec-input" placeholder="身份/作用" value="${esc(c.role || '')}" data-field="role" />
            <textarea class="ec-textarea" placeholder="外貌/性格/服装描述" data-field="desc">${esc(c.desc || '')}</textarea>
          </div>
        </div>
        <div class="ec-actions">
          <button type="button" class="ec-edit-btn" data-edit="char" data-i="${i}">编辑详情</button>
          <button type="button" class="ec-regen-btn" data-regen="char" data-i="${i}">重新生成</button>
        </div>
        <button type="button" class="ec-del" data-del="char" data-i="${i}">删除</button>
      </div>`).join('');
  }

  function renderSceneCards() {
    const wrap = $('sceneList');
    const emptyEl = $('emptyScenes');
    if (!studio.scenes.length) {
      wrap.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    wrap.innerHTML = studio.scenes.map((s, i) => `
      <div class="entity-card" data-i="${i}" data-type="scene">
        <div class="ec-header">
          <span class="ec-badge scene-badge">场景</span>
          <button type="button" class="ec-menu" title="更多">···</button>
        </div>
        <div class="ec-body">
          <div class="ec-placeholder">${s.image_url ? '<img src="' + esc(s.image_url) + '" />' : '暂无基准场景图'}</div>
        </div>
        <div class="ec-footer">
          <span class="ec-name" contenteditable="true" data-field="name">${esc(s.name || '未命名场景')}</span>
          <textarea class="ec-textarea" placeholder="环境/光线/氛围描述" data-field="desc">${esc(s.desc || '')}</textarea>
        </div>
        <div class="ec-actions">
          <button type="button" class="ec-edit-btn" data-edit="scene" data-i="${i}">编辑详情</button>
          <button type="button" class="ec-regen-btn" data-regen="scene" data-i="${i}">重新生成</button>
        </div>
        <button type="button" class="ec-del" data-del="scene" data-i="${i}">删除</button>
      </div>`).join('');
  }

  function renderPropCards() {
    const wrap = $('propList');
    const emptyEl = $('emptyProps');
    if (!studio.props.length) {
      wrap.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    wrap.innerHTML = studio.props.map((p, i) => `
      <div class="entity-card" data-i="${i}" data-type="prop">
        <div class="ec-header">
          <span class="ec-badge prop-badge">道具</span>
          <button type="button" class="ec-menu" title="更多">···</button>
        </div>
        <div class="ec-body">
          <div class="ec-placeholder">${p.image_url ? '<img src="' + esc(p.image_url) + '" />' : '暂无基准道具图'}</div>
        </div>
        <div class="ec-footer">
          <span class="ec-name" contenteditable="true" data-field="name">${esc(p.name || '未命名道具')}</span>
          <textarea class="ec-textarea" placeholder="外观/材质/用法描述" data-field="desc">${esc(p.desc || '')}</textarea>
        </div>
        <div class="ec-actions">
          <button type="button" class="ec-edit-btn" data-edit="prop" data-i="${i}">编辑详情</button>
          <button type="button" class="ec-regen-btn" data-regen="prop" data-i="${i}">重新生成</button>
        </div>
        <button type="button" class="ec-del" data-del="prop" data-i="${i}">删除</button>
      </div>`).join('');
  }

  // ---- 分镜表格渲染（参考截图2） ----
  function renderBoardTable() {
    const tbody = $('shotList');
    const emptyEl = $('emptyShots');
    if (!studio.storyboard.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = studio.storyboard.map((s, i) => `
      <tr data-i="${i}">
        <td class="col-num"><span class="shot-num">${i + 1}</span></td>
        <td class="col-scene"><textarea class="board-scene" placeholder="画面内容 / 动作描述">${esc(s.scene || '')}</textarea></td>
        <td class="col-select"><select class="board-size">${buildSelect(SHOT_SIZES, s.shot_size || '')}</select></td>
        <td class="col-select"><select class="board-movement">${buildSelect(MOVEMENTS, s.movement || '')}</select></td>
        <td class="col-select"><select class="board-angle">${buildSelect(ANGLES, s.angle || '')}</select></td>
        <td class="col-dialogue"><textarea class="board-dialogue" placeholder="台词 / 旁白">${esc(s.dialogue || '')}</textarea></td>
        <td class="col-asset">
          <div class="material-card" data-shot="${i}">
            <div class="material-card-header">
              <span>应用的素材</span>
              <span class="material-arrow">▾</span>
            </div>
            <div class="material-card-body">
              ${s.materials && s.materials.length
                ? '<div class="material-list">' + s.materials.map(m => '<div class="material-thumb"><img src="' + esc(m) + '" onerror="this.style.display=\'none\'" /></div>').join('') + '</div>'
                : '<div class="material-empty">暂无素材</div>'
              }
            </div>
            <button type="button" class="material-create-btn" data-shot="${i}" title="前往素材制作工作台">
              <span class="mc-btn-icon">✨</span> 去制作 →
            </button>
          </div>
        </td>
        <td class="col-add"></td>
      </tr>`).join('');

    // 绑定分镜表格行内编辑的实时同步事件
    bindBoardRowSync();
  }

  /** 同步指定分镜行的画面内容 textarea（不重新渲染整个表格，避免丢失焦点/光标位置） */
  function syncShotRowText(idx, text) {
    const tbody = $('shotList');
    if (!tbody) return;
    const row = tbody.querySelector('tr[data-i="' + idx + '"]');
    if (!row) return;
    const ta = row.querySelector('.board-scene');
    if (ta && ta.value !== text) ta.value = text;
  }

  /** 为分镜表格中所有可编辑字段绑定 input 实时同步（→ studio 数据 + → 素材工作台） */
  function bindBoardRowSync() {
    const tbody = $('shotList');
    if (!tbody) return;
    let syncTimer = null;
    tbody.addEventListener('input', (e) => {
      const ta = e.target.closest('textarea');
      const sel = e.target.closest('select');
      if (!ta && !sel) return;
      const row = e.target.closest('tr');
      if (!row) return;
      const idx = +row.dataset.i;
      if (isNaN(idx) || !studio.storyboard[idx]) return;

      // 防抖：写回 studio 数据 + 同步到素材工作台描述框
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        const shot = studio.storyboard[idx];
        if (ta) {
          if (ta.classList.contains('board-scene')) shot.scene = ta.value;
          else if (ta.classList.contains('board-dialogue')) shot.dialogue = ta.value;
        }
        if (sel) {
          if (sel.classList.contains('board-size')) shot.shot_size = sel.value;
          else if (sel.classList.contains('board-movement')) shot.movement = sel.value;
          else if (sel.classList.contains('board-angle')) shot.angle = sel.value;
        }
        // 如果素材工作台当前正打开着这一镜，同步画面描述框
        if (msShotIndex === idx && $('msSceneDesc')) {
          if (ta && ta.classList.contains('board-scene')) $('msSceneDesc').value = ta.value;
        }
        // 触发自动保存
        debounceAutoSave();
      }, 300);
    });
  }

  function renderGenNotes() {
    for (let s = 1; s <= 4; s++) {
      const el = $('genNote' + s);
      if (!el) continue;
      if (mode === 'quick' && studio.generated[s]) {
        el.style.display = '';
        el.textContent = '已生成 · 模型：' + (studio.models[STEP_KEY[s]] || '默认');
      } else {
        el.style.display = 'none';
      }
    }
  }

  function PROD_LABEL(s) {
    return { idle: '未开始', queued: '排队中', rendering: '渲染中', merging: '合并中', done: '已完成', failed: '失败' }[s] || s;
  }

  function renderProdStatus() {
    const el = $('prodStatus');
    const s = studio.production.status || 'idle';
    el.className = 'prod-status ' + s;
    el.textContent = '制作状态：' + PROD_LABEL(s);
  }

  function renderSummary() {
    const chars = studio.characters.length;
    const scenes = studio.scenes.length;
    const props = studio.props.length;
    const shots = studio.storyboard.length;
    const dur = (proj.meta && proj.meta.duration) || shots * 5;
    $('prodSummary').innerHTML = `
      <div class="sum-row"><span>需求</span><b>${esc((studio.requirement.text || '—').slice(0, 60))}</b></div>
      <div class="sum-row"><span>剧本</span><b>${studio.script ? studio.script.length + ' 字' : '未生成'}</b></div>
      <div class="sum-row"><span>人物</span><b>${chars} 个</b></div>
      <div class="sum-row"><span>场景</span><b>${scenes} 个</b></div>
      <div class="sum-row"><span>道具</span><b>${props} 个</b></div>
      <div class="sum-row"><span>分镜</span><b>${shots} 镜</b></div>
      <div class="sum-row"><span>预计时长</span><b>${dur} 秒</b></div>`;
  }

  // 生成某分镜的演示视频画面（无真实视频时用作占位片段）
  function shotDemoFrame(i) {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const pal = SHOT_PALETTE[i % SHOT_PALETTE.length];
    const g = ctx.createLinearGradient(0, 0, 320, 180);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('镜头 ' + (i + 1), 160, 84);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText('演示视频片段', 160, 108);
    return canvas.toDataURL();
  }

  // 渲染每个分镜的镜头视频清单（供第5步逐镜展示 + 合并）
  function renderShotVideos() {
    const wrap = $('shotVideoList');
    const countEl = $('shotVidCount');
    if (!wrap) return;
    if (!studio.storyboard.length) {
      if (countEl) countEl.textContent = '0';
      wrap.innerHTML = '<p class="empty-hint">尚无分镜。请先在「④ 分镜」步骤生成或添加镜头，再回到此处合并成片。</p>';
      return;
    }
    if (countEl) countEl.textContent = String(studio.storyboard.length);
    wrap.innerHTML = studio.storyboard.map((s, i) => {
      const vid = (s.videos && s.videos.length) ? s.videos[0] : null;
      const pal = SHOT_PALETTE[i % SHOT_PALETTE.length];
      const frame = vid ? '<img src="' + esc(vid) + '" alt="镜头' + (i + 1) + '" onerror="this.style.display=\'none\'" />' : '<span class="svc-play">▶</span>';
      const dur = s.duration || '5';
      const sceneTxt = (s.scene || '未命名镜头').slice(0, 48);
      const sub = vid ? (s.videos.length + ' 个视频片段') : '演示占位画面（点击「合并成片」将以此拼接）';
      return '<div class="shot-video-card" data-i="' + i + '">' +
        '<div class="svc-head"><span class="svc-num">镜头 ' + (i + 1) + '</span>' +
          (vid ? '' : '<span class="svc-badge">演示</span>') +
          '<span class="svc-dur">' + esc(dur) + 's</span></div>' +
        '<div class="svc-thumb" style="--c1:' + pal[0] + ';--c2:' + pal[1] + '">' + frame + '</div>' +
        '<div class="svc-meta"><div class="svc-scene">' + esc(sceneTxt) + '</div>' +
          '<div class="svc-sub">' + esc(sub) + '</div></div>' +
        '</div>';
    }).join('');
  }

  function renderPreview() {
    const el = $('preview');
    const shots = studio.storyboard.length;
    const dur = (proj.meta && proj.meta.duration) || (shots * 5);
    // 拼接各分镜演示画面，作为成片预览的「时间线」
    const frames = studio.storyboard.map((s, i) => {
      const vid = (s.videos && s.videos.length) ? s.videos[0] : null;
      const pal = SHOT_PALETTE[i % SHOT_PALETTE.length];
      const inner = vid ? '<img src="' + esc(vid) + '" alt="" />' : '<span class="svc-play">▶</span>';
      return '<div class="merged-frame" style="--c1:' + pal[0] + ';--c2:' + pal[1] + '">' +
        '<div class="mf-thumb">' + inner + '</div>' +
        '<div class="mf-label">镜头 ' + (i + 1) + ' · ' + esc(s.duration || '5') + 's</div></div>';
    }).join('');
    el.style.display = '';
    el.innerHTML = `
      <div class="mp-title">🎬 成片预览（${shots} 镜已拼接）</div>
      <div class="merged-timeline">${frames || '<span class="muted">暂无分镜素材</span>'}</div>
      <div class="mp-card">
        <div class="mp-thumb"></div>
        <div class="mp-meta">
          <div class="mp-name">${esc(proj.title)}</div>
          <div class="mp-sub">合并成片 · 总时长 ${dur}s · ${esc(studio.production.style || '默认')}</div>
        </div>
      </div>
      <p class="muted" style="margin-top:10px">演示拼接画面。实际成片由你接入的大模型 API 依次渲染各分镜后合成。</p>`;
  }

  // ---------- 同步（DOM -> studio） ----------
  function syncStage(i) {
    if (i === 0) {
      // 单向数据流：DOM -> studio（state 为唯一真相源），由 REQ_FIELDS schema 驱动
      REQ_FIELDS.forEach((f) => {
        const el = $(f.el);
        if (el) studio.requirement[f.path] = el.value;
      });
      const plat = $('reqPlatforms');
      if (plat) studio.requirement.platforms = Array.from(plat.querySelectorAll('input:checked')).map((cb) => cb.value);
      proj.title = $('projName').value.trim() || proj.title;
      proj.type = $('projType').value;
      proj.prompt = studio.requirement.text;
      // 第一步四步模型选择（一键生成模式）
      studio.models.script = $('mScriptQ').value;
      studio.models.characters = $('mChars').value;
      studio.models.storyboard = $('mBoard').value;
      studio.models.production = $('mProd').value;
      // 每步骤独立模型选择器（可覆盖第一步的默认值）
      if ($('stepMScript')) { const v = $('stepMScript').value; if (v) studio.models.script = v; }
      if ($('stepMChars')) { const v = $('stepMChars').value; if (v) studio.models.characters = v; }
      if ($('stepMBoard')) { const v = $('stepMBoard').value; if (v) studio.models.storyboard = v; }
      if ($('stepMProd')) { const v = $('stepMProd').value; if (v) studio.models.production = v; }
    } else if (i === 1) {
      // 剧本：统一取当前激活 tab 对应的内容；预览区现在也可编辑，以它为最终源
      const previewVal = $('scriptPreview').value;
      if (previewVal && previewVal !== studio.script) {
        // 用户在预览区编辑过
        studio.script = previewVal;
      } else {
        const modeVal = studio.scriptMode || 'gen';
        if (modeVal === 'write') {
          studio.script = $('scriptText').value;
        } else if (modeVal === 'upload') {
          studio.script = $('scriptUploadText').value;
        }
        // gen 模式下 script 已由生成器写入
      }
      // 同步到预览区（确保一致）
      $('scriptPreview').value = studio.script || '';
    } else if (i === 2) {
      // 同步人物卡片
      syncEntityCards('charList', 'characters', ['name', 'role', 'desc']);
      // 同步场景卡片
      syncEntityCards('sceneList', 'scenes', ['name', 'desc']);
      // 同步道具卡片
      syncEntityCards('propList', 'props', ['name', 'desc']);
      studio.production.style = $('themeStyle').value;
      if (proj.meta) proj.meta.theme = $('themeStyle').value;
    } else if (i === 3) {
      // 同步分镜表格
      studio.storyboard = Array.from($('shotList').querySelectorAll('tr')).map((tr) => ({
        scene: tr.querySelector('.board-scene') ? tr.querySelector('.board-scene').value : '',
        shot_size: tr.querySelector('.board-size') ? tr.querySelector('.board-size').value : '',
        movement: tr.querySelector('.board-movement') ? tr.querySelector('.board-movement').value : '',
        angle: tr.querySelector('.board-angle') ? tr.querySelector('.board-angle').value : '',
        dialogue: tr.querySelector('.board-dialogue') ? tr.querySelector('.board-dialogue').value : '',
        duration: '',
        camera: (tr.querySelector('.board-size') ? tr.querySelector('.board-size').value : '') +
                '/' + (tr.querySelector('.board-movement') ? tr.querySelector('.board-movement').value : ''),
        images: [], videos: [], materials: [],
      }));
    } else if (i === 4) {
      studio.production.style = $('prodStyle').value;
    }
  }

  function syncEntityCards(listId, key, fields) {
    const wrap = $(listId);
    if (!wrap) return;
    const cards = wrap.querySelectorAll('.entity-card');
    const arr = [];
    cards.forEach((card) => {
      const obj = {};
      fields.forEach((f) => {
        const el = card.querySelector('[data-field="' + f + '"]');
        obj[f] = el ? el.value || el.textContent.trim() : '';
      });
      arr.push(obj);
    });
    studio[key] = arr;
  }

  async function persist(advanceTo, silent) {
    syncStage(currentStep);
    const meta = Object.assign({}, proj.meta || {}, { studio });
    const body = {
      title: proj.title,
      type: proj.type,
      status: proj.status,
      prompt: proj.prompt,
      description: proj.description,
      meta,
    };
    const { ok, data } = await RF.api('PUT', '/projects/' + proj.id, { body });
    if (!ok) { if (!silent) RF.toast((data && data.error) || '保存失败', 'err'); return false; }
    proj = data.project;
    if (!silent) RF.toast('已保存', 'ok');
    renderSummary();
    if (advanceTo != null) goStep(advanceTo);
    return true;
  }

  // ---------- 全局自动保存 ----------
  let autoSaveTimer = null;
  let autoSavePending = false;

  /** 防抖自动保存：所有输入变更后 1.2s 自动调用 persist（静默，不跳步） */
  function debounceAutoSave() {
    autoSavePending = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      autoSaveTimer = null;
      autoSavePending = false;
      try {
        // 同步当前步骤 + 始终同步基础字段（项目名称可能在不同步骤被修改）
        syncStage(currentStep);
        const pn = $('projName');
        if (pn) proj.title = pn.value.trim() || proj.title;
        const pt = $('projType');
        if (pt) proj.type = pt.value;
        await saveProject();
      } catch (_) {
        // 网络异常等静默处理，不干扰用户
      }
    }, 1200);
  }

  /** 仅保存到后端（不切换步骤、不弹 toast） */
  async function saveProject() {
    const meta = Object.assign({}, proj.meta || {}, { studio });
    const body = { title: proj.title, type: proj.type, status: proj.status, prompt: proj.prompt, description: proj.description, meta };
    const { ok, data } = await RF.api('PUT', '/projects/' + proj.id, { body });
    if (ok && data.project) proj = data.project;
    return ok;
  }

  /** 为工作台内所有可编辑控件绑定自动保存 */
  function bindAutoSave() {
    // 收集 stage 区域内所有的 input / textarea / select
    const container = document.querySelector('.stage-wrap');
    if (!container) return;
    container.addEventListener('input', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        debounceAutoSave();
      }
    }, { passive: true });
    // select 的 change 也触发（select 不一定触发 input）
    container.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT') debounceAutoSave();
    }, { passive: true });

    // 第一步需求区域（在 stage 外的 req-group 也需要）
    const reqGroup = document.querySelector('.stage[data-stage="0"]');
    if (reqGroup) {
      reqGroup.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') debounceAutoSave();
      }, { passive: true });
    }

    // 实体卡片 contenteditable
    document.addEventListener('input', (e) => {
      if (e.target.hasAttribute('contenteditable')) debounceAutoSave();
    }, { passive: true });
  }

  function goStep(i) {
    currentStep = i;
    document.querySelectorAll('.stage').forEach((s) => {
      s.style.display = (+s.dataset.stage === i) ? '' : 'none';
    });
    document.querySelectorAll('.step').forEach((s) => {
      s.classList.toggle('active', +s.dataset.step === i);
    });
    if (i === 4) renderShotVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- 模式 UI ----------
  function applyModeUI() {
    // 仅保留一键生成模式：模型配置区常显，开始自动按钮常显
    const mc = $('modelConfig');
    if (mc) mc.style.display = '';
    const qmc = $('quickModelConfig');
    if (qmc) qmc.style.display = '';

    // 按钮：一键生成 + 逐步操作 同时可见
    $('startAutoBtn').style.display = '';
    // next0 保持显示（用户可选择一键生成或逐步操作）
    $('parseBtn').style.display = 'none';
    $('parsedWrap').style.display = 'none';
    // genScriptBtn 由 HTML 默认显示，在 step 2 的 AI 生成 tab 中可见

    // 每步骤独立大模型选择器：常显（可覆盖第一步的默认选择）
    for (let s = 1; s <= 4; s++) {
      const el = $('stepModel' + s);
      if (el) el.style.display = '';
    }

    // 细粒度控制
    document.querySelectorAll('.detail-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.quick-only').forEach(el => el.style.display = '');

    // 模型接入状态提示
    const tip = $('modelApiTip');
    if (tip) {
      if (HAS_ANY_CONNECTED) {
        const count = AVAILABLE_MODELS.length;
        tip.innerHTML = '✅ 已接入 <b>' + count + '</b> 个可用模型，下拉中直接选择即可。' +
          '<a href="apikeys.html" style="color:var(--brand);text-decoration:none">→ 管理接入</a>';
        tip.style.color = 'var(--ink)';
      } else {
        tip.innerHTML = '⚠️ <b>尚未接入任何大模型 API</b>。请先前往「<a href="apikeys.html" style="color:var(--brand);text-decoration:none;font-weight:600">API 接入</a>」配置密钥，配置后刷新本页即可使用。';
        tip.style.color = 'var(--danger,#dc2626)';
      }
    }
  }

  function renderModeBanner() {
    const el = $('modeBanner');
    if (!el) return;
    el.className = 'mode-banner quick';
    el.innerHTML = '<div class="mb-text"><b>一键生成模式</b> · 在第一步填写需求后，可点击「一键生成全部」由 Agent 自动完成全流程，也可点击「保存并下一步」逐步骤手动修改调整。</div>';
  }

  // ---------- 实体编辑器状态 ----------
  let editorEntity = null; // { type: 'char'|'scene'|'prop', index: number }
  const EDITOR_DEFAULTS = {
    genMode: 'text2img', imgModel: '', ratio: '16:9', resolution: '2K', count: 1,
    provider: 'jimeng', videoVer: 'Seedance 1.5 Pro', videoRatio: '16:9',
    videoRes: '720p', videoSync: '开', videoDur: '5s', videoCount: '1条',
  };

  // ---------- 生成器层（Generator） ----------
  // 统一签名：async (ctx) => void，ctx = { studio, models }
  // 当前为 mock 实现，只操作 studio 状态、不读写 DOM；
  // 将来接入真实后端，只需替换 generators 的实现，UI 与任务状态机零改动。
  function buildParsed(r) {
    const tone = r.tone || '';
    const aud = r.audience || '';
    const lines = [
      `【拍摄需求】`,
      `· 核心诉求：${r.text || '本视频'}`,
      `· 视频基调：${tone || '待定'}`,
      `· 目标受众：${aud || '待定'}`,
      `· 制作规格：时长 ${r.duration ? r.duration + ' 秒' : '不限'} · 比例 ${r.ratio || '不限'} · 字幕 ${r.subtitle || '无'} · 平台 ${(r.platforms || []).join('/') || '不限'}`,
      `· 创意设定：情绪 ${r.mood || '不限'} · 配音 ${r.voice || '无'} · 音乐 ${r.music || '不限'}${(r.reference ? ' · 参考 ' + r.reference : '')}`,
      `· 核心卖点：${r.selling || '待定'}`,
      `· 必含元素：${r.mustHave || '主角出镜、产品清晰露出、明确行动号召（CTA）'}`,
      `· 禁忌避雷：${r.avoid || '无特别限制'}`,
      `· 交付：1 条成片 + 1 条竖版剪辑`,
    ];
    return lines.join('\n');
  }
  function buildScript(r) {
    const need = (r.parsed || r.text || '本视频');
    const moodTxt = r.mood ? '整体情绪偏向' + r.mood + '，' : '';
    const voiceTxt = r.voice ? '用' + r.voice + '配音，' : '';
    const sellTxt = r.selling ? '突出核心卖点：' + r.selling + '。' : '';
    const mustTxt = r.mustHave ? '必含：' + r.mustHave + '。' : '';
    const avoidTxt = r.avoid ? '注意避开：' + r.avoid + '。' : '';
    const dur = r.duration ? parseInt(r.duration, 10) : 15;
    return `【脚本】(${dur}秒 · ${moodTxt}${voiceTxt})\n` +
      `00:00-00:03 开场特写：主角使用产品，字幕点出痛点。\n` +
      `00:03-00:08 展示使用过程，${voiceTxt}强调核心卖点。${sellTxt}\n` +
      `00:08-${String(Math.min(dur, 12)).padStart(2, '0')}:00 效果对比，情绪上扬。\n` +
      `${String(Math.min(dur, 12)).padStart(2, '0')}:00-00:${String(dur).padStart(2, '0')} 品牌 logo + 行动号召（立即体验）。\n` +
      `${mustTxt}${avoidTxt}\n依据需求：${need.slice(0, 40)}…`;
  }
  function genParse(ctx) {
    const r = ctx.studio.requirement;
    if (!r.text) { RF.toast('请先填写需求描述', 'err'); return; }
    r.parsed = buildParsed(r);
  }
  function genScript(ctx) {
    const r = ctx.studio.requirement;
    if (!r.parsed) r.parsed = buildParsed(r);
    ctx.studio.script = buildScript(r);
  }
  function genCharacters(ctx) {
    const s = ctx.studio;
    const r = s.requirement;
    const need = r.text || '本视频';
    const scriptContent = s.script || '';
    const tone = r.tone || '';
    const aud = r.audience || '';
    const ctxText = (scriptContent + ' ' + need).slice(0, 500);
    if (s.characters.length === 0) {
      const charName = aud.includes('女') ? '女主角' : (aud.includes('男') ? '男主角' : '主角');
      const charRole = aud || '使用者 / 出镜人';
      const charDesc = tone
        ? `根据「${tone}」风格设定的${charName}，${ctxText.slice(0, 60)}… 可根据视频风格调整外貌、服装、性格。`
        : `默认出镜角色。视频需求：${ctxText.slice(0, 50)}… 可根据实际调整外貌、服装、性格。`;
      s.characters.push({ name: charName, role: charRole, desc: charDesc, looks: ['造型A'], image_url: '' });
    }
    if (s.scenes.length === 0) {
      const plat = (r.platforms || []).join('、') || '';
      const sceneDesc = plat
        ? `主要拍摄环境，适配${plat}平台风格。光线条件与背景布置需匹配整体基调：${tone || '待定'}。`
        : `主要拍摄环境，如室内/室外、光线条件、背景布置。参考剧本设定。`;
      s.scenes.push({ name: '主场景', desc: sceneDesc, image_url: '' });
      if (ctxText.includes('对比') || ctxText.includes('前后')) {
        s.scenes.push({ name: '对比场景', desc: '用于效果对比的辅助场景，突出变化或差异。', image_url: '' });
      }
    }
    if (s.props.length === 0) {
      const sell = r.selling || '产品';
      s.props.push({ name: sell.length > 10 ? '核心道具' : sell, desc: `视频中需要重点展示的物品。核心卖点：${sell}。`, image_url: '' });
    }
  }
  function genStoryboard(ctx) {
    const s = ctx.studio;
    if (s.storyboard.length === 0) {
      const lines = (s.script || '').split('\n').filter((l) => l.trim());
      const base = [
        { scene: '开场：主角使用产品并点出痛点', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '' },
        { scene: '展示使用过程与核心卖点', shot_size: '中景', movement: '固定', angle: '平拍', dialogue: '' },
        { scene: '效果对比与行动号召（CTA）', shot_size: '全景', movement: '拉', angle: '平拍', dialogue: '' },
      ];
      base.forEach((b, idx) => {
        if (lines[idx]) b.scene = lines[idx].replace(/^\d{2}:\d{2}-\d{2}:\d{2}\s*/, '');
        b.images = []; b.videos = []; b.materials = [];
      });
      s.storyboard = base;
    }
  }
  function genProduction(ctx) {
    const s = ctx.studio;
    if (!s.production.style) {
      s.production.style = ($('themeStyle') && $('themeStyle').value) || '简洁明亮 · 产品质感';
    }
  }

  // 生成器注册表（统一调度入口；替换实现即可接真实后端）
  const generators = {
    script: genScript,
    characters: genCharacters,
    storyboard: genStoryboard,
    production: genProduction,
  };

  // 运行某一步的生成器并刷新对应视图（手动按钮与自动流水线共用）
  async function runGenerator(step) {
    const ctx = { studio, models: studio.models };
    const key = STEP_KEY[step];
    try {
      if (key === 'script') {
        if (!studio.requirement.parsed) { genParse(ctx); renderReqParsed(); }
        if (!studio.script) { await generators.script(ctx); renderScriptView(); }
      } else if (key === 'characters') {
        if (studio.characters.length === 0 || studio.scenes.length === 0 || studio.props.length === 0) {
          await generators.characters(ctx);
          renderCharCards(); renderSceneCards(); renderPropCards();
        }
      } else if (key === 'storyboard') {
        if (studio.storyboard.length === 0) { await generators.storyboard(ctx); renderBoardTable(); }
      } else if (key === 'production') {
        await generators.production(ctx);
      }
    } catch (err) {
      console.error('生成步骤 ' + step + '（' + key + '）出错:', err);
      RF.toast('生成「' + (STEP_LABEL[step] || key) + '」时出现问题：' + (err.message || '未知错误'), 'err');
      // 不抛出——允许流水线继续下一步（用户可手动补完这一步后再继续）
    }
  }

  function renderReqParsed() {
    const el = $('reqParsed');
    if (el) el.value = studio.requirement.parsed || '';
  }
  function renderScriptView() {
    setActiveScriptTab('gen');
    const t = $('scriptText'); if (t) t.value = studio.script || '';
    const p = $('scriptPreview'); if (p) p.value = studio.script || '';
  }

  // ---------- 一键生成：自动流水线 ----------
  function modelFor(step) { return studio.models[STEP_KEY[step]] || '默认'; }

  // UI 订阅 taskStore：只负责把状态渲染成进度条与暂停键（不感知状态机内部）
  taskStore.subscribe((state) => {
    const bar = $('autoBar');
    const btn = $('autoPauseBtn');
    if (!bar) return;
    if (state.status === 'idle') { bar.style.display = 'none'; if (btn) btn.style.display = 'none'; return; }
    bar.style.display = '';
    $('autoStepText').textContent = state.label || '';
    $('autoFill').style.width = (state.progress || 0) + '%';
    if (btn) {
      if (state.status === 'running') { btn.style.display = ''; btn.textContent = state.paused ? '继续生成' : '暂停'; }
      else { btn.style.display = 'none'; }
    }
  });

  function startAuto() {
    if (taskStore.get().status === 'running') return;
    syncStage(0);

    // 校验 1：必填信息
    if (!studio.requirement.text) { RF.toast('请先在第一步填写一句话需求', 'err'); goStep(0); $('reqText').focus(); return; }
    if (!$('projName').value.trim()) { RF.toast('请填写项目名称', 'err'); goStep(0); $('projName').focus(); return; }

    // 校验 2：至少需要一个已接入的模型才能生成
    if (!HAS_ANY_CONNECTED || AVAILABLE_MODELS.length === 0) {
      RF.toast('请先在「API 接入」页面配置至少一个大模型的 API 密钥', 'err');
      if (confirm('尚未接入任何大模型 API，是否前往「API 接入」页面配置？')) {
        location.href = 'apikeys.html';
      }
      return;
    }

    // 校验 3：每一步都有可选的模型（不能是空值或 placeholder）
    const steps = ['script','characters','storyboard','production'];
    const stepNames = { script: '生成剧本', characters: '人物主题', storyboard: '分镜设计', production: '视频制作' };
    for (const k of steps) {
      const v = studio.models[k];
      if (!v || v === STEP_DEFAULT[k]) {
        // 检查这个默认值是否有已接入的对应模型
        const hasMatch = AVAILABLE_MODELS.some(m => m.value === v);
        if (!hasMatch && AVAILABLE_MODELS.length > 0) {
          // 自动分配第一个可用的合适模型
          studio.models[k] = filterModelsForStep(k, AVAILABLE_MODELS)[0]?.value || '';
        }
      }
    }

    showTokenWarning();
  }

  function showTokenWarning() {
    // 填充 token 用量表格：列出每步要使用的模型（用可读名称）
    const table = $('tokenCostTable');
    if (table) {
      const rows = [];
      const stepKeys = ['script','characters','storyboard','production'];
      for (let s = 1; s <= 4; s++) {
        const m = studio.models[stepKeys[s-1]] || '';
        const displayName = m ? modelName(m) : '<span style="color:var(--danger,#dc2626)">未选择</span>';
        rows.push('<tr><td style="color:var(--muted);padding:4px 0">步骤 ' + s + ' · ' + (STEP_LABEL[s] || '') + '</td>' +
          '<td style="padding:4px 0;font-weight:600;color:var(--brand)">' + displayName + '</td></tr>');
      }
      table.innerHTML = '<table style="width:100%">' + rows.join('') + '</table>';
    }
    $('tokenWarnModal').classList.add('open');
  }

  function closeTokenWarning() {
    $('tokenWarnModal').classList.remove('open');
  }

  function confirmStartAuto() {
    closeTokenWarning();
    // 最终同步：确保第一步所有字段和模型选择都写入 state
    syncStage(0);
    ensureModelDefaults();

    // 重置生成标记（允许重新生成）
    studio.generated = { 1: false, 2: false, 3: false, 4: false };

    auto.step = 1;
    taskStore.set({ status: 'running', paused: false, step: 0, progress: 0, label: '正在准备…', error: null });
    persist(null, true).then(() => runAutoStep(1));
  }

  async function generateStep(step) {
    if (studio.generated[step]) return;
    await runGenerator(step);
    studio.generated[step] = true;
    renderGenNotes();
  }

  async function runAutoStep(step) {
    const st = taskStore.get();
    if (st.status !== 'running' || st.paused) return;
    if (step > 4) { finishAuto(); return; }
    auto.step = step;
    const labelTxt = (step === 4) ? '正在合并成片' : ('正在生成：' + STEP_LABEL[step]);
    taskStore.set({ step, progress: ((step - 1) / 4) * 100, label: labelTxt + '（步骤 ' + step + '/4）· 模型 ' + modelFor(step) });
    goStep(step);
    if (!studio.generated[step]) {
      await generateStep(step);
      await persist(null, true);
    }
    if (step === 4) { makeVideo(); return; }
    auto.timer = setTimeout(() => {
      if (!taskStore.get().paused) runAutoStep(step + 1);
    }, STEP_DELAY);
  }

  function pauseAuto() {
    const st = taskStore.get();
    if (st.status !== 'running' || st.paused) return;
    if (auto.timer) { clearTimeout(auto.timer); auto.timer = null; }
    taskStore.set({ paused: true, label: '已暂停 · 可点击任意步骤修改细节，然后点「继续生成」' });
    RF.toast('已暂停生成', 'ok');
  }

  function resumeAuto() {
    const st = taskStore.get();
    if (st.status !== 'running' || !st.paused) return;
    taskStore.set({ paused: false, label: '正在生成：' + STEP_LABEL[auto.step] });
    if (auto.step >= 4 && studio.production.status !== 'done') { makeVideo(); return; }
    let s = auto.step;
    if (studio.generated[s]) s += 1;
    if (s > 4) { finishAuto(); return; }
    runAutoStep(s);
  }

  function finishAuto() {
    if (auto.timer) { clearTimeout(auto.timer); auto.timer = null; }
    taskStore.set({ status: 'done', progress: 100, label: '全部步骤已生成完成 · 可点击任意步骤微调，或重新生成' });
    goStep(4);
    RF.toast('一键生成完成', 'ok');
  }

  // ---------- 视频制作：将各分镜镜头视频合并成片（支持暂停） ----------
  function makeVideo() {
    syncStage(4);
    const s = studio.production.status;
    if (!s || s === 'idle' || s === 'done' || s === 'failed') {
      studio.production.status = 'queued';
    }
    renderProdStatus();
    renderSummary();
    persist(null, true);

    const advance = () => {
      if (studio.production.status === 'queued') studio.production.status = 'merging';
      else if (studio.production.status === 'merging') studio.production.status = 'done';
      renderProdStatus();
      renderSummary();
      persist(null, true);
      if (studio.production.status === 'done') {
        renderPreview();
        const btn = $('makeBtn');
        btn.disabled = false;
        btn.textContent = '重新合并';
        RF.toast('成片已合并完成', 'ok');
        if (taskStore.get().status === 'running') finishAuto();
        return;
      }
      auto.timer = setTimeout(() => { if (taskStore.get().paused) return; advance(); }, studio.production.status === 'merging' ? 2400 : 900);
    };
    auto.timer = setTimeout(() => { if (taskStore.get().paused) return; advance(); }, 900);
  }

  // ---------- 事件绑定 ----------
  function wire() {
    // 步骤条点击跳转
    document.querySelectorAll('.step').forEach((b) => {
      b.addEventListener('click', () => {
        if (+b.dataset.step === currentStep) return;
        syncStage(currentStep);
        goStep(+b.dataset.step);
      });
    });

    // Step 0
    $('parseBtn').addEventListener('click', () => { genParse({ studio, models: studio.models }); renderReqParsed(); });
    $('startAutoBtn').addEventListener('click', startAuto);
    $('next0').addEventListener('click', () => persist(1));

    // Token 警告弹窗事件
    $('tokenWarnCancel').addEventListener('click', closeTokenWarning);
    $('tokenWarnConfirm').addEventListener('click', confirmStartAuto);
    $('tokenWarnModal').addEventListener('click', (e) => { if (e.target === $('tokenWarnModal')) closeTokenWarning(); });

    // Step 1: 剧本 tab 切换
    document.querySelectorAll('#scriptTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveScriptTab(btn.dataset.tab));
    });
    $('genScriptBtn').addEventListener('click', () => { runGenerator(1); });
    $('next1').addEventListener('click', () => persist(2));

    // Step 1: 上传文件处理
    const upZone = $('scriptUploadZone');
    const fileInput = $('scriptFileInput');
    if (upZone && fileInput) {
      upZone.addEventListener('click', () => fileInput.click());
      upZone.addEventListener('dragover', e => { e.preventDefault(); upZone.classList.add('drag-over'); });
      upZone.addEventListener('dragleave', () => upZone.classList.remove('drag-over'));
      upZone.addEventListener('drop', e => { e.preventDefault(); upZone.classList.remove('drag-over'); handleScriptUpload(e.dataTransfer.files[0]); });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleScriptUpload(fileInput.files[0]); });
    }
    const clearBtn = $('clearScriptFile');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      $('scriptFileInfo').style.display = 'none';
      $('scriptUploadText').value = '';
      if (fileInput) fileInput.value = '';
    });

    // Step 2: 人物主题标签页切换
    document.querySelectorAll('#charTabs .char-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#charTabs .char-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.ctab;
        document.querySelectorAll('.char-panel').forEach(p => p.style.display = p.id === 'ctab_' + target ? '' : 'none');
      });
    });

    // Step 2: 添加/删除/生成
    $('addChar').addEventListener('click', () => {
      studio.characters.push({ name: '新角色', role: '', desc: '', looks: [], image_url: '' });
      renderCharCards();
    });
    $('addScene').addEventListener('click', () => {
      studio.scenes.push({ name: '新场景', desc: '', image_url: '' });
      renderSceneCards();
    });
    $('addProp').addEventListener('click', () => {
      studio.props.push({ name: '新道具', desc: '', image_url: '' });
      renderPropCards();
    });
    const genCharsBtn = $('genCharsBtn');
    if (genCharsBtn) genCharsBtn.addEventListener('click', () => { runGenerator(2); });

    // 卡片内联编辑同步 & 删除
    ['charList', 'sceneList', 'propList'].forEach(listId => {
      const wrap = $(listId);
      if (!wrap) return;
      wrap.addEventListener('click', e => {
        const del = e.target.closest('[data-del]');
        if (!del) return;
        const type = del.dataset.del;
        const i = +del.dataset.i;
        if (type === 'char') studio.characters.splice(i, 1);
        else if (type === 'scene') studio.scenes.splice(i, 1);
        else if (type === 'prop') studio.props.splice(i, 1);
        if (type === 'char') renderCharCards();
        else if (type === 'scene') renderSceneCards();
        else renderPropCards();
      });
      // contenteditable 变更时同步回数据
      wrap.addEventListener('blur', e => {
        if (e.target.hasAttribute('contenteditable') && e.target.dataset.field) {
          const card = e.target.closest('.entity-card');
          if (!card) return;
          const i = +card.dataset.i;
          const field = e.target.dataset.field;
          const type = card.dataset.type;
          const arr = type === 'char' ? studio.characters : (type === 'scene' ? studio.scenes : studio.props);
          if (arr[i]) arr[i][field] = e.target.textContent.trim();
        }
      }, true);
    });

    $('next2').addEventListener('click', () => persist(3));

    // Step 3: 分镜
    $('addShot').addEventListener('click', () => {
      studio.storyboard.push({
        scene: '', shot_size: '', movement: '', angle: '', dialogue: '',
        duration: '', camera: '', images: [], videos: [], materials: [],
      });
      renderBoardTable();
    });
    const autoBoardBtn = $('autoBoardBtn');
    if (autoBoardBtn) autoBoardBtn.addEventListener('click', () => { runGenerator(3); });
    $('next3').addEventListener('click', () => persist(4));

    // Step 4: 视频
    $('makeBtn').addEventListener('click', makeVideo);
    $('save4').addEventListener('click', () => persist());
    const goBoardBtn = $('goBoardBtn');
    if (goBoardBtn) goBoardBtn.addEventListener('click', () => { syncStage(currentStep); goStep(3); });

    // 自动流水线控制
    $('autoPauseBtn').addEventListener('click', () => { const s = taskStore.get(); if (s.paused) resumeAuto(); else pauseAuto(); });

    // ===== 剧本实时同步（上传/手写 ↔ 预览区 双向绑定）=====
    const scriptPreview = $('scriptPreview');
    const scriptTextEl = $('scriptText');
    const scriptUploadTextEl = $('scriptUploadText');
    // 手写/上传内容变化时，实时更新预览区 + 触发自动保存
    if (scriptTextEl) scriptTextEl.addEventListener('input', () => {
      studio.script = scriptTextEl.value;
      if (scriptPreview) scriptPreview.value = scriptTextEl.value;
      debounceAutoSave();
    });
    if (scriptUploadTextEl) scriptUploadTextEl.addEventListener('input', () => {
      studio.script = scriptUploadTextEl.value;
      if (scriptPreview) scriptPreview.value = scriptUploadTextEl.value;
      debounceAutoSave();
    });
    // 预览区编辑时反向同步回当前激活 tab 的输入区 + 数据 + 自动保存
    if (scriptPreview) scriptPreview.addEventListener('input', () => {
      studio.script = scriptPreview.value;
      if (studio.scriptMode === 'write' && scriptTextEl) scriptTextEl.value = scriptPreview.value;
      else if (studio.scriptMode === 'upload' && scriptUploadTextEl) scriptUploadTextEl.value = scriptPreview.value;
      debounceAutoSave();
    });

    // ===== 实体卡片「编辑详情」「重新生成」按钮 =====
    document.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { openEntityEditor(editBtn.dataset.edit, +editBtn.dataset.i); return; }
      const regenBtn = e.target.closest('[data-regen]');
      if (regenBtn) { regenEntity(regenBtn.dataset.regen, +regenBtn.dataset.i); return; }
    });

    // ===== 实体编辑器弹窗控制 =====
    wireEntityEditor();

    // ===== 素材制作工作台：去制作按钮事件委托 =====
    document.addEventListener('click', e => {
      const mcBtn = e.target.closest('.material-create-btn');
      if (mcBtn) {
        const shotIdx = parseInt(mcBtn.dataset.shot, 10);
        if (!isNaN(shotIdx)) openMaterialStudio(shotIdx);
        return;
      }
    });

    // ===== 素材制作工作台初始化 =====
    wireMaterialStudio();

    // ===== 人物主题工作台：打开按钮 =====
    const openCSBtn = $('openCharStudioBtn');
    if (openCSBtn) {
      openCSBtn.addEventListener('click', () => openCharStudio(studio.characters.length > 0 ? 0 : -1));
    }
    // 人物工作台初始化
    wireCharStudio();

    // 全局自动保存：所有输入控件变更时防抖自动 persist
    bindAutoSave();
  }

  // ---------- 实体编辑器弹窗逻辑 ----------
  const TYPE_LABEL = { char: '人物', scene: '场景', prop: '道具' };

  function getEntityArr(type) {
    return type === 'char' ? studio.characters : (type === 'scene' ? studio.scenes : studio.props);
  }

  function openEntityEditor(type, index) {
    const arr = getEntityArr(type);
    if (!arr || !arr[index]) return;
    editorEntity = { type, index };
    const entity = arr[index];
    const backdrop = $('entityEditorBackdrop');
    const editor = $('entityEditor');

    // 标题
    $('eeTitle').textContent = '编辑 ' + (TYPE_LABEL[type] || type) + ' · ' + (entity.name || '未命名');

    // 图片预览
    const placeholder = $('eePreviewPlaceholder');
    const imgEl = $('eePreviewImg');
    if (entity.image_url) {
      placeholder.style.display = 'none';
      imgEl.style.display = '';
      imgEl.src = entity.image_url;
    } else {
      placeholder.style.display = '';
      placeholder.textContent = '暂无图片';
      imgEl.style.display = 'none';
    }

    // 描述输入
    $('eeDescInput').value = entity.desc || '';

    // 显示弹窗
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeEntityEditor() {
    const backdrop = $('entityEditorBackdrop');
    // 先保存当前编辑内容
    if (editorEntity) {
      saveEntityEditor();
    }
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    editorEntity = null;
  }

  function saveEntityEditor() {
    if (!editorEntity) return;
    const arr = getEntityArr(editorEntity.type);
    if (!arr[editorEntity.index]) return;
    arr[editorEntity.index].desc = $('eeDescInput').value.trim();
    // 如果生成了图片，保存图片 URL
    const imgEl = $('eePreviewImg');
    if (imgEl && imgEl.src && imgEl.style.display !== 'none') {
      arr[editorEntity.index].image_url = imgEl.src;
    }
    // 刷新卡片渲染
    if (editorEntity.type === 'char') renderCharCards();
    else if (editorEntity.type === 'scene') renderSceneCards();
    else renderPropCards();
  }

  function regenEntity(type, index) {
    const arr = getEntityArr(type);
    if (!arr || !arr[index]) return;
    // 基于当前剧本和已有信息重新生成该实体
    const scriptContent = studio.script || '';
    const tone = studio.requirement.tone || '';
    const oldName = arr[index].name || '';
    arr[index].desc = '[已重新生成] 基于「' + scriptContent.slice(0, 40) + '…」自动更新。风格：' + (tone || '保持一致') + '。上次名称：' + oldName + '。可点击编辑详情修改。';
    arr[index].image_url = '';
    if (type === 'char') renderCharCards();
    else if (type === 'scene') renderSceneCards();
    else renderPropCards();
    RF.toast((TYPE_LABEL[type] || type) + '已重新生成，可在卡片中查看并进一步编辑', 'ok');
  }

  function wireEntityEditor() {
    // 关闭按钮
    $('eeCloseBtn').addEventListener('click', closeEntityEditor);
    // 点击背景关闭
    $('entityEditorBackdrop').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeEntityEditor();
    });

    // 工具栏按钮
    $('eeCollapseBtn').addEventListener('click', () => {
      const descArea = $('eeDescArea');
      descArea.style.display = descArea.style.display === 'none' ? '' : 'none';
    });
    $('eeDeleteBtn').addEventListener('click', () => {
      if (!editorEntity) return;
      if (!confirm('确定删除此 ' + (TYPE_LABEL[editorEntity.type] || '') + '？')) return;
      const arr = getEntityArr(editorEntity.type);
      arr.splice(editorEntity.index, 1);
      closeEntityEditor();
      if (editorEntity.type === 'char') renderCharCards();
      else if (editorEntity.type === 'scene') renderSceneCards();
      else renderPropCards();
    });
    $('eePresetBtn').addEventListener('click', () => {
      RF.toast('预设功能：可选择人物模板快速填充（演示占位）', 'ok');
    });
    $('eeEnhanceBtn').addEventListener('click', () => {
      const input = $('eeDescInput');
      if (input.value.trim()) {
        input.value += '\n\n[AI 增强] 已优化描述细节，使画面更具体、光影更丰富、构图更专业。';
        RF.toast('已增强描述，可继续编辑或生成图片', 'ok');
      } else {
        RF.toast('请先填写描述内容', 'err');
      }
    });
    $('eeVoiceBtn').addEventListener('click', () => {
      RF.toast('语音功能：可为角色配置配音或音效提示（演示占位）', 'ok');
    });

    // 实体编辑器描述输入 → 自动保存
    $('eeDescInput').addEventListener('input', debounceAutoSave);

    // 参数芯片切换
    document.querySelectorAll('.ee-param-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const group = chip.closest('.ee-param-group');
        if (!group) return;
        group.querySelectorAll('.ee-param-chip').forEach(c => c.removeAttribute('data-active'));
        chip.setAttribute('data-active', chip.textContent);
      });
    });

    // 视频提供商切换
    document.querySelectorAll('.ee-provider').forEach(pv => {
      pv.addEventListener('click', () => {
        document.querySelectorAll('.ee-provider').forEach(p => p.classList.remove('active'));
        pv.classList.add('active');
        // 展开参数面板
        $('eeVideoParams').style.display = '';
      });
    });

    // 生成按钮
    $('eeGenerateBtn').addEventListener('click', () => {
      const mode = $('eeGenMode').value;
      const model = $('eeImgModel').value;
      const desc = $('eeDescInput').value.trim();
      if (!desc) { RF.toast('请先填写描述内容', 'err'); return; }
      // 模拟图片生成
      $('eeGenerateBtn').disabled = true;
      $('eeGenerateBtn').innerHTML = '<span class="ee-gen-icon">&#9889;</span> 生成中…';
      setTimeout(() => {
        // 演示：显示一个渐变色块作为"生成结果"
        const colors = ['#6d5efc', '#d946a6', '#16a34a', '#f59e0b'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        $('eePreviewPlaceholder').style.display = 'none';
        const imgEl = $('eePreviewImg');
        // 用 canvas 生成一张演示图
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 288;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 288);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(mode === 'text2img' ? '文生图预览' : mode + ' 预览', 256, 144);
        ctx.font = '14px sans-serif'; ctx.fillText(desc.slice(0, 30), 256, 174);
        imgEl.src = canvas.toDataURL(); imgEl.style.display = '';
        $('eeGenerateBtn').disabled = false;
        $('eeGenerateBtn').innerHTML = '<span class="ee-gen-icon">&#9889;</span> 生成';
        RF.toast('图片已生成（演示），可关闭编辑器查看效果', 'ok');
      }, 1500);
    });
  }

  // ==================== 素材制作工作台 v2（三栏专业布局） ====================

  /* ---- 工作台联动：渲染供应商 tab 行 ---- */
  function renderProviderRow(rowId, mode, currentProv, onProvChange) {
    var row = $(rowId);
    if (!row) return;
    var provs = getMPMProviders(mode);
    if (!provs.length) { row.innerHTML = ''; return; }
    row.innerHTML = provs.map(function(p) {
      return '<button type="button" class="rp-prov-tab' + (p.id === currentProv ? ' active' : '') + '" data-pid="' + p.id + '">' +
        '<span>' + p.icon + '</span><span>' + p.name + '</span></button>';
    }).join('');
    row.querySelectorAll('.rp-prov-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        row.querySelectorAll('.rp-prov-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        if (onProvChange) onProvChange(tab.dataset.pid);
      });
    });
  }

  /* ---- 工作台联动：渲染模型版本芯片行 ---- */
  function renderModelOptsRow(optsId, mode, provId, currentModel, onModelChange) {
    var opts = $(optsId);
    if (!opts) return;
    var models = getMPMModels(mode, provId);
    if (!models.length) { opts.innerHTML = '<span class="muted" style="font-size:12px">该供应商暂无可用模型</span>'; return; }
    // 找默认选中项
    var sel = currentModel || '';
    if (!sel || !models.some(function(m) { return m.id === sel; })) {
      var def = models.find(function(m) { return m.def; });
      sel = def ? def.id : models[0].id;
    }
    opts.innerHTML = models.map(function(m) {
      return '<span class="rp-model-opt' + (m.id === sel ? ' active' : '') + '" data-mid="' + m.id + '">' + esc(m.name) + '</span>';
    }).join('');
    opts.querySelectorAll('.rp-model-opt').forEach(function(chip) {
      chip.addEventListener('click', function() {
        opts.querySelectorAll('.rp-model-opt').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        if (onModelChange) onModelChange(chip.dataset.mid, chip.textContent.trim());
      });
    });
    return sel;
  }

  /* ---- 工作台联动：更新右侧面板（模式+供应商→刷新全部） ---- */
  function refreshRightPanel(panelPrefix, mode, provId, onSummaryUpdate) {
    var provRowId = panelPrefix + 'ProvRow';
    var descId = panelPrefix + 'ProvDesc';
    var modelRowId = panelPrefix + 'ModelRow';
    var modelOptsId = panelPrefix + 'ModelOpts';
    var titleId = panelPrefix + 'RpTitle';

    var provs = getMPMProviders(mode);
    // 如果当前供应商不在新模式下，自动选第一个
    if (!provs.length) { provId = ''; }
    else if (!provs.some(function(p) { return p.id === provId; })) {
      provId = provs[0].id;
    }

    // 渲染供应商 tabs
    renderProviderRow(provRowId, mode, provId, function(newPid) {
      provId = newPid;
      // 切换供应商时更新描述和模型
      var entry = MPM[mode] && MPM[mode][provId];
      $(descId).textContent = entry ? entry.desc : '';
      var mid = renderModelOptsRow(modelOptsId, mode, provId, '', function(mid, mName) {
        if (onSummaryUpdate) onSummaryUpdate(mode, provId, mid, mName);
      });
      if (onSummaryUpdate) {
        var mEntry = getMPMModels(mode, provId).find(function(m) { return m.id === mid; });
        onSummaryUpdate(mode, provId, mid, mEntry ? mEntry.name : '');
      }
    });

    // 已接入同步模式：未接入对应能力模型时，提示去「API 接入页」配置
    if (!provs.length && SYNCED_MODES.has(mode)) {
      var needCap = MODE_CAP_BY_SYNC[mode];
      var hintText = !HAS_ANY_CONNECTED
        ? '🔌 请先在「API 接入」页面接入大模型 API'
        : ('当前已接入的模型暂不支持' + (needCap === 'image' ? '图片' : '视频') + '生成，请接入支持该功能的大模型');
      $(modelOptsId).innerHTML = '<span class="muted" style="font-size:12px;display:block;padding:8px 0;line-height:1.6">' +
        esc(hintText) + ' · <a href="apikeys.html" style="color:var(--brand);text-decoration:none">去接入 →</a></span>';
      $(modelRowId).style.display = '';
      $(descId).textContent = '';
      return { provId: '', modelId: '' };
    }

    // 渲染描述
    var entry = MPM[mode] && MPM[mode][provId];
    $(descId).textContent = entry ? entry.desc : '';

    // 更新标题（显示模式名）
    var modeLabels = {
      text2img: '文生图', imgblend: '翻图模式',
      'vid-text': '文生视频', 'vid-headtail': '首尾帧', 'vid-ref': '多参考', 'vid-edit': '视频编辑', 'vid-motion': '动作控制',
      'char-img': '人物参图', 'char-video': '动作参考视频',
      'voice-dub': '台词配音', 'voice-clone': '音色转换',
      'music-text': '文生音乐', 'music-cover': '音乐翻唱',
    };
    if ($(titleId)) {
      var baseTitle = panelPrefix === 'ms' ? '基础图像指令 · 动态表现综合版' : '人物形象生成 · 角色先建策略';
      var ml = modeLabels[mode] || mode;
      $(titleId).textContent = baseTitle.replace(/·.*/, '\u00b7 ' + ml);
    }

    // 渲染模型版本
    var mid = renderModelOptsRow(modelOptsId, mode, provId, '', function(mid, mName) {
      if (onSummaryUpdate) onSummaryUpdate(mode, provId, mid, mName);
    });

    // 显示/隐藏 model-row（没有模型时隐藏）
    $(modelRowId).style.display = getMPMModels(mode, provId).length ? '' : 'none';

    // ---- 模式专属额外选项（如性转优化、音调调整等）----
    renderModeExtraOpts(panelPrefix + 'ExtraOpts', mode);

    // ---- 按模式类型显隐标准选项区（画幅比/分辨率/音画同步/时长/数量）----
    applyModeSectionVisibility(panelPrefix, mode);

    return { provId: provId, modelId: mid };
  }

  /* ---- 模式专属额外选项渲染 ---- */
  function renderModeExtraOpts(containerId, mode) {
    var container = $(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (mode === 'voice-clone') {
      // 性转优化
      container.innerHTML += '<div class="ms-rp-section">' +
        '<div class="ms-rp-label">性转优化</div>' +
        '<div class="ms-rp-options" data-opt-group="gender-toggle">' +
          '<span class="ms-rp-opt active" data-val="on">开</span>' +
          '<span class="ms-rp-opt" data-val="off">关</span>' +
        '</div></div>';
      // 音调调整
      container.innerHTML += '<div class="ms-rp-section">' +
        '<div class="ms-rp-label">音调调整</div>' +
        '<div class="ms-rp-options" data-opt-group="pitch">' +
          '<span class="ms-rp-opt" data-val="lower">更低沉</span>' +
          '<span class="ms-rp-opt active" data-val="standard">标准</span>' +
          '<span class="ms-rp-opt" data-val="higher">更尖锐</span>' +
        '</div></div>';
      // 绑定点击
      container.querySelectorAll('.ms-rp-options').forEach(function(group) {
        group.querySelectorAll('.ms-rp-opt').forEach(function(opt) {
          opt.addEventListener('click', function() {
            group.querySelectorAll('.ms-rp-opt').forEach(function(o) { o.classList.remove('active'); });
            opt.classList.add('active');
          });
        });
      });
    }
    // 其他模式暂无额外选项（voice-dub / music-text / music-cover 只有模型版本+数量）
  }

  /* ---- 按模式类型显隐标准选项区 ---- */
  // 模式分类: video | image | voice | music
  function applyModeSectionVisibility(panelPrefix, mode) {
    // 各选项区 ID 后缀映射
    var ratioId = panelPrefix + 'RatioOpts';
    var resId   = panelPrefix + 'ResOpts';
    var syncId  = panelPrefix + 'SyncOpts';
    var durId   = panelPrefix + 'DurOpts';
    var countId = panelPrefix + 'CountOpts';

    // 默认全部显示
    var show = { ratio: true, res: true, sync: true, dur: true, count: true };

    if (mode === 'voice-dub' || mode === 'voice-clone') {
      // 配音模式：只显示数量
      show.ratio = false; show.res = false; show.sync = false; show.dur = false;
    } else if (mode === 'music-text' || mode === 'music-cover') {
      // 音乐模式：只显示数量
      show.ratio = false; show.res = false; show.sync = false; show.dur = false;
    } else if (mode === 'text2img' || mode === 'imgblend' || mode === 'char-img') {
      // 图片模式：无音画同步、无时长
      show.sync = false; show.dur = false;
    }
    // 视频模式(vid-*)保持全显示

    if ($(ratioId)) $(ratioId).closest('.ms-rp-section').style.display = show.ratio ? '' : 'none';
    if ($(resId))   $(resId).closest('.ms-rp-section').style.display = show.res ? '' : 'none';
    if ($(syncId))  $(syncId).closest('.ms-rp-section').style.display = show.sync ? '' : 'none';
    if ($(durId))   $(durId).closest('.ms-rp-section').style.display = show.dur ? '' : 'none';
    // 数量始终显示
  }

  let msShotIndex = -1;
  let msCurrentProvider = '';
  let msCurrentMode = 'text2img';
  let msCurrentModel = '';

  /** 打开素材制作工作台 */
  function openMaterialStudio(shotIdx) {
    msShotIndex = shotIdx;
    const shot = studio.storyboard[shotIdx];
    if (!shot) return;

    $('msShotBadge').textContent = '第 ' + (shotIdx + 1) + ' 镜';
    $('msTitle').textContent = '素材制作工作台';
    // 将分镜画面描述填入画面描述输入框
    $('msSceneDesc').value = shot.scene || '';

    renderMSApplied(shot.materials || []);

    // 重置画布
    $('msCanvasEmpty').style.display = '';
    $('msCanvasImg').style.display = 'none';

    // 更新底部摘要标签
    updateMSSummary();

    $('materialStudioBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    RF.toast('已打开第 ' + (shotIdx + 1) + ' 镜的素材制作工作台', 'ok');
  }

  /** 关闭素材制作工作台 */
  function closeMaterialStudio() {
    $('materialStudioBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    msShotIndex = -1;
    renderBoardTable();
  }

  function renderMSApplied(materials) {
    const grid = $('msAppliedGrid');
    const empty = $('msAppliedEmpty');
    if (!materials || !materials.length) { grid.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    grid.innerHTML = materials.map((m, i) => `
      <div class="ms-thumb-item selected" data-ms-i="${i}">
        <img src="${esc(m)}" onerror="this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#4b5068;padding:12px\\'>加载失败</span>'" />
        <span class="ms-thumb-check">✓</span>
      </div>`).join('');
  }

  /** 更新底部摘要标签 */
  function updateMSSummary() {
    const tag = $('msSummaryTag');
    if (!tag) return;
    // 从联动面板读取当前模型名
    var modelName = '';
    var activeModelOpt = $('msModelOpts') ? $('msModelOpts').querySelector('.rp-model-opt.active') : null;
    if (activeModelOpt) { modelName = activeModelOpt.textContent.trim(); }
    else {
      var models = getMPMModels(msCurrentMode, msCurrentProvider);
      var m = models.find(function(x) { return x.id === msCurrentModel; });
      modelName = m ? m.name : (models[0] ? models[0].name : 'Seedream 5.0 Pro');
    }
    const activeRatio = getActiveOpt('msRatioOpts') || '16:9';
    const activeRes = getActiveOpt('msResOpts') || '1080p';
    const activeDur = getActiveOpt('msDurOpts') || '5s';
    const activeCount = getActiveOpt('msCountOpts') || '1条';
    tag.textContent = modelName + ' · ' + activeRatio + ' · ' + activeRes + ' · ' + activeDur + ' · ' + activeCount;
  }

  /** 获取某选项组当前激活值（支持 ID 字符串或 DOM 元素） */
  function getActiveOpt(containerIdOrEl) {
    const container = typeof containerIdOrEl === 'string' ? $(containerIdOrEl) : containerIdOrEl;
    if (!container) return null;
    const active = container.querySelector('.ms-rp-opt.active');
    return active ? active.textContent.trim() : null;
  }

  function wireMaterialStudio() {
    // 返回按钮
    $('msBackBtn').addEventListener('click', closeMaterialStudio);
    $('materialStudioBackdrop').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeMaterialStudio();
    });

    // ===== 左侧分类导航 =====
    // 主分类展开/收起
    document.querySelectorAll('#msNavList .ms-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const group = item.closest('.ms-nav-group');
        const subId = group ? group.dataset.group : null;
        const subEl = subId ? $('msSub_' + subId) : null;

        // 切换当前组展开状态
        const wasActive = item.classList.contains('active');

        // 收起所有其他组
        document.querySelectorAll('#msNavList .ms-nav-group').forEach(g => {
          g.querySelector('.ms-nav-item').classList.remove('active');
          const s = g.querySelector('.ms-nav-sub');
          if (s) s.style.display = 'none';
        });

        // 切换本组
        if (!wasActive && subEl) {
          item.classList.add('active');
          subEl.style.display = '';
        }
      });
    });

    // 子菜单切换
    document.querySelectorAll('#msNavList .ms-nav-sub-item').forEach(subItem => {
      subItem.addEventListener('click', () => {
        const sub = subItem.closest('.ms-nav-sub');
        if (!sub) return;
        sub.querySelectorAll('.ms-nav-sub-item').forEach(s => s.classList.remove('active'));
        subItem.classList.add('active');
        // 更新当前模式并联动右侧面板
        msCurrentMode = subItem.dataset.sub || 'text2img';
        var result = refreshRightPanel('ms', msCurrentMode, msCurrentProvider, function(mode, prov, mid, mName) {
          msCurrentProvider = prov;
          updateMSSummary();
        });
        msCurrentProvider = result.provId;
      });
    });

    // ===== 右侧配置面板选项 =====
    wireRightPanelOptions('msRightPanel', updateMSSummary);
    // 初始化联动面板（模式+供应商→模型）
    var msInit = refreshRightPanel('ms', msCurrentMode, msCurrentProvider, function(mode, prov, mid, mName) {
      msCurrentProvider = prov;
      msCurrentModel = mid;
      updateMSSummary();
    });
    msCurrentProvider = msInit.provId;
    msCurrentModel = msInit.modelId;

    // ===== 底部工具栏原有功能 =====
    $('msSearchBtn').addEventListener('click', () => {
      const input = $('msSearchInput');
      input.style.display = input.style.display === 'none' ? '' : 'none';
      if (input.style.display !== 'none') input.focus();
    });
    $('msGridViewBtn').addEventListener('click', () => { $('msGridViewBtn').classList.add('active'); $('msListViewBtn').classList.remove('active'); });
    $('msListViewBtn').addEventListener('click', () => { $('msListViewBtn').classList.add('active'); $('msGridViewBtn').classList.remove('active'); });
    $('msSaveBtn').addEventListener('click', () => RF.toast('素材已保存到当前镜头', 'ok'));
    $('msStarBtn').addEventListener('click', () => RF.toast('已收藏此镜头素材集', 'ok'));
    $('msCopyBtn').addEventListener('click', () => RF.toast('已复制素材引用信息', 'ok'));
    $('msDownloadBtn').addEventListener('click', () => RF.toast('下载功能：将打包所有素材（演示占位）', 'ok'));

    // ===== 生成按钮 =====
    $('msGenerateBtn').addEventListener('click', () => {
      if (msShotIndex < 0) return;
      const mode = 'text2img'; // 默认文生图（模式选择已在左侧导航）
      const shot = studio.storyboard[msShotIndex];
      const prompt = (shot.scene || '') + (shot.dialogue ? ' | 台词：' + shot.dialogue : '');
      if (!prompt.trim()) { RF.toast('该镜头暂无画面描述，请先填写分镜内容', 'err'); return; }

      $('msGenerateBtn').disabled = true;
      $('msGenerateBtn').innerHTML = '<span class="ms-gen-icon">⏳</span> 生成中…';

      setTimeout(() => {
        const colors = ['#6d5efc','#d946a6','#16a34a','#f59e0b','#0ea5e9','#ec4899'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const canvas = document.createElement('canvas');
        canvas.width = 720; canvas.height = 405;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 720, 405);
        grad.addColorStop(0, color); grad.addColorStop(1, shadeColor(color, -30));
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 720, 405);
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        const label = (mode === 'text2img' ? '文生图' : mode) + ' · 第' + (msShotIndex+1) + '镜';
        ctx.fillText(label, 360, 190);
        ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillText(prompt.slice(0, 50), 360, 225);

        const dataUrl = canvas.toDataURL();
        $('msCanvasEmpty').style.display = 'none';
        const imgEl = $('msCanvasImg');
        imgEl.src = dataUrl; imgEl.style.display = '';

        if (!studio.storyboard[msShotIndex].materials)
          studio.storyboard[msShotIndex].materials = [];
        studio.storyboard[msShotIndex].materials.push(dataUrl);

        renderMSApplied(studio.storyboard[msShotIndex].materials);

        $('msGenerateBtn').disabled = false;
        $('msGenerateBtn').innerHTML = '<span class="ms-gen-icon">✨</span> 生成';
        RF.toast('素材已生成并应用到当前镜头（演示模式）', 'ok');
      }, 1800);
    });

    // ===== 画面描述输入区 =====
    $('msDescClear').addEventListener('click', () => { $('msSceneDesc').value = ''; });
    $('msDescCollapse').addEventListener('click', () => {
      const input = $('msSceneDescInput');
      input.style.display = input.style.display === 'none' ? '' : 'none';
    });
    $('msDescSearch').addEventListener('click', () => RF.toast('搜索参考素材库（演示占位）', 'ok'));
    $('msDescPreset').addEventListener('click', () => {
      // 根据前序步骤数据（剧本/人物/场景/道具/当前分镜）智能组合画面描述预设
      const shot = msShotIndex >= 0 ? studio.storyboard[msShotIndex] : null;
      const parts = [];

      // 1) 当前分镜画面内容与台词
      if (shot && shot.scene) parts.push(shot.scene);
      if (shot && shot.dialogue) parts.push('台词/旁白：' + shot.dialogue);

      // 2) 出镜人物信息
      if (studio.characters && studio.characters.length) {
        const charInfos = studio.characters.map(c =>
          (c.name || '角色') + (c.desc ? '（' + c.desc.slice(0, 40) + '）' : '')
        );
        parts.push('出镜人物：' + charInfos.join('；'));
      }

      // 3) 拍摄场景环境
      if (studio.scenes && studio.scenes.length) {
        const sceneInfos = studio.scenes.map(s =>
          (s.name || '场景') + (s.desc ? '：' + s.desc.slice(0, 35) : '')
        );
        parts.push('场景环境：' + sceneInfos.join('；'));
      }

      // 4) 关键道具
      if (studio.props && studio.props.length) {
        const propNames = studio.props.map(p => p.name || '道具').join('、');
        parts.push('关键道具：' + propNames);
      }

      // 5) 视觉风格
      const style = studio.production.style || ($('themeStyle') ? $('themeStyle').value : '') || '';
      if (style) parts.push('整体风格：' + style);

      // 6) 景别 / 运动 / 角度（取自当前分镜表格中的值）
      if (shot) {
        const sizeTerms = { '特写': '特写镜头', '大特写': '大特写', '近景': '近景', '中景': '中景构图', '全景': '全景展现', '远景': '远景', '大远景': '大远景' };
        const moveTerms = { '固定': '固定机位', '推': '缓慢推进', '拉': '缓慢后拉', '摇': '摇镜扫过', '移': '横移跟拍', '跟': '跟随运动', '升': '升降镜头', '俯仰': '俯仰变化', '环绕': '环绕拍摄' };
        const angleTerms = { '平拍': '平视角度', '俯拍': '俯视角度', '仰拍': '仰视角度', '鸟瞰': '鸟瞰视角', '倾斜': '倾斜构图' };
        const cam = [];
        if (shot.shot_size && sizeTerms[shot.shot_size]) cam.push(sizeTerms[shot.shot_size]);
        if (shot.movement && moveTerms[shot.movement]) cam.push(moveTerms[shot.movement]);
        if (shot.angle && angleTerms[shot.angle]) cam.push(angleTerms[shot.angle]);
        if (cam.length) parts.push('镜头语言：' + cam.join('，'));
      }

      // 组合并填入描述框
      const composed = parts.join('\n');
      const ta = $('msSceneDesc');
      if (ta) {
        ta.value = composed;
        // 同步回当前分镜数据
        if (shot) shot.scene = composed;
        RF.toast('已根据前序步骤数据生成预设描述（' + parts.length + ' 项）', 'ok');
      }
    });
    $('msDescMagic').addEventListener('click', () => {
      const ta = $('msSceneDesc');
      if (ta.value.trim()) RF.toast('智能优化：已润色画面描述语言（演示占位）', 'ok'); else RF.toast('请先输入画面描述内容', 'err');
    });
    $('msDescVoice').addEventListener('click', () => RF.toast('语音输入功能（演示占位）', 'ok'));

    // ===== 画面描述与分镜表格实时双向同步 =====
    let msDescSyncTimer = null;
    $('msSceneDesc').addEventListener('input', () => {
      if (msDescSyncTimer) clearTimeout(msDescSyncTimer);
      msDescSyncTimer = setTimeout(() => {
        if (msShotIndex >= 0 && studio.storyboard[msShotIndex]) {
          studio.storyboard[msShotIndex].scene = $('msSceneDesc').value;
          syncShotRowText(msShotIndex, $('msSceneDesc').value);
        }
      }, 300);
    });
  }

  /** 右侧面板选项通用绑定 */
  function wireRightPanelOptions(panelId, onChange) {
    const panel = $(panelId);
    if (!panel) return;
    panel.querySelectorAll('.ms-rp-options').forEach(group => {
      group.querySelectorAll('.ms-rp-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          group.querySelectorAll('.ms-rp-opt').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          if (onChange) onChange();
        });
      });
    });
  }

  // ==================== 人物主题工作台（第三步） ====================
  let csCharIndex = -1;

  function openCharStudio(charIdx) {
    csCharIndex = charIdx;
    const chars = studio.characters || [];
    const char = charIdx >= 0 && chars[charIdx] ? chars[charIdx] : null;

    $('csTitle').textContent = '人物管理工作台';
    if (char) {
      $('csCharName').textContent = char.name || '未命名人物';
      $('csCharDesc').textContent = char.desc || '暂无主体设定描述';
      $('csSceneDesc').value = (char.role || '') + '：' + (char.desc || '');
    } else {
      $('csCharName').textContent = '未命名人物';
      $('csCharDesc').textContent = '暂无主体设定描述';
      $('csSceneDesc').value = '';
    }

    renderCSCharList();
    resetCSCanvas();

    // 更新人物工作室摘要
    updateCSSummary();

    $('charStudioBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    RF.toast('已打开人物管理工作台', 'ok');
  }

  function closeCharStudio() {
    $('charStudioBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    csCharIndex = -1;
    renderCharCards(); // 刷新卡片
  }

  function resetCSCanvas() {
    $('csCanvasEmpty').style.display = '';
    $('csCanvasImg').style.display = 'none';
  }

  function renderCSCharList() {
    const list = $('csCharList');
    const empty = $('csEmptyHint');
    const chars = studio.characters || [];

    if (!chars.length) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = chars.map((c, i) => `
      <div class="cs-char-list-item ${i === csCharIndex ? 'active' : ''}" data-csi="${i}">
        <span class="cs-char-icon">👤</span>
        <span class="cs-char-item-name">${esc(c.name || '未命名人物')}</span>
        <span class="cs-pending-tag">主图待设定</span>
      </div>`).join('');

    // 绑定点击选择事件
    list.querySelectorAll('.cs-char-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.csi, 10);
        csCharIndex = idx;
        const c = chars[idx];
        $('csCharName').textContent = c.name || '未命名人物';
        $('csCharDesc').textContent = c.desc || '暂无主体设定描述';
        $('csSceneDesc').value = (c.role || '') + '：' + (c.desc || '');
        renderCSCharList();
        resetCSCanvas();
      });
    });
  }

  function updateCSSummary() {
    const tag = $('csSummaryTag');
    if (!tag) return;
    var modelName = '';
    var activeModelOpt = $('csModelOpts') ? $('csModelOpts').querySelector('.rp-model-opt.active') : null;
    if (activeModelOpt) { modelName = activeModelOpt.textContent.trim(); }
    else {
      var models = getMPMModels('char-img', csCurrentProvider);
      var m = models.find(function(x) { return x.id === csCurrentModel; });
      modelName = m ? m.name : (models[0] ? models[0].name : 'Seedream 5.0 Pro');
    }
    const ratio = getActiveOpt('csRatioOpts') || '16:9';
    const res = getActiveOpt('csResOpts') || '720p';
    const count = getActiveOpt('csCountOpts') || '1张';
    tag.textContent = modelName + ' · ' + ratio + ' · ' + res + ' · ' + count;
  }

  function wireCharStudio() {
    $('csBackBtn').addEventListener('click', closeCharStudio);
    $('charStudioBackdrop').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeCharStudio();
    });

    // 新建造型 / 上传造型
    $('csNewStyleBtn').addEventListener('click', () => RF.toast('新建造型功能：可添加新的角色外观设定（演示占位）', 'ok'));
    $('csUploadStyleBtn').addEventListener('click', () => RF.toast('上传造型功能：上传参考图片作为新造型基础（演示占位）', 'ok'));

    // 视图切换
    $('csGridViewBtn').addEventListener('click', () => { $('csGridViewBtn').classList.add('active'); $('csListViewBtn').classList.remove('active'); });
    $('csListViewBtn').addEventListener('click', () => { $('csListViewBtn').classList.add('active'); $('csGridViewBtn').classList.remove('active'); });

    // 保存 / AI 生成
    $('csSaveBtn').addEventListener('click', () => RF.toast('人物设定已保存', 'ok'));
    $('csAiGenBtn').addEventListener('click', () => runGenerator(2)); // 复用 Step 2 的生成器

    // 右侧面板选项
    wireRightPanelOptions('csRightPanel', updateCSSummary);
    // 初始化联动面板（人物参图模式，自动选第一个已接入的图像模型供应商）
    var csInit = refreshRightPanel('cs', 'char-img', '', function(mode, prov, mid, mName) {
      csCurrentProvider = prov;
      csCurrentModel = mid;
      updateCSSummary();
    });
    var csCurrentProvider = csInit.provId;
    var csCurrentModel = csInit.modelId;

    // 生成按钮
    $('csGenerateBtn').addEventListener('click', () => {
      if (csCharIndex < 0 && (!studio.characters || !studio.characters.length)) {
        RF.toast('请先添加或选择一个人物', 'err'); return;
      }
      const mode = 'text2img'; // 默认文生图（模式选择已在左侧导航）
      $('csGenerateBtn').disabled = true;
      $('csGenerateBtn').innerHTML = '<span class="ms-gen-icon">⏳</span> 生成中…';

      setTimeout(() => {
        const colors = ['#7c5cff','#ff4d9d','#059669'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
        grad.addColorStop(0, shadeColor(color, 20));
        grad.addColorStop(1, color);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(mode + ' · 人物形象', 256, 248);

        const dataUrl = canvas.toDataURL();
        $('csCanvasEmpty').style.display = 'none';
        const imgEl = $('csCanvasImg');
        imgEl.src = dataUrl; imgEl.style.display = '';

        // 保存图片到当前角色
        if (csCharIndex >= 0 && studio.characters[csCharIndex]) {
          studio.characters[csCharIndex].image_url = dataUrl;
        } else if (studio.characters.length > 0) {
          studio.characters[0].image_url = dataUrl;
        }

        $('csGenerateBtn').disabled = false;
        $('csGenerateBtn').innerHTML = '<span class="ms-gen-icon">✨</span> 生成';
        RF.toast('人物形象已生成（演示模式）', 'ok');
      }, 1500);
    });

    // ===== 画面描述输入区 =====
    $('csDescClear').addEventListener('click', () => { $('csSceneDesc').value = ''; });
    $('csDescCollapse').addEventListener('click', () => {
      const input = $('csSceneDescInput');
      input.style.display = input.style.display === 'none' ? '' : 'none';
    });
    $('csDescSearch').addEventListener('click', () => RF.toast('搜索参考素材库（演示占位）', 'ok'));
    $('csDescPreset').addEventListener('click', () => RF.toast('选择人物描述预设模板（演示占位）', 'ok'));
    $('csDescMagic').addEventListener('click', () => {
      const ta = $('csSceneDesc');
      if (ta.value.trim()) RF.toast('智能优化：已润色人物形象描述（演示占位）', 'ok'); else RF.toast('请先输入人物形象描述内容', 'err');
    });
    $('csDescVoice').addEventListener('click', () => RF.toast('语音输入功能（演示占位）', 'ok'));
    // 人物工作台画面描述 → 自动保存
    $('csSceneDesc').addEventListener('input', debounceAutoSave);
  }

  function shadeColor(color, percent) {
    const num = parseInt(color.replace('#',''), 16),
          amt = Math.round(2.55 * percent),
          R = Math.max(0, Math.min(255, (num >> 16) + amt)),
          G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt)),
          B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + ((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1);
  }
  function handleScriptUpload(file) {
    if (!file) return;
    const info = $('scriptFileInfo');
    const nameEl = $('scriptFileName');
    const previewEl = $('scriptUploadText');
    if (info) info.style.display = '';
    if (nameEl) nameEl.textContent = file.name + ' (' + Math.round(file.size / 1024) + 'KB)';
    // 读取文本文件内容（演示用）
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = () => {
        studio.script = reader.result;
        if (previewEl) previewEl.value = reader.result;
        $('scriptPreview').value = reader.result;
        RF.toast('剧本文件已加载', 'ok');
      };
      reader.readAsText(file);
    } else {
      // 非 txt 文件演示占位
      studio.script = '[已上传: ' + file.name + '] 请在此处粘贴或编辑剧本内容。';
      if (previewEl) previewEl.value = studio.script;
      $('scriptPreview').value = studio.script;
      RF.toast('文件已上传（非纯文本请手动编辑内容）', 'ok');
    }
  }

  // ---------- 启动 ----------
  (async function init() {
    if (!(await ensureAuth())) return;
    const id = getParam('id');
    if (!id) { $('projTitle').textContent = '缺少项目 ID'; return; }
    const { ok, data } = await RF.api('GET', '/projects/' + id);
    if (!ok || !data.project) { $('projTitle').textContent = '未找到该项目'; return; }
    proj = data.project;
    studio = mergeStudio(proj.meta && proj.meta.studio);
    // 系统仅保留一键生成模式
    mode = 'quick';
    // 把新建时填写的「一句话需求」自动带入第一步
    if (!studio.requirement.text && proj.prompt) {
      studio.requirement.text = proj.prompt;
    }

    await loadModelCatalog();
    ensureModelDefaults();

    $('projTitle').textContent = proj.title;
    $('projSub').textContent = '类型：' + (proj.type || '') + ' · 由你接入的大模型 API 制作';
    const hint = $('importHint');
    if (hint) {
      hint.style.display = 'none';
      hint.textContent = '';
    }
    fillDom();
    renderModeBanner();
    applyModeUI();
    wire();
  })();
})();
