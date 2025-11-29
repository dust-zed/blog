+++
date = '2025-11-29T23:09:52+08:00'
draft = true
title = 'WebRTC之TURN和STUN'
+++

### 一、 为什么要 TURN？（从“直连失败”说起）

WebRTC 的首选策略永远是 **P2P（点对点）**，因为延迟最低、不花服务器带宽费。但是，有一道墙叫 **NAT（网络地址转换）**。

#### 1. 简单 NAT（STUN 能搞定）

大部分家庭 WiFi 是这种。STUN 服务器只需要告诉手机：“你的公网 IP 是 1.2.3.4，端口是 1000”，然后手机告诉云端，云端往这个地址发包，路由器的 NAT 就会放行。

#### 2. 对称型 NAT / 防火墙（STUN 搞不定 -> 必须 TURN）

这在 **4G/5G 移动网络** 和 **公司/学校 WiFi** 中非常常见。

- **现象**：路由器非常严格。A 想和 B 说话，必须由 A 先发给 B，路由器才允许 B 回话。
- **死锁**：如果 Android 端和云游戏服务端都在这种严格 NAT 后面，两边都等着对方先说话，结果谁也连不上谁。
- **防火墙**：有些公司只开放 80/443 端口，封锁所有不明 UDP 端口。

这时候，就需要 **TURN (Traversal Using Relays around NAT)** 出场了。

------

### 二、 TURN 的工作原理

**TURN 是一个“中间人”服务器。**

**流程比喻**：

1. **直连（P2P）**：我直接把球扔给你。（最快）
2. **TURN（中继）**：中间有一堵墙。我把球扔给站在墙上的老王（TURN Server），老王接住球，转过身，再扔给你。

**技术流程**：

1. Android 手机发现 STUN 无论如何都打不通 P2P 洞。
2. Android 手机连接 TURN 服务器，申请一个资源。TURN 回复：“好的，我在云端分配了一个公网地址 203.0.113.5:8888 给你做代理。”
3. Android 把这个 relay 类型的 Candidate（候选地址）发给云游戏服务端。
4. **数据流转**：云游戏服务端 -> TURN 服务器 (203.0.113.5:8888)TURN 服务器 -> Android 手机
5. **注意**：这时候所有的视频流、音频流数据，**全部都要经过 TURN 服务器转发**。

------

### 三、 Android 代码中的体现

在你的 Android 项目中，PeerConnection 初始化的时候，一定有一个 IceServer 的配置列表。

```java
// 伪代码示例
List<PeerConnection.IceServer> iceServers = new ArrayList<>();

// 1. 添加 STUN (免费，轻量)
iceServers.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());

// 2. 添加 TURN (一定要配！通常需要鉴权)
// 因为转发流媒体消耗带宽，所以 TURN 服务器通常都要用户名密码
PeerConnection.IceServer turnServer = PeerConnection.IceServer.builder("turn:your.turn.server.com:3478")
    .setUsername("user123")
    .setPassword("password123")
    .createIceServer();
    
iceServers.add(turnServer);

// 3. 将配置塞给 PeerConnection
RTCConfiguration rtcConfig = new RTCConfiguration(iceServers);
// 关键策略：云游戏通常建议 'RELAY' 也要打开，甚至有些极端情况强制走 RELAY
rtcConfig.iceTransportsType = PeerConnection.IceTransportsType.ALL;
```

------

### 四、 云游戏场景下的 TURN 痛点与优化

你做云游戏，对 TURN 的感情是复杂的：**既离不开它，又不想用它。**

#### 1. 痛点：成本与延迟

- **带宽成本高**：普通 WebRTC 只有信令走服务器，流媒体不走。一旦走了 TURN，几兆码率的视频流跑在 TURN 服务器上，带宽费用惊人。
- **延迟增加**：数据多绕了一站，物理距离变长，RTT（往返时延）必然增加。这对于云游戏是致命的。

#### 2. 优化方案：边缘部署 (Edge TURN)

为了解决延迟问题，云游戏厂商通常不会只架设一个 TURN 服务器，而是会在全国各地的边缘节点部署 TURN。

- 如果我在北京玩，TURN 就连北京的节点。
- 这样虽然还是中继，但因为 TURN 服务器离我很近，延迟增加并不明显。

#### 3. 强制 TCP/TLS 模式

有些公司 WiFi 封锁 UDP。这时候 TURN 可以配置为监听 TCP 443 端口，把 WebRTC 数据伪装成普通的 HTTPS 流量，从而穿透防火墙。这叫 **TURN over TCP**。

------

### 五、 怎么判断走了 TURN？（实战技巧）

回到你的 **Logcat** 或者 chrome://webrtc-internals，如何判断当前用户是不是走了中继？

查看 **ICE Candidate** 的类型（Type）：

1. **host**：内网 IP。
2. **srflx** (Server Reflexive)：STUN 发现的公网 IP。（P2P 成功）
3. **relay**：TURN 分配的中继 IP。（走了中继）

**在 Android Logcat 中搜索：**

```
Selected connection: [Local] ... type=relay ... [Remote] ...
```

如果你看到 type=relay，说明当前连接正在走 TURN 服务器。

### 总结

- **STUN** 是问路人（只交换信息，不传数据）。
- **TURN** 是搬运工（实在走不通了，帮忙搬运所有视频数据）。
- **云游戏策略**：尽量 P2P，但必须部署高性能、分布式的 TURN 集群作为保底，否则用户在 4G/5G 下很容易连不上。
