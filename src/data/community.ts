import type { CommunityPost, CategoryProductPair } from '../types';

export const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    authorAlias: '离职应届生 #3901',
    authorRole: '常州星宇前员工',
    targetBrandName: '常州星宇股份',
    targetTier: 'C',
    category: 'avoid_trap',
    title: '【现场实录】四百名应届生优化事件始末：违法成本低是核心',
    content: '刚入职就遭遇单方辞退，通报虽然出了，但社保一交应届生身份真没了。大家买车灯、汽车配件时请认准正规守约企业，不要再给只顾利润践踏年轻人尊严的企业送子弹！',
    evidenceBadge: '央视网评关注事实',
    upvotes: 4280,
    repliesCount: 382,
    createdAt: '2026-09-08',
    replies: [
      {
        id: 'rep-1-1',
        author: '汽车工程打工人',
        content: '支持用脚投票！买车改装直接选欧司朗或者飞利浦，不碰这家的供应商产品。',
        createdAt: '2026-09-08 20:15'
      },
      {
        id: 'rep-1-2',
        author: '法务老鸟',
        content: '应届生黄金窗口期只有一次，这种恶意解约必须在消费端让他们付出真金白银代价。',
        createdAt: '2026-09-09 09:30'
      }
    ]
  },
  {
    id: 'post-2',
    authorAlias: '外企数码民工 #0294',
    authorRole: '前国内高压大厂，现罗技研发',
    targetBrandName: 'Logitech (罗技)',
    targetTier: 'A',
    category: 'recommend_wlb',
    title: '从 996 跳到外企外设厂，我为什么死心塌地安利罗技 MX Master？',
    content: '之前在某厂每天熬到夜里十一点，周末随时响应钉钉。来罗技两年，六点准点关灯走人，有急事找人要先看对方日历忙闲状态。给良心双休企业贡献利润，才能让我们打工人有更多好坑位！',
    evidenceBadge: '955.WLB 榜单在列',
    upvotes: 2150,
    repliesCount: 147,
    createdAt: '2026-09-07',
    replies: [
      {
        id: 'rep-2-1',
        author: '手腕酸痛程序员',
        content: '同感，Master 3S 陪伴我敲了 3 年代码，支持尊重员工下班的企业！',
        createdAt: '2026-09-07 22:40'
      }
    ]
  },
  {
    id: 'post-3',
    authorAlias: '一线咖啡师小张',
    authorRole: '前瑞幸全职伙伴',
    targetBrandName: '瑞幸咖啡 (Luckin)',
    targetTier: 'C',
    category: 'avoid_trap',
    title: '9.9 块的背后：为什么我劝朋友少点单休连锁，改买良心挂耳？',
    content: '早高峰一个人做 150 杯咖啡，掐着秒表出餐，手腕天天喷云南白药。兼职伙伴工时被切得稀碎，排班完全没生活。低价狂欢不能建立在一线伙伴的骨血透支上。',
    evidenceBadge: '一线排班表佐证',
    upvotes: 3890,
    repliesCount: 420,
    createdAt: '2026-09-06',
    replies: [
      {
        id: 'rep-3-1',
        author: '咖啡重度爱好者',
        content: '现在改在办公室自己用星巴克家享豆手冲或者买独立良心烘焙豆了，体验好得多。',
        createdAt: '2026-09-06 14:12'
      }
    ]
  },
  {
    id: 'post-4',
    authorAlias: '户外爱好者 #8812',
    authorRole: '清醒消费者',
    targetBrandName: 'Patagonia (巴塔哥尼亚)',
    targetTier: 'S',
    category: 'recommend_wlb',
    title: '不只是环保，打工人体恤衫首选 Patagonia 和迪卡侬',
    content: '衣服坏了终身免费修，创始人甚至倡导“别买这件夹克，除非你真需要”。他们办公室到点就关，连产线都有严格的公平贸易工时认证。真正把人当人看的品牌，贵一点也甘愿掏钱。',
    evidenceBadge: 'Fair Trade 认证',
    upvotes: 1840,
    repliesCount: 89,
    createdAt: '2026-09-05'
  },
  {
    id: 'post-5',
    authorAlias: '准备装修的社畜 #1024',
    authorRole: '清醒消费者',
    targetBrandName: '顾家家居 / 敏华控股',
    targetTier: 'B',
    category: 'ask_intel',
    title: '【求扒】买沙发床垫想避开单休血汗工厂，有业内员工聊聊哪家作息规范吗？',
    content: '最近看家具，听说很多大型家居制造厂一线工人月休 2 天还常态化无偿搬货。大家买家具推荐宜家还是有其他双休国货品牌？求内部打工人指路！',
    evidenceBadge: '求证悬赏中',
    upvotes: 960,
    repliesCount: 112,
    createdAt: '2026-09-04'
  }
];

