# 运维、监控与应急

## 发布检查表

- `npm ci`、lint、build、弹性发布测试全部通过；
- 审阅 `dist`，确认没有私钥、源码映射、内部 URL 或个人数据；
- `sequence` 严格递增，`previous` 指向上次 manifest CID；
- 两人复核 siteId、content CID、有效期和 keyId 后签名；
- 至少三个受控节点完成递归 pin 与空缓存读取；
- 两个 HTTPS 入口的 manifest 摘要一致；
- 保留上一版 CID、manifest、构建日志和 SBOM。

## 监控

至少采集：当前 sequence/CID/expiry、manifest 拒绝原因、Kubo 递归读取成功率、pin 大小与磁盘余量、DHT peers/provider、HTTP 3/2/1.1 比例、IPv4/IPv6 成功率、TLS 到期、DNSSEC 外部验证结果。

探测分四层：

1. `/_resilient/healthz`：进程活着；
2. `/_resilient/readyz`：manifest 新鲜且 CID 可读；
3. 从外部网络加载首页及 JS/CSS，并检查 `x-resilient-content-cid`；
4. 从空 Kubo 仓库递归拉取整棵 DAG，验证真正可恢复性。

告警渠道不得依赖被监控的同一 DNS 或云供应商。访问日志执行最小化保留，不把 IPFS 宣传为匿名网络。

## 常见故障

### `readyz` 返回 503

检查 manifest 是否存在、签名是否匹配公钥、是否过期、sequence 是否低于本地状态，以及 Kubo 能否读取 CID。不要删除 `verification-state.json` 来绕过回滚保护；先确认是否误发旧版本。

### 同序列分叉

立即停止发布和自动晋级，保存所有来源的 manifest 与日志。确认是否两个发布任务使用了同一 sequence，或发布密钥被滥用。选择正确内容后必须发布更高 sequence，并把事件写入公开审计记录。

### 源站/发布节点离线

不要修改 manifest。确认受控镜像仍 pin 当前 CID，从空缓存读取；若 provider 数下降，补充受控 pin。只要块仍存在，源发布节点不是运行时单点。

### 单入口 reset/超时

分别检查 IPv4、IPv6、TCP 443、UDP 443 与不同 ASN。普通浏览器的自动重试不可控；必要时从健康 DNS 中移除失败入口，同时保留本地客户端的多入口竞速。

## 备份与回退

备份内容包括：加密私钥、发布公钥、所有 signed manifest、sequence 台账、`verification-state.json`、上两版完整 CID、DNS/TLS 配置导出和部署文件。恢复演练至少每季度一次。

回退不是重新签发较低 sequence。正确方法是把上一版内容 CID 放入一个**更高 sequence** 的新 manifest，注明事故原因并重新发布。这样已见新版本的客户端不会把合法回退误判为攻击。

## 发布密钥泄露

当前 v1 单发布密钥无法安全地在协议内自我撤销。发现泄露后：

1. 停止自动同步并保存证据；
2. 通过仓库、官网、社交渠道和线下指纹等多个独立渠道发布事故通知；
3. 生成新 key，并人工更新所有受控客户端/Gateway 的信任锚；
4. 检查是否存在攻击者签发的极大 sequence，不能简单清空状态；
5. 尽快实现 v2：离线 root key、短期 release key、keyset epoch、阈值恢复和透明日志 witness。

## 更新策略

容器镜像在生产应固定 digest、生成 SBOM、验证来源并分批更新。先在备用入口验证，保留旧镜像和数据卷快照，再逐节点替换。Kubo 数据卷不执行无验证的批量删除；GC 前确认当前与上一版本 CID 已 pin。
