const WLB_DATABASE = window.WLB_DATABASE || [];

// 1. 商详页右下角大卡片弹窗
function renderDetailBadge(item) {
  if (document.getElementById(`wlb-badge-${item.id}`)) return;

  const badge = document.createElement('div');
  badge.id = `wlb-badge-${item.id}`;
  badge.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:2147483647',
    'background:#ffffff',
    `border:2px solid ${item.color}`,
    'box-shadow:0 12px 30px rgba(0,0,0,0.18)',
    'border-radius:14px',
    'padding:14px 18px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'font-size:13px',
    'color:#1e293b',
    'max-width:340px'
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';

  const title = document.createElement('strong');
  title.style.cssText = `font-size:14px;font-weight:900;color:${item.color};`;
  title.textContent = item.tier === 'C' ? '⚠️ 双休透镜 · 避雷拦截' : '🛡️ 双休透镜 · 良心认证';

  const close = document.createElement('span');
  close.textContent = '✕';
  close.style.cssText = 'font-size:12px;cursor:pointer;color:#94a3b8;padding:2px 6px;border-radius:4px;';
  close.addEventListener('click', () => badge.remove());

  header.appendChild(title);
  header.appendChild(close);

  const line1 = document.createElement('div');
  line1.style.cssText = 'font-size:12px;color:#475569;';
  const b1 = document.createElement('strong');
  b1.style.cssText = 'color:#0f172a;font-size:13px;margin-left:4px;';
  b1.textContent = item.name;
  line1.append('当前商品涉及品牌：');
  line1.appendChild(b1);

  const line2 = document.createElement('div');
  line2.style.cssText = `margin-top:4px;font-weight:700;color:${item.color};font-size:12px;`;
  line2.textContent = `工时考核：${item.tier} 级 · ${item.label}`;

  badge.appendChild(header);
  badge.appendChild(line1);
  badge.appendChild(line2);

  if (item.alt) {
    const alt = document.createElement('div');
    alt.style.cssText = 'margin-top:8px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;color:#166534;line-height:1.4;';
    alt.textContent = `💡 ${item.alt}`;
    badge.appendChild(alt);
  }

  const foot = document.createElement('div');
  foot.style.cssText = 'margin-top:10px;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;align-items:center;';
  foot.innerHTML = '<span>用脚投票 · 考核老板</span><a href="https://shuangxiugou.vercel.app" target="_blank" style="color:#059669;text-decoration:none;font-weight:600;">打开双休购官网 →</a>';
  badge.appendChild(foot);

  document.body.appendChild(badge);
}

// 2. 搜索列表页商品批量识别盖戳（京东、淘宝、天猫商品列表）
function injectSearchItemStamps() {
  // 常见电商搜索页商品项选择器
  const selectors = [
    '.gl-item', // 京东搜索列表
    '.J_MouserOnverReq', // 淘宝搜索卡片
    '.Content--content--RrUqLQ3 .Card--doubleCardWrapper--L2XFE73', // 新版淘宝
    'div[data-sku]', // 京东通用
    '.goods-item' // 拼多多/通用
  ];

  const items = document.querySelectorAll(selectors.join(','));
  if (!items || items.length === 0) return;

  items.forEach((container) => {
    if (container.getAttribute('data-wlb-checked')) return;
    container.setAttribute('data-wlb-checked', 'true');

    const text = container.innerText || '';
    const matched = WLB_DATABASE.find((db) => text.includes(db.name));
    if (!matched) return;

    // 在卡片顶部注入微型透镜徽章
    const stamp = document.createElement('div');
    stamp.className = 'wlb-grid-stamp';
    stamp.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:3px',
      'padding:2px 6px',
      'border-radius:4px',
      'font-size:10px',
      'font-weight:bold',
      'margin:3px 0',
      `background:${matched.tier === 'C' ? '#ffe4e6' : matched.tier === 'S' ? '#d1fae5' : '#e0f2fe'}`,
      `color:${matched.color}`,
      `border:1px solid ${matched.color}66`
    ].join(';');

    stamp.textContent = matched.tier === 'C' ? `⚠️ 单休避雷 (${matched.name})` : `🛡️ 双休友好 (${matched.name})`;
    
    // 插入到卡片合适位置
    const titleElem = container.querySelector('.p-name, .title, a[title]') || container.firstElementChild;
    if (titleElem && titleElem.parentNode) {
      titleElem.parentNode.insertBefore(stamp, titleElem);
    }
  });
}

// 执行注入
function runWlbLens() {
  if (!document.body) return;

  // 检查是否在商品详情页
  const haystack = `${document.title} ${document.body.innerText.slice(0, 6000)}`;
  const matched = WLB_DATABASE.filter((item) => haystack.includes(item.name));
  const byId = {};
  matched.forEach((item) => {
    const current = byId[item.id];
    if (!current || item.name.length > current.name.length) {
      byId[item.id] = item;
    }
  });

  // 如果找到且数量少（通常为单商品详情页），弹出详情悬浮窗
  const matchedList = Object.values(byId);
  if (matchedList.length > 0 && matchedList.length <= 3) {
    matchedList.forEach((item) => renderDetailBadge(item));
  }

  // 同时尝试在搜索结果页进行卡片批量盖戳
  injectSearchItemStamps();
}

setTimeout(runWlbLens, 1500);
// 监听滚动与动态翻页
window.addEventListener('scroll', () => {
  clearTimeout(window._wlbScrollTimer);
  window._wlbScrollTimer = setTimeout(injectSearchItemStamps, 600);
});
