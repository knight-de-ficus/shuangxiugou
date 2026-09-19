# 部署方法

## 0. 一键部署（推荐）

两个入口都会完成依赖安装、构建、测试、Kubo 初始化、signed manifest 发布、Gateway/Caddy 启动、开机自启和主机防火墙配置。执行前会备份现有配置、密钥与运行状态；部署失败时尝试自动回退。

### Linux（Ubuntu 22.04/24.04 或 Debian 12）

在项目根目录执行：

```bash
chmod +x scripts/deploy-linux.sh
sudo ./scripts/deploy-linux.sh --domain edge.example.com --email admin@example.com
```

如果 Docker Engine 和 Compose v2 已由运维系统管理：

```bash
sudo ./scripts/deploy-linux.sh \
  --domain edge.example.com \
  --email admin@example.com \
  --no-install-docker
```

默认备份位于 `/var/backups/shuangxiugou/<UTC 时间>/`。脚本只在 UFW/firewalld **已启用**时增加规则，不会擅自启用或重置防火墙。可用 `--no-firewall` 完全跳过。

### Windows Server（2019/2022/2025 x64）

以管理员身份打开 Windows PowerShell，在项目根目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1 `
  -Domain edge.example.com `
  -Email admin@example.com
```

Windows Server 方案不依赖 Docker Desktop，会下载并校验固定版本的 Node.js、Kubo 和 Caddy，默认安装到 `%ProgramData%\ShuangxiuGo`，然后以 `SYSTEM` 计划任务实现开机自启与失败重启。备份位于 `%ProgramData%\ShuangxiuGo\backups\<UTC 时间>\`。

查看服务状态：

```powershell
Get-ScheduledTask -TaskName 'ShuangxiuGo-*' | Format-Table TaskName, State
Invoke-WebRequest http://127.0.0.1:8787/_resilient/readyz -UseBasicParsing
```

如果不希望脚本修改 Windows Defender Firewall，加上 `-SkipFirewall`。

### “自动开放公网”的边界

脚本会开放主机上的 TCP `80/443/4001` 和 UDP `443/4001`，并确保 Kubo RPC `5001` 与内部 Gateway `8080` 只监听 loopback。但本机脚本无法一致、安全地代替所有云厂商的安全组/API，也无法自动穿透上级 NAT 或替你修改 DNS。你仍需要：

1. 将域名 A/AAAA 指向这台服务器的公网地址；
2. 在云安全组/边界防火墙中开放同样五组端口；
3. 若主机在家庭路由器后，配置端口映射并确认不是 CGNAT；
4. 确认公网地址没有被 ISP 封锁入站 80/443。

脚本最后会检查 DNS 和公网 `readyz`，但检查失败时只给出告警，不会为了“看起来成功”而暴露管理端口。

### 首次安全收尾

一键部署在没有现有密钥时，会在服务器上创建 bootstrap 发布密钥。这只适合首次启动：请立即备份并把私钥转移到离线介质或密钥服务，公网 Gateway 只保留公钥。后续发布应在受控发布机签名，再向各 Gateway 分发 signed manifest。

## 1. 环境要求

- Node.js 22 或更高版本；
- Docker Engine 与 Docker Compose v2；
- Linux VPS 建议至少 2 vCPU、2 GiB 内存和 20 GiB 可扩展磁盘；公开主网 Kubo 的实际资源需求应按数据量与流量压测；
- 域名、可管理的 A/AAAA 记录，以及 TCP/UDP 443 与 TCP/UDP 4001 的防火墙权限。

所有命令从项目根目录执行。生产私钥不应保存在 Gateway 主机。

## 2. 本地构建

```bash
npm ci
npm run lint
npm run build
npm run test:resweb
```

输出目录为 `dist/`。先用普通预览确认站点：

```bash
npm run preview -- --host 127.0.0.1 --port 4780
```

## 3. 启动本地 Kubo

```bash
docker compose -f deploy/resilient/docker-compose.yml up -d kubo
docker compose -f deploy/resilient/docker-compose.yml ps
```

端口含义：

- `4001/tcp`、`4001/udp`：libp2p 数据平面；
- `127.0.0.1:5001`：Kubo RPC，仅本机发布/同步工具可用；
- `127.0.0.1:8080`：本机调试 Gateway，不直接暴露公网。

确认 RPC 没有监听在公网地址：

```bash
curl -X POST http://127.0.0.1:5001/api/v0/id
```

## 4. 首次生成发布密钥

```bash
npm run resweb:keygen
```

生成：

```text
deploy/resilient/secrets/publisher.private.pem
deploy/resilient/secrets/publisher.pub.pem
```

立即执行以下操作：

1. 将私钥移动到加密离线介质或密钥服务；
2. 保留至少两份离线备份并演练恢复；
3. Gateway 机器只复制 `publisher.pub.pem`；
4. 记录命令输出的 `keyId`，通过第二渠道公开给客户端核对；
5. 不提交 `secrets/`，`.gitignore` 已默认排除。

## 5. 首次发布

先构建，再上传 `dist`、签名 manifest 并把 manifest 本身加入 IPFS：

```bash
npm run build
npm run resweb:publish -- \
  --sequence 1 \
  --site dist \
  --private-key /secure/path/publisher.private.pem \
  --gateways https://edge-a.example,https://edge-b.example