export const CATEGORY_PAIRS: CategoryProductPair[] = [
  {
    id: 'pair-car-lights',
    categoryName: '汽车生活 · 车灯与改装配件',
    searchKeywords: ['车灯', 'led大灯', '汽车配件', '改装灯', '车灯总成', '星宇'],
    boycottBrand: {
      name: '常州星宇股份',
      tier: 'C',
      reason: '批量毁约校招应届生，一线产线高强度单休，劳资纠纷行政通报。',
      keyProduct: '原厂车灯配件 / 汽车车灯总成'
    },
    recommendedAlternatives: [
      {
        id: 'osram',
        name: 'OSRAM (欧司朗中国)',
        tier: 'A',
        policyLabel: '合规双休 965 / 德企严格劳资标准',
        keyProduct: '夜行者 LED 大灯 / 汽车照明配件',
        highlight: '德国百年汽车照明巨头，国内制造工厂与研发严格执行双休及法定超时补贴。'
      },
      {
        id: 'philips-auto',
        name: 'Philips (飞利浦汽车照明)',
        tier: 'A',
        policyLabel: '规范外企制度 / 无大小周',
        keyProduct: '极劲光 LED 车灯 / 汽车多功能应急电源',
        highlight: '欧系合规管理，加班有严格审批系统，不提倡任何无偿占用员工周末。'
      }
    ]
  },
  {
    id: 'pair-coffee',
    categoryName: '食品饮品 · 现磨与速溶咖啡',
    searchKeywords: ['咖啡', '拿铁', '生椰拿铁', '咖啡豆', '挂耳', '瑞幸'],
    boycottBrand: {
      name: '瑞幸咖啡 (Luckin)',
      tier: 'C',
      reason: '秒级出单考核苛刻，一线伙伴手部劳损与碎裂排班争议高发。',
      keyProduct: '生椰拿铁 / 门店现制咖啡'
    },
    recommendedAlternatives: [
      {
        id: 'starbucks-coffee',
        name: 'Starbucks (星巴克中国)',
        tier: 'A',
        policyLabel: '伙伴文化 / 工时池严格打卡封顶',
        keyProduct: '家享黑咖啡豆 / 门店经典美式',
        highlight: '系统精确记录每一分钟排班，全额缴纳五险一金并为员工父母提供大病医保。'
      },
      {
        id: 'pepsi-drinks',
        name: '百事食品 (桂格 / 乐事)',
        tier: 'A',
        policyLabel: '外企合规双休 / 零食生活良品',
        keyProduct: '桂格黑咖啡代餐燕麦 / 零食',
        highlight: '成熟的跨国快消管理体系，周末双休保障到位，注重基层生产生活平衡。'
      }
    ]
  },
  {
    id: 'pair-digital-peripherals',
    categoryName: '数码3C · 键盘鼠标与外设',
    searchKeywords: ['鼠标', '键盘', '无线鼠标', '机械键盘', '摄像头', '外设'],
    boycottBrand: {
      name: '某代工单休外设工厂品牌',
      tier: 'C',
      reason: '注塑与组装产线两班倒常态化单休，离职率居高不下。',
      keyProduct: '低价走量杂牌键鼠'
    },
    recommendedAlternatives: [
      {
        id: 'logitech',
        name: 'Logitech (罗技)',
        tier: 'A',
        policyLabel: '瑞士外企 965 双休标杆',
        keyProduct: 'MX Master 3S 人体工学办公鼠标 / 机械键盘',
        highlight: '长期位列 955.WLB 榜单，弹性不打卡，年假充沛，程序员极客标配。'
      },
      {
        id: 'apple-consumer',
        name: 'Apple (妙控键盘与外设)',
        tier: 'S',
        policyLabel: '顶格合规 / 办公室严格双休',
        keyProduct: 'Magic Trackpad 触控板 / 键盘',
        highlight: '全球劳工审计严苛，直营店与研发团队福利健全，打工人的靠谱生产力工具。'
      }
    ]
  },
  {
    id: 'pair-outdoor-wear',
    categoryName: '服装饰品 · 冲锋衣与日常运动鞋服',
    searchKeywords: ['冲锋衣', '抓绒衣', '防晒衣', '运动鞋', '优衣库', '巴塔'],
    boycottBrand: {
      name: '部分快时尚极速翻单血汗工厂',
      tier: 'C',
      reason: '为抢 7 天极速出货，缝纫车间工人通宵赶工月休一天。',
      keyProduct: '极低价网批冲锋衣 / 爆款盗版服饰'
    },
    recommendedAlternatives: [
      {
        id: 'patagonia',
        name: 'Patagonia (巴塔哥尼亚)',
        tier: 'S',
        policyLabel: '全球劳工友好领袖 / 绝不加班',
        keyProduct: '经典抓绒衣 / 防水硬壳冲锋衣',
        highlight: '买一件穿十年，供应链获得全额 Fair Trade 公平贸易与工时认证。'
      },
      {
        id: 'uniqlo',
        name: 'Uniqlo (优衣库)',
        tier: 'A',
        policyLabel: '日资严格分秒打卡 / 加班双倍支付',
        keyProduct: 'AIRism 凉感内搭 / 防晒衣 / 羽绒服',
        highlight: '严格执行门店工时限制与超时预警系统，严禁任何形式的隐形加班。'
      },
      {
        id: 'decathlon',
        name: 'Decathlon (迪卡侬)',
        tier: 'S',
        policyLabel: '法企运动生活哲学 / 纯正双休',
        keyProduct: 'MH500 徒步冲锋衣 / 跑鞋',
        highlight: '以人为本的法国企业，内部运动俱乐部文化浓厚，平价高质与员工幸福感兼备。'
      }
    ]
  },
  {
    id: 'pair-vehicles',
    categoryName: '汽车生活 · 家用车与新能源车',
    searchKeywords: ['新能源车', '电车', '汽车', '比亚迪', '沃尔沃', 'byd'],
    boycottBrand: {
      name: 'BYD (比亚迪)',
      tier: 'C',
      reason: '狼性单休制造考核，研发与一线常态化夜间连轴转，多次发生加班纠纷。',
      keyProduct: '秦/汉/海鸥纯电动车'
    },
    recommendedAlternatives: [
      {
        id: 'volvo-car',
        name: 'Volvo (沃尔沃汽车)',
        tier: 'S',
        policyLabel: '北欧以人为本 / 严格双休与充裕年假',
        keyProduct: 'XC60 / S90 / EX30 纯电轿跑',
        highlight: '不卷无意义工时，领先业界的带薪育儿假与心理健康保障，打工人购车良心标杆。'
      }
    ]
  }
];
