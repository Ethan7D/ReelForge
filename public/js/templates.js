/* ===========================================================================
   ReelForge -- 模板数据（垂直行业：短剧文旅 / 电商带货 / 企业品牌）
   每个模板 = 一份完整的预置 studio JSON
   =========================================================================== */
window.ReelForgeTemplates = [
  // ======================== 短剧文旅 ========================
  {
    id: 'tourism_ancient_town',
    category: 'tourism',
    categoryLabel: '短剧文旅',
    name: '3天2夜·古镇风味',
    desc: '航拍古镇全景 + 街头美食特写 + 非遗手艺展示，30秒宣传微短剧',
    duration: 30,
    ratio: '16:9',
    tags: ['古镇', '美食', '非遗', '慢生活'],
    thumbnail: '/img/templates/ancient-town.svg',
    studio: {
      requirement: { text: '地方文旅宣传：展示古镇的自然风光、地方美食和非遗文化，吸引周边城市游客前来体验"慢生活"。', tone: '温暖治愈', audience: '25-45岁城市居民', duration: '30', ratio: '16:9', mood: '国风', voice: '女声', music: '国风' },
      script: '00:00-00:05 航拍古镇全景 | 缓缓推入，晨雾中的青石板路和红灯笼\n00:05-00:10 街头美食特写 | 阿姨正在制作传承四代人的特色小吃\n00:10-00:15 食客品尝 | 游客咬下第一口的满足表情\n00:15-00:20 非遗手艺 | 老匠人在手工制作当地传统工艺品\n00:20-00:25 夜景收尾 | 灯笼渐次亮起，古镇换上新装\n00:25-00:30 结尾 | 文字"山海之间，慢享时光"淡出',
      characters: [
        { id: 'c1', name: '本地导游', desc: '30岁男性，短发精干，穿着素雅棉麻服装，亲和力强，有书卷气', role: '主线出镜+配音' },
        { id: 'c2', name: '手艺人', desc: '65岁男性非遗传承人，银发、穿着传统工作服，专注手中的工艺', role: '第四镜出镜' }
      ],
      scenes: [
        { id: 's1', name: '古镇全景', desc: '清晨薄雾中的江南古镇，青石板路、红灯笼、马头墙、小桥流水' },
        { id: 's2', name: '老字号小吃店', desc: '木质招牌、蒸汽缭绕、食客排队、锅铲翻炒的画面' },
        { id: 's3', name: '非遗工坊', desc: '传统木结构作坊，工具墙上挂满手工器具，老匠人在窗光下专注工作' },
        { id: 's4', name: '古镇夜景', desc: '天色渐暗，灯笼依次亮起，暖黄光映在石板路上，水面倒影' }
      ],
      storyboard: [
        { scene: '航拍古镇全景，晨雾中缓缓推入', shot_size: '远景', movement: '推', angle: '鸟瞰', dialogue: '在离城市两小时车程的地方，藏着一座三百年时光的古镇。', duration: 5,
          slots: [{ id: 'aerial1', label: '航拍素材', type: 'video', hint: '上传无人机航拍或城市宣传片片段（5s）', required: false, category: 'scene' }] },
        { scene: '街头美食特写：阿姨制作特色小吃', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '一份传承了四代人的小吃，每一口都是时间的味道。', duration: 5,
          slots: [{ id: 'food1', label: '美食特写', type: 'image', hint: '上传地方特色美食高清照片', required: false, category: 'scene' }] },
        { scene: '游客品尝美食的满足表情', shot_size: '近景', movement: '固定', angle: '平拍', dialogue: '', duration: 5,
          slots: [{ id: 'taste1', label: '品尝镜头', type: 'image', hint: '上传食客品尝/微笑的照片或短视频', required: false, category: 'character' }] },
        { scene: '老匠人在窗光下专注手工制作', shot_size: '中景', movement: '推', angle: '平拍', dialogue: '还有即将失传的老手艺，每一下敲打都是岁月的回响。', duration: 5,
          slots: [{ id: 'craft1', label: '手艺展示', type: 'image', hint: '上传本地非遗手工艺的制作照片', required: false, category: 'character' }] },
        { scene: '灯笼渐次亮起，古镇夜景', shot_size: '全景', movement: '拉', angle: '平拍', dialogue: '', duration: 5,
          slots: [{ id: 'night1', label: '夜景素材', type: 'image', hint: '上传古镇/景点的夜间照片', required: false, category: 'scene' }] },
        { scene: '文字淡出：山海之间，慢享时光', shot_size: '全景', movement: '固定', angle: '平拍', dialogue: '山海之间，慢享时光。', duration: 5, slots: [] }
      ],
      production: { style: '16:9 横屏 · 电影感 · 温暖色调', note: '用户素材将替换对应镜头的AI生成画面' }
    }
  },
  {
    id: 'tourism_mountain',
    category: 'tourism',
    categoryLabel: '短剧文旅',
    name: '云上秘境·山居日记',
    desc: '高山茶园+云海日出+民宿体验，45秒沉浸式山居宣传',
    duration: 45,
    ratio: '16:9',
    tags: ['山林', '茶园', '民宿', '云海'],
    thumbnail: '/img/templates/mountain.svg',
    studio: {
      requirement: { text: '山区民宿宣传：展示高山茶园的绝美风光、精品民宿的居住体验和周边户外活动，吸引城市中产前来度假。', tone: '宁静治愈', audience: '30-50岁中产家庭', duration: '45', ratio: '16:9', mood: '治愈', voice: '女声', music: '舒缓' },
      script: '00:00-00:08 云海日出延时 | 群山之巅，第一缕阳光穿透云海\n00:08-00:15 茶园航拍 | 采茶人在翠绿茶垄间穿行\n00:15-00:22 民宿外景+内景 | 推开木窗即是满眼绿色\n00:22-00:30 在地体验 | 山泉煮茶、柴火灶晚餐\n00:30-00:38 户外活动 | 徒步竹林、溪涧戏水\n00:38-00:45 结尾 | 星空下的篝火，文字"另一种生活"',
      characters: [
        { id: 'c1', name: '民宿主人', desc: '35岁女性，由城市返乡创业，干练而温暖，穿着棉麻围裙', role: '出镜+配音' },
        { id: 'c2', name: '茶农', desc: '50岁本地茶农，戴竹斗笠，在茶园中采摘鲜叶', role: '第二镜出镜' }
      ],
      scenes: [
        { id: 's1', name: '山顶日出', desc: '海拔800米山顶，金色阳光穿透白色云海，远山层峦叠嶂' },
        { id: 's2', name: '高山茶园', desc: '翠绿的梯田式茶园，晨露在茶叶上闪闪发光' },
        { id: 's3', name: '精品民宿', desc: '原木+落地窗设计的山间独栋民宿，窗外即是连绵山景' },
        { id: 's4', name: '竹林小径', desc: '幽静的竹林步道，阳光透过竹叶洒下斑驳光影' }
      ],
      storyboard: [
        { scene: '云海日出延时，阳光穿破云层', shot_size: '远景', movement: '固定', angle: '平拍', dialogue: '在城市待久了，总会想念一种声音——山风穿过竹林的声音。', duration: 8,
          slots: [{ id: 'cloud1', label: '云海/日出素材', type: 'video', hint: '上传云海日出延时视频（8s）', required: false, category: 'scene' }] },
        { scene: '茶农在翠绿茶园中采摘', shot_size: '全景', movement: '移', angle: '平拍', dialogue: '在这里，最奢侈的事情是花一整个上午，只为一杯茶。', duration: 7,
          slots: [{ id: 'tea1', label: '茶园素材', type: 'image', hint: '上传茶园/采茶的高清照片', required: false, category: 'scene' }] },
        { scene: '民宿外观+室内陈设展示', shot_size: '中景', movement: '推', angle: '平拍', dialogue: '而晚上，你会拥有一整片星空，和一首虫鸣编织的摇篮曲。', duration: 7,
          slots: [{ id: 'bnb1', label: '民宿外景', type: 'image', hint: '上传民宿外观/房间照片', required: false, category: 'scene' }, { id: 'bnb2', label: '民宿内景', type: 'image', hint: '上传房间/公共区域照片', required: false, category: 'scene' }] },
        { scene: '柴火灶、山泉煮茶等体验', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '', duration: 8,
          slots: [{ id: 'food2', label: '在地美食', type: 'image', hint: '上传当地特色餐食照片', required: false, category: 'scene' }] },
        { scene: '徒步竹林、溪涧戏水', shot_size: '全景', movement: '跟', angle: '平拍', dialogue: '', duration: 8,
          slots: [{ id: 'hike1', label: '户外活动', type: 'image', hint: '上传徒步/戏水/户外活动照片', required: false, category: 'character' }] },
        { scene: '星空篝火，文字淡出', shot_size: '全景', movement: '固定', angle: '平拍', dialogue: '来山里吧。过另一种生活。', duration: 7, slots: [] }
      ],
      production: { style: '16:9 横屏 · 治愈系 · 高饱和度自然色', note: '用户素材将替换对应镜头的画面' }
    }
  },
  {
    id: 'tourism_foodstreet',
    category: 'tourism',
    categoryLabel: '短剧文旅',
    name: '寻味之旅·深夜食堂',
    desc: '城市美食街探店 + 夜市烟火气 + 食客故事，30秒城市美食名片',
    duration: 30,
    ratio: '9:16',
    tags: ['美食', '夜市', '探店', '竖屏'],
    thumbnail: '/img/templates/foodstreet.svg',
    studio: {
      requirement: { text: '城市美食名片：拍摄本地最有人气的深夜美食街区，展示各摊位招牌菜和市井烟火气，适合社交平台竖屏传播。', tone: '烟火气+食欲感', audience: '18-35岁年轻人', duration: '30', ratio: '9:16', mood: '燃', voice: '男声', music: '轻快' },
      script: '00:00-00:03 夜市全景 | 霓虹招牌亮起，人潮涌动\n00:03-00:07 烧烤摊特写 | 肉串在炭火上滋滋作响\n00:07-00:11 炒粉摊位 | 老师傅颠锅的慢动作\n00:11-00:15 甜品站 | 手工冰粉的层次感展示\n00:15-00:20 食客群像 | 不同年龄的食客满足表情\n00:20-00:25 招牌合集 | 快速切换各摊位招牌\n00:25-00:30 结尾 | 文字"今晚，你想吃哪家？"',
      characters: [
        { id: 'c1', name: '探店博主', desc: '25岁年轻美食博主，穿着时尚，手持手机或相机记录美食', role: '出镜' }
      ],
      scenes: [
        { id: 's1', name: '夜市全景', desc: '天黑后的美食步行街，霓虹灯招牌闪耀，摊位蒸汽升腾，人潮涌动' },
        { id: 's2', name: '烧烤摊', desc: '炭火旺盛的烧烤摊，肉串在火上翻烤、油脂滴落、烟雾缭绕' },
        { id: 's3', name: '小吃摊', desc: '各色小吃的特写：炒粉、煎饼、糖水、炸物等' }
      ],
      storyboard: [
        { scene: '夜市全景，人潮涌动', shot_size: '全景', movement: '拉', angle: '仰拍', dialogue: '我们城市最野的深夜食堂，今晚带你去。', duration: 3,
          slots: [{ id: 'mkt1', label: '夜市全景', type: 'image', hint: '上传夜市/美食街全景照片', required: false, category: 'scene' }] },
        { scene: '烧烤摊特写：肉串在炭火上', shot_size: '特写', movement: '固定', angle: '俯拍', dialogue: '', duration: 4,
          slots: [{ id: 'bbq1', label: '烧烤摊', type: 'image', hint: '上传烧烤/烤串高清照片', required: false, category: 'scene' }] },
        { scene: '师傅颠锅慢动作', shot_size: '中景', movement: '固定', angle: '平拍', dialogue: '老师傅的锅，颠了三十年。', duration: 4,
          slots: [{ id: 'wok1', label: '炒菜镜头', type: 'image', hint: '上传炒菜/烹饪照片', required: false, category: 'character' }] },
        { scene: '手工冰粉层次展示', shot_size: '特写', movement: '推', angle: '俯拍', dialogue: '', duration: 4,
          slots: [{ id: 'ice1', label: '甜品/冰品', type: 'image', hint: '上传甜品或饮品照片', required: false, category: 'scene' }] },
        { scene: '食客群像：不同年龄满足表情', shot_size: '近景', movement: '固定', angle: '平拍', dialogue: '你看他们的表情——就知道没来错。', duration: 5,
          slots: [{ id: 'ppl1', label: '食客镜头', type: 'image', hint: '上传食客用餐/满意的照片', required: false, category: 'character' }] },
        { scene: '快速切换各摊位招牌', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '', duration: 5,
          slots: [{ id: 'sign1', label: '招牌特写', type: 'image', hint: '上传店铺招牌/门头照片', required: false, category: 'scene' }] },
        { scene: '结尾文字淡出', shot_size: '全景', movement: '拉', angle: '平拍', dialogue: '今晚，你想吃哪家？', duration: 5, slots: [] }
      ],
      production: { style: '9:16 竖屏 · 高饱和度 · 食欲色彩', note: '适合抖音/小红书竖屏传播' }
    }
  },
  // ======================== 电商带货 ========================
  {
    id: 'ecom_product_showcase',
    category: 'ecommerce',
    categoryLabel: '电商带货',
    name: '爆品30秒·成分党种草',
    desc: '产品特写+成分解析+使用对比+限时优惠，30秒带货短视频',
    duration: 30,
    ratio: '9:16',
    tags: ['种草', '美妆', '成分党', '竖屏'],
    thumbnail: '/img/templates/ecom-product.svg',
    studio: {
      requirement: { text: '电商带货短视频：展示一款护肤品的核心成分和效果对比，突出卖点、建立信任感，促使立即下单。', tone: '专业可信+种草感', audience: '25-35岁女性', duration: '30', ratio: '9:16', mood: '高级感', voice: '女声', music: '轻快' },
      script: '00:00-00:03 产品外观特写 | 旋转展示包装质感\n00:03-00:08 核心成分 | 成分来源和科技力量\n00:08-00:13 使用对比 | 14天前后效果对比\n00:13-00:18 博主试用 | 上脸推开的清爽质地\n00:18-00:23 好评截图 | 真实用户好评轮播\n00:23-00:30 优惠+下单 | 价格+赠品+下单引导',
      characters: [
        { id: 'c1', name: '带货博主', desc: '28岁女性，皮肤自然清透，穿着简约时尚', role: '出镜+讲解' }
      ],
      scenes: [
        { id: 's1', name: '产品摄影棚', desc: '纯白极简背景，柔光灯箱，产品居中旋转台展示' },
        { id: 's2', name: '实验室风格', desc: '科技感的蓝色调背景，分子结构动画叠加' },
        { id: 's3', name: '博主梳妆台', desc: '温馨自然光的居家梳妆台，镜面反光' }
      ],
      storyboard: [
        { scene: '产品旋转展示，包装特写', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '夏天最怕什么？粘腻、闷痘、搓泥。', duration: 3,
          slots: [{ id: 'prod1', label: '产品主图', type: 'image', hint: '上传产品高清主图（白底）', required: false, category: 'scene' }] },
        { scene: '核心成分解析动画', shot_size: '特写', movement: '推', angle: '平拍', dialogue: '但这瓶，用了日本百年汉方冷萃技术，把七种草本锁在一滴里。', duration: 5,
          slots: [{ id: 'comp1', label: '成分/原料图', type: 'image', hint: '上传成分原料/实验室照片', required: false, category: 'scene' }] },
        { scene: '使用前后对比', shot_size: '近景', movement: '固定', angle: '平拍', dialogue: '28天，让你的皮肤学会自己呼吸。', duration: 5,
          slots: [{ id: 'baf1', label: '使用前对比', type: 'image', hint: '上传使用前效果照', required: false, category: 'character' }, { id: 'baf2', label: '使用后对比', type: 'image', hint: '上传使用后效果照', required: false, category: 'character' }] },
        { scene: '博主试用，上脸推开', shot_size: '近景', movement: '固定', angle: '平拍', dialogue: '', duration: 5,
          slots: [{ id: 'try1', label: '试用镜头', type: 'image', hint: '上传博主试用/上脸照片', required: false, category: 'character' }] },
        { scene: '用户好评截图轮播', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '已经卖爆了3万瓶，他们都在用。', duration: 5,
          slots: [{ id: 'rvw1', label: '好评截图', type: 'image', hint: '上传用户好评/评论截图', required: false, category: 'scene' }] },
        { scene: '限时优惠+下单引导', shot_size: '特写', movement: '固定', angle: '平拍', dialogue: '今天直播间专属价199，还加送旅行套装。点击下方小黄车！', duration: 7, slots: [] }
      ],
      production: { style: '9:16 竖屏 · 高级感 · 冷白调', note: '用户素材替换对应镜头画面' }
    }
  },
  // ======================== 企业品牌 ========================
  {
    id: 'brand_story',
    category: 'brand',
    categoryLabel: '企业品牌',
    name: '品牌故事·从初心到匠心',
    desc: '创始人讲述+工厂实拍+用户见证，60秒企业品牌微纪录片',
    duration: 60,
    ratio: '16:9',
    tags: ['品牌', '创始人', '工厂', '纪录片'],
    thumbnail: '/img/templates/brand-story.svg',
    studio: {
      requirement: { text: '企业品牌宣传片：讲述品牌创立初心、生产制造过程、用户真实反馈，建立品牌信任和情感连接。', tone: '真诚纪实+大气', audience: '潜在客户+合作伙伴', duration: '60', ratio: '16:9', mood: '温情', voice: '男声', music: '史诗' },
      script: '00:00-00:08 公司大楼/门头 | 清晨第一缕阳光落在公司招牌上\n00:08-00:18 创始人讲述 | 创始人面对镜头讲述创业初心\n00:18-00:28 工厂/生产线 | 现代化生产车间运转画面\n00:28-00:38 质检/研发 | 技术人员在做精密检测\n00:38-00:48 用户场景 | 真实用户在使用产品\n00:48-00:55 团队群像 | 全体员工在厂区合影\n00:55-01:00 结尾 | 品牌Slogan + 联系方式',
      characters: [
        { id: 'c1', name: '创始人/CEO', desc: '40-50岁男性或女性，穿着商务休闲，面前镜头真诚讲述', role: '出镜讲述' }
      ],
      scenes: [
        { id: 's1', name: '公司总部', desc: '现代企业办公楼外观或门头，晨曦光线' },
        { id: 's2', name: '生产车间', desc: '整洁宽敞的现代化生产线，自动化设备运转' },
        { id: 's3', name: '研发实验室', desc: '专业实验室环境，白大褂技术人员在做精密操作' },
        { id: 's4', name: '用户使用场景', desc: '不同年龄/职业的用户在真实环境中使用产品的画面' }
      ],
      storyboard: [
        { scene: '公司大楼/门头，晨曦光线', shot_size: '全景', movement: '推', angle: '仰拍', dialogue: '每一个品牌，都有一个不为人知的故事。', duration: 8,
          slots: [{ id: 'bldg1', label: '公司外观', type: 'image', hint: '上传公司大楼/门头的高清照片', required: false, category: 'scene' }] },
        { scene: '创始人面对镜头讲述', shot_size: '近景', movement: '固定', angle: '平拍', dialogue: '十年前，我从一间出租屋开始——只想做一件真正有用的事。', duration: 10,
          slots: [{ id: 'found1', label: '创始人照片', type: 'image', hint: '上传创始人/CEO的照片', required: false, category: 'character' }] },
        { scene: '工厂/生产线运转', shot_size: '中景', movement: '移', angle: '平拍', dialogue: '现在，我们的生产线每天要运转16个小时，因为订单来自全球38个国家。', duration: 10,
          slots: [{ id: 'fact1', label: '工厂/产线', type: 'image', hint: '上传工厂或生产线的照片', required: false, category: 'scene' }] },
        { scene: '质检/研发精密检测', shot_size: '特写', movement: '推', angle: '平拍', dialogue: '每一件出厂的产品，都经过了37道质检工序。', duration: 10,
          slots: [{ id: 'qc1', label: '质检/研发', type: 'image', hint: '上传质检或研发处理照片', required: false, category: 'scene' }] },
        { scene: '用户真实使用场景', shot_size: '中景', movement: '固定', angle: '平拍', dialogue: '但最让我们骄傲的不是数据，而是这些真实的笑脸。', duration: 10,
          slots: [{ id: 'user1', label: '用户使用场景', type: 'image', hint: '上传用户使用产品的实拍照片', required: false, category: 'character' }] },
        { scene: '团队群像 + 结尾Slogan', shot_size: '全景', movement: '拉', angle: '平拍', dialogue: 'XX品牌——用心，做好每一件小事。', duration: 12, slots: [] }
      ],
      production: { style: '16:9 横屏 · 纪实风 · 暖金色调', note: '用户素材将替换对应镜头的画面' }
    }
  }
];
