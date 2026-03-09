+++
date = '2026-01-04T09:56:07+08:00'
draft = true
title = 'WebRTC SDP and IceCandidate'
description = "深入解析 WebRTC 的 SDP 会话描述与 ICE 候选者：协议结构、业务含义及 Rust 代码建模。"
slug = "webrtc-sdp-and-icecandidate"
categories = ['computer-science']
tags = ['WebRTC', 'SDP', 'ICE', 'Network']
+++

我们将 **SDP** 和 **IceCandidate** 放在云游戏（WebRTC）的宏观图景中，像拆解精密机械一样，从**协议结构**、**业务含义**到**Rust 代码建模**进行一次彻底的综合解析。

# WebRTC 的双子星：SDP 与 IceCandidate

如果把建立 WebRTC 连接比作 **“签订一份跨国贸易合同并开始发货”**：

1. **SDP (Session Description Protocol)** 是 **“合同书”**。
   - 它规定了货物的规格（我是传视频还是音频？）、包装方式（H.264 还是 VP8？）、加密方式（AES-128？）以及双方的身份验证信息。
   - **核心作用**：**媒体协商 (Capability Negotiation)**。
2. **IceCandidate (Interactive Connectivity Establishment)** 是 **“物流路线”**。
   - 它不关心货是什么，只关心怎么送达。是走水路（内网直连）？还是走空运（STUN 公网映射）？还是找个中间人转运（TURN 中继）？
   - **核心作用**：**网络连通 (Connectivity)**。

------

## 第一部分：SDP (合同书) —— 定义“我们要干什么”

SDP 本质上是一个以行为单位的文本协议。在 WebRTC 中，它包含两个最关键的部分：**媒体描述** 和 **网络基石信息**。

### 1. SDP 的解剖图 (Anatomy)

让我们看一个简化版的云游戏 SDP Offer（Android 端发出的）：

Plaintext

```
v=0
o=- 4862426366036662057 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1          <-- 核心：音视频复用同一个端口连接
a=ice-ufrag:J7d2            <-- 核心：ICE 用户名 (门禁卡账号)
a=ice-pwd:8+x/S3...         <-- 核心：ICE 密码 (门禁卡密码)
a=fingerprint:sha-256 ...   <-- 核心：DTLS 加密指纹 (防窃听)

m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8  <-- 媒体行 0 (mline_index=0)
c=IN IP4 0.0.0.0            <-- 早期占位符，不管它
a=mid:0                     <-- 核心：媒体 ID (sdp_mid="0")
a=sendonly                  <-- 手机端只发音频(麦克风)

m=video 9 UDP/TLS/RTP/SAVPF 100 101 102        <-- 媒体行 1 (mline_index=1)
c=IN IP4 0.0.0.0
a=mid:1                     <-- 核心：媒体 ID (sdp_mid="1")
a=recvonly                  <-- 手机端只收视频(云游戏画面)
a=rtpmap:100 H264/90000     <-- 我支持 H.264
a=fmtp:100 level-asymmetry-allowed=1;...
```

### 2. SDP 的三个关键职责

1. **定义拓扑结构 (Topology)**：
   - 看上面的 `m=` 行。有几行 `m=`，就代表有几条媒体流（Track）。
   - 这里定义了：我有两路流，一路是 Audio，一路是 Video。
   - **Rust TDD 视角**：你的 `Sdp` 结构体解析后，应该能回答 `fn has_video(&self) -> bool`。
2. **定义“门禁卡” (Authentication)**：
   - 注意 `a=ice-ufrag` 和 `a=ice-pwd`。这是 WebRTC 引擎随机生成的。
   - **任何试图连接我的 ICE Candidate，必须带上用这组密码签名的哈希值。** 否则我一律视为黑客攻击，直接丢弃。
   - *这也是为什么必须先生成 Offer 的原因：没合同，就没生成密码；没密码，物流车进不来。*
3. **定义编解码 (Codecs)**：
   - `a=rtpmap:100 H264`。Android 告诉服务端：“我能解 H.264，Payload Type 是 100”。
   - 服务端回复 Answer 时，如果它也支持 H.264，就会确认这个 Type。

------

## 第二部分：IceCandidate (物流车) —— 解决“怎么到达”

一旦 SDP 合同签好（LocalDescription 被设置），WebRTC 引擎就知道：“好，我们需要为 `m=video` (sdp_mid=1) 找一条路，现在的门禁密码是 `J7d2`。”

于是，它开始收集 Candidate。

### 1. IceCandidate 的解剖图

一个标准的 Candidate 字符串如下：

Plaintext

```
candidate:842163049 1 udp 1677729535 192.168.1.5 5000 typ host generation 0 network-id 1
```

而在代码中（Java/Rust），它被封装为对象：

Rust

