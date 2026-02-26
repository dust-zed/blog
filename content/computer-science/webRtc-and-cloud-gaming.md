+++
date = '2026-01-02T22:57:34+08:00'
draft = true
categories = ['cs-basics']
tags = ['WebRTC', 'Network']
description = "简单了解 WebRTC 协议"
slug = "webRtc-and-cloud-gaming"

+++

**核心逻辑**：WebRTC 是数据传输的高速公路。云游戏场景下，必须在 P2P 的低延迟和 NAT 的穿透的连通性之间寻找平衡。

### 1. WebRTC 宏观架构

* **三角形架构**：包含 Client、Server、Signal Server（信令服务器）。WebRTC 只负责媒体传输（P2P），信令交换（SDP）通常通过 WebSocket 自行实现。
* 握手流程：
  1. 媒体协商(**SDP**)：双方互换“名片”（Offer/Answer），确认编解码格式（如 H.264）。
  2. 网络协商（**ICE**）：交换 IP：Port 候选者（Candidate），尝试建立连接。
  3. 穿透（**STUN/TURN**）：解决 NAT 问题。

### 2. NAT 穿透机制（STUN vs TURN）

* STUN（问路人）：用于解决简单的 NAT（如家庭 WiFi）。告诉客户端它的公网 IP 是什么，实现 p2p 直连。
* TURN（搬运工）：
  * 场景：当面对对称型 NAT（4G/5G）或企业级防火墙时，P2P 无法打通，必须使用 TURN 服务器中继数据。
  * 云游戏痛点：TURN 会增加 RTT（延迟）并产生高昂带宽费。
  * 优化策略：边缘部署（Edge TURN）以减少物理距离；
* 判断方法：在 Logcat 或 ICE Candidate 中寻找 type = `relay`，即表示走了中继。

### 3. 云游戏特有的WebRTC策略

* 单向高码率流：配置 SDP 限制`Receive Video = true`，`Send Video = false`，节省手机电量。
* 输入低延迟：操作指令不走 WebSocket，也不走 TCP，而是通过 WebRTC DataChnanel（SCTP 协议），配置为`unordered`和`unrliable`，宁可丢包不可重传。
* 硬件解码：Android端必须正确注入`EglBase.Context`到`PeerConnectionFactory`，启用 MediaCodec 硬解。
