# 双休购部署文档

本目录描述两条部署路径：

1. 传统 Vercel/静态托管，用于最低成本的普通浏览器入口；
2. 签名内容 + IPFS/Kubo + 多 HTTPS Gateway，用于提高对 DNS 故障、入口失效和源站离线的韧性。

建议按以下顺序阅读：

- [ARCHITECTURE.md](./ARCHITECTURE.md)：组件、信任边界、威胁模型与恢复能力；
- [DEPLOYMENT.md](./DEPLOYMENT.md)：从本地开发到生产双节点的逐步部署；
- [OPERATIONS.md](./OPERATIONS.md)：发布、监控、故障处理、备份与密钥泄露响应。

Linux 与 Windows Server 的一键部署命令、自动回退和公网开放边界，见 [DEPLOYMENT.md 的一键部署](./DEPLOYMENT.md#0-一键部署推荐)。

普通浏览器仅输入域名时，DNS、Web PKI 与 HTTPS 边缘仍是信任链的一部分。只有预置发布者公钥的客户端、本地 Gateway 或扩展，才能独立确认 manifest 与 CID。不要把 IPFS、DNSSEC、DoH 或 HTTP/3 宣传为“绝对无法屏蔽”。