```

记录输出中的：

- `contentCid`：站点目录 CID；
- `manifestCid`：本次 signed manifest CID；
- `expiresAt`：到期前必须续签或发布新序列。

把 `deploy/resilient/runtime/current.manifest.json` 和 `publisher.pub.pem` 安全复制到每个受控 Gateway。不要复制私钥。

## 6. 启动验证入口

复制环境文件并设置域名：

```bash
cp deploy/resilient/.env.example deploy/resilient/.env
```

编辑：

```dotenv
SITE_DOMAIN=edge-a.example
```

启动：

```bash
docker compose --env-file deploy/resilient/.env \
  -f deploy/resilient/docker-compose.yml up -d --build
```

验证：

```bash
curl https://edge-a.example/_resilient/healthz
curl https://edge-a.example/_resilient/readyz
curl https://edge-a.example/_resilient/manifest
curl --http3 https://edge-a.example/
```

`healthz=200` 只表示进程存活；只有 `readyz=200` 才表示 manifest 新鲜且当前 CID 可从本地 Kubo 读取。

本地 `localhost` 会使用 Caddy 内部 CA，浏览器可能不信任。不要通过关闭 TLS 验证来模拟生产安全性；生产域名应使用公开 ACME 证书。

## 7. 第二个受控 Gateway

在另一个云和 ASN 重复第 3、6 步，只复制公钥与 signed manifest。先让第二节点从空缓存完整读取站点，随后停止第一节点，确认页面、JS、CSS 和数据仍能加载。

生产最低建议：

- 2 个 HTTPS 边缘，跨云与 ASN；
- 3 个受控 pin 副本，跨故障域；
- 每个入口同时提供 IPv4/IPv6；
- TCP 443、UDP 443、TCP/UDP 4001 均做外部探测；
- 两个权威 DNS 供应商，区域记录自动对比。

## 8. 志愿镜像节点

志愿者只需要 Kubo、公钥、同步来源和有限磁盘，不需要域名 TLS 私钥或发布私钥：

```bash
npm ci --omit=dev
docker compose -f deploy/resilient/docker-compose.yml up -d kubo
npm run resweb:sync -- \
  --sources https://edge-a.example/_resilient/manifest,https://edge-b.example/_resilient/manifest \
  --public-key deploy/resilient/secrets/publisher.pub.pem
```

用 systemd timer、计划任务或编排系统每 15 分钟执行一次。同步器禁止 HTTP 重定向、限制 manifest 为 64 KiB、对所有候选验签、拒绝过期/回滚/同序列分叉，然后才 pin 内容。

志愿节点若只提供 IPFS P2P，无需开放 HTTP Gateway。公开 Gateway 会增加滥用、隐私、合规与资源消耗风险，应另做限流和内容策略。

## 9. DNS 与切换

1. 为 `www` 或主域配置两个以上 A/AAAA；
2. TTL 初期可设 300 秒，稳定后按运维能力调整；
3. 从多个地区探测 TLS、首页关键资源与 `readyz`，不要只 ping；
4. DNSSEC 上线前在测试子域验证 DS/DNSKEY 链；
5. 多 DNS + DNSSEC 必须确认供应商支持 multi-signer，不能简单把两组 NS 拼在一起；
6. 原生客户端可配置多个 DoH/DoT 和缓存入口，普通网页不能强制系统解析器切换。

## 10. 新版本发布

```bash
git pull --ff-only
npm ci
npm run lint
npm run build
npm run test:resweb
npm run resweb:publish -- \
  --sequence 2 \
  --previous <上一次 manifestCid> \
  --private-key /secure/path/publisher.private.pem \
  --gateways https://edge-a.example,https://edge-b.example
```

先把新内容 pin 到所有受控节点并验证完整读取，再原子替换各入口的 `current.manifest.json`。观察 15–30 分钟后再让 DNS/主要入口全面切换。旧 CID 至少保留一个发布周期，不立即 unpin。

## 11. 防火墙最小开放面

| 端口 | 来源 | 用途 |
|---|---|---|
| TCP 80 | 互联网 | ACME/HTTPS 跳转 |
| TCP 443 | 互联网 | HTTPS H1/H2 |
| UDP 443 | 互联网 | HTTP/3 QUIC |
| TCP/UDP 4001 | 互联网 | IPFS libp2p |
| TCP 5001 | 仅 loopback/管理网 | Kubo RPC |
| TCP 8080 | 仅容器私网/loopback | Kubo Gateway 上游 |

严禁把 5001 暴露公网。验证代理、Kubo 和 Caddy 之间使用独立容器网络；生产再增加主机防火墙、反向代理速率限制和磁盘配额。
