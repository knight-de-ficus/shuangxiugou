# 双休购 (ShuangxiuGo) · 劳工友好品牌索引与网购透镜

> “用消费者的订单投票，反向考核企业良心；把老板考核你的 KPI，变成打工人考核老板的货币选票。”

受常州星宇股份违法解除数百名应届毕业生及劳动法合规议题启发，本项目旨在打破企业工时黑盒，通过开源众包与真实司法/监管记录，让消费者能一眼识别哪些品牌真正践行周末双休、尊重员工劳动权益。

---

## 🌟 核心功能

1. **双休品牌白名单与避雷库**：
   - 涵盖数码外设、户外服饰、个人护理、运动器材、零食饮料、汽车生活等常见消费品类。
   - 提供 S级（模范标杆）、A级（合规双休 965）、B级（大小周/存疑）、C级（严重超时/通报违约）清晰评级。
2. **良心平替自动推荐**：
   - 当查询到避雷单休企业时，自动推荐同品类、价格亲民且严格落实双休的国货/外企替代品。
3. **“用脚投票”消费打卡与小票生成**：
   - 生成打工人专属复古热敏打印小票凭证，方便在小红书、朋友圈分享态度。
4. **双休透镜 Chrome/Edge 浏览器扩展**：
   - 在逛京东、淘宝、拼多多时，自动识别商品所属企业工时状况，弹出悬浮避雷与平替提示。

---

## 🚀 本地开发与启动

```bash
# 1. 克隆项目并安装依赖
npm install

# 2. 启动本地开发服务（固定端口 http://127.0.0.1:4780）
npm run dev

# 3. 构建生产包（产物在 dist/，可直接部署到 GitHub Pages / Vercel）
npm run build
```

> 开发端口固定在 `4780`（见 [vite.config.ts](file:///Users/heyi998/Desktop/GrowVault/双休购项目/vite.config.ts)），以便与浏览器插件内的官网链接保持一致。

---

## 🧩 浏览器插件安装说明 (`/extension`)

1. 打开 Chrome 或 Edge 浏览器，访问 `chrome://extensions/`。
2. 右上角开启 **“开发者模式” (Developer mode)**。
3. 点击 **“加载已解压的扩展程序” (Load unpacked)**。
4. 选择本项目根目录下的 `extension` 文件夹即可启用。

---

## 🌐 在线访问与 Vercel 一键部署

本项目支持一键部署到 Vercel：

1. 登录 [Vercel](https://vercel.com/)，选择 **Add New... → Project**。
2. 导入 GitHub 仓库 `ZhiqingHeyi/shuangxiugou`。
3. Framework Preset 选择 **Vite**，根目录保持默认，点击 **Deploy** 即可上线。
4. 项目自带 `vercel.json` 自动处理单页应用路由重写与安全头。

### 弹性分布式发布

项目已内置 signed manifest、IPFS/Kubo、验证 Gateway 与 Caddy HTTP/3 部署方案。它用于增加 DNS 故障、入口失效与源站离线时的恢复路径；传统域名仍保留为普通浏览器入口。

- 架构与信任边界：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 完整部署步骤：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- 监控、回退和密钥事故：[`docs/OPERATIONS.md`](docs/OPERATIONS.md)

服务器一键部署：

```bash
# Ubuntu / Debian
sudo ./scripts/deploy-linux.sh --domain edge.example.com --email admin@example.com
```

```powershell
# Windows Server 2019/2022/2025（管理员 PowerShell）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1 `
  -Domain edge.example.com -Email admin@example.com
```

脚本会备份现有状态、验证依赖包并在失败时尝试回退。域名解析、云安全组和上级 NAT 仍需按实际服务商配置，详见 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#0-一键部署推荐)。

快速查看命令：

```bash
npm run resweb:keygen
npm run resweb:publish -- --sequence 1
npm run resweb:verify
```

---

## ⚖️ 免责声明

本项目所有数据均来源于公开司法裁判文书、各地劳动监察部门行政处罚公开信息、上市公司公开 ESG 报告及社区打工人多方交叉验证。数据仅供个人择业与日常消费偏好参考，不构成商业排他或绝对背书。