```
struct IceCandidate {
    sdp_mid: "1",                     // 这条路是给 Video (m=video) 走的
    mline_index: 1,                   // 对应 SDP 第2个 m= 行
    candidate: "candidate:842163..."  // 具体的路径信息
}
```

### 2. Candidate 字符串里的秘密

让我们拆解那个长字符串：

- **`udp`**: 协议。云游戏绝大多数情况用 UDP。如果是 `tcp`，说明在穿透防火墙。
- **`192.168.1.5 5000`**: 这是 **IP 和 端口**。
- **`typ host`**: **这是最重要的类型字段**。
  - `typ host`: **内网直连**。通过读取本机网卡获得。延迟最低，但只能在同一 WiFi 下用。
  - `typ srflx` (Server Reflexive): **公网映射**。这是问 STUN 服务器问出来的（“外网看我是什么 IP”）。用于 P2P 穿透 NAT。
  - `typ relay`: **中继**。这是向 TURN 服务器申请的。数据要绕远路，作为最后的保底手段。
- **`1677729535` (Priority)**: 优先级。`host` 最高，`relay` 最低。WebRTC 会优先尝试高优先级的路。

------

## 第三部分：综合舞步 (The Workflow)

现在，我们将两者结合，看看**Rust 客户端**和**云端服务器**是如何配合的。

### 阶段一：起草合同 (Create Offer)

1. **Android**: `peer_connection.create_offer()`
   - 引擎内部生成了 `ice-ufrag: user1`, `ice-pwd: pass1`。
   - 生成 SDP 文本，包含 `m=audio`, `m=video`。
2. **Android**: `peer_connection.set_local_description(offer)`
   - **关键时刻**：引擎应用了 `ufrag/pwd`。
   - **触发动作**：ICE Gatherer 开始工作，向 STUN 服务器发包，读取本机网卡。

### 阶段二：信令交换 (Signaling)

1. **Android**: 通过 WebSocket 发送 SDP Offer 给 Server。
2. **Rust Server**: 收到 SDP Offer。
   - 调用 `set_remote_description(offer)`。
   - Server 知道了客户端支持 H.264，也拿到了客户端的 `ufrag/pwd`。

### 阶段三：Trickle ICE (边找路边发货)

1. **Android**: 此时，ICE Gatherer 发现了一个内网地址 `192.168.1.5`。
   - 它不能只发个 IP 过去，因为 Server 不知道这 IP 是干嘛的。
   - 它封装成 `IceCandidate { sdp_mid: "1" (Video), candidate: "..." }`。
   - 通过 WebSocket 发送给 Server。
2. **Rust Server**: 收到 Candidate。
   - 调用 `add_ice_candidate(candidate)`。
   - **内部逻辑**：
     1. 查看 `sdp_mid="1"` -> 哦，这是给视频流的。
     2. 查看 Offer 里的 `ufrag/pwd` -> 知道了，我用这个 IP 发包时，要用那个密码签名。
     3. Server 开始向 `192.168.1.5:5000` 发送 **STUN Binding Request**（试探包）。

### 阶段四：连通 (Connected)

1. 如果 Server 的试探包，Android 收到了，并且回了应答。
2. **路通了！**
3. RTP 媒体数据开始通过这条路传输。

------

## 第四部分：Rust TDD 下的数据结构建议

基于上述理解，你在 Rust 中可以这样建模（强化 TDD 思维）：

Rust

```
// 1. 定义 SDP，它是只读的“协商结果”
#[derive(Debug, Clone, PartialEq)]
pub struct Sdp(pub String); // NewType 强类型

// 2. 定义 Candidate，它是动态的“路径更新”
#[derive(Debug, Clone)]
pub struct IceCandidate {
    // 必须有归属，否则是废数据
    pub sdp_mid: String, 
    // 允许容错，有时 mid 为空但 index 有值
    pub mline_index: u16, 
    // 原始数据，不需要过度解析，除非你要做 Deep Packet Inspection
    pub candidate: String, 
}

// 3. 业务逻辑 TDD 示例
impl IceCandidate {
    // TDD 测试点：解析原始字符串，判断是否是 Relay
    pub fn is_relay(&self) -> bool {
        self.candidate.contains("typ relay")
    }
}
```

**终极总结：**

- **SDP** 是 **静态的蓝图**，规定了有多少条路、通行证密码是什么。没有它，世界是混沌的。
- **IceCandidate** 是 **动态的探针**，不断尝试填充蓝图中的路径。
- **Offer 必须在 Candidate 之前**，因为没有蓝图，探针就不知道往哪里插，也没有密码去验证探针的合法性。

---

## 相关内容

- [WebRTC 与云游戏](/p/webrtc-and-cloud-gaming) - WebRTC 宏观架构与云游戏场景优化策略