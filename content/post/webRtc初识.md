+++
date = '2025-11-29T22:08:35+08:00'
draft = true
title = 'WebRtc初识'
+++

WebRtc 主要分为三个核心的部分：信令(Signaling)、媒体协商(SDP)、网络穿透(ICE)

---

### 1. WebRTC的宏观架构（三角形）

在标准的 WebRTC(P2P)中，是一个三角形架构：

1. ClientA（Android 客户端）- 后续直接称 Client
2. ClientB (云端游戏服务器) - 后续直接称 云端
3. Signal Server（信令服务器，通常是 HTTP/WebSocket）- 后续直接称 Server

**核心知识点**

* WebRTC 不包含信令实现。也就是说，怎么发现对方、怎么把数据发给对方，WebRTC 不管，通常用 WebSocket 自己写。
* 媒体流是 p2pde 。视频流是直接传输的。

---

### 2. 核心流程 （握手四步走）

#### 1. 媒体协商（SDP - Session Description Protocol）

**比喻**：交换名片

* Offer：手机（或云端）发起呼叫。
  * 内容：“我是 Android，支持 H.264和 VP8 解码，我想接收视频，不想发送音频。”
* Answer：云端 （或手机）回复。
  * 内容：“好的，我是云端，那我们就用 H.264 吧，我发给 1080p 60fps 的流。”

**代码对应**：

`peerConnection.createOffer()`   ->  `peerConnection.setLocalDescription()` ->  发送给服务器。

#### 2.网络协商 (ICE - Interactive Connectivity Establishment)

**比喻**：找路

仅仅知道要用 H.264 没用，还不知道对方的 IP 和端口。

* **Candidate**（候选者）：就是一个 IP:Port地址。
  * WebRTC 引擎会通过回调（`onIceCandidate`）告诉你：“嘿，我发现可以从这个 IP(192.168.1.5:5000)接收数据”
  * 你需要把这个信息通过信令服务器发给对方。

#### 3. 穿透（STUN/TURN）

比喻：引路人。

* **STUN**: 告诉你“你的公网 IP 是什么”。（因为手机通常在 WIFI 后面，不知道自己的公网 IP）。
* **TURN**：中继服务器。如果 p2p 直连打不通（比如公司防火墙太严），数据就通过 TURN 服务器转发。**云游戏通常尽量直连或部署专门的高速中继，以保证低延迟**。

---

### 3. 完整的时序图（Android视角）

假设是 Client 主动连接 Server ：

1. **初始化**：
   * client 创建 `PeerConnectionFactory`。
   * client 创建 `PeerConnection。`
2. **Offer 阶段**（SDP）
   * Client 调用`createOffer`。
   * Client 拿到 SDP 字符串，调用`setLocalDescription(offer)`
   * 关键动作：Client 把这个 SDP 字符串通过 WebSocket 发给信令服务器（Signal Server）
3. **Answer 阶段**（SDP）
   * Server 把你的 Offer 给云端。
   * 云端同意，生成 Answer SDP。
   * Client 通过 WebSocket 收到 AnswerSDP
   * 关键动作：Client 调用`setRemoteDescription(answer)`
   * 此时，双方都知道对方支持什么格式了。
4. **ICE 候选阶段**（Trickle ICE）:
   * 在协商 SDP 的同时，`PeerConnection`会触发`onIceCandidate`回调。
   * Client 把生成的 Candidate 发送给云端。
   * Client 也会收到云端发来的 Candidate，调用`addIceCandidate()`加进去。
   * 此时，路打通了，P2P 连接建立 （IceConnectionState -> CONNECTED）。
5. **媒体流传输**：
   * onTrack 或 onAddStream 被触发
   * 你拿到了 VideoTrack，把它设置给 Android 的`SurfaceViewRenderer`,画面出现！

---

### 4. 云游戏特有的知识点

##### 1. 单向高码率视频

* 现象：Zoom 是双向的，大家脸都很模糊。云游戏是服务器发给你10M/s 的超清流，你发给服务器的只是微小的操作指令（Touch/Gamepad）
* **Android关注点**：你的 PeerConnection 配置里，SDP Offer 应该要限制`Receive Video = true`,`Send Video = false`。这样能省电。

##### 2. 输入低延迟

* 现象：视频会议延迟 200ms 没感觉，玩游戏延迟 200ms 没法玩。
* 技术：操作指令通常不走 WebSocket（太慢，TCP 有重传），而是走 WebRTC 的 DataChannel。
* **知识点** ：DataChannel 底层是 SCTP 协议，可以配置为`unordered`和`unreliable`。
* 为什么？因为如果你按下跳跃键的数据包丢了，重传它没有意义（时间已经过去了），不如直接发下一个攻击键

##### 硬件解码

* **现象**：如果用软件解码(CPU 解码)，手机 5 分钟就烫手卡顿降频，画面卡顿。
* **Android 关注点**：在创建`PeerConnectionFactory`时，必须正确注入`DefaultVideoDecoderFactory`并传入`EglBase.Context`。知识 Android 端 WebRTC 最核心的性能优化点。

---

### 第五部分：给你的“作业”（验证你是否读懂）

不要写代码，去你的 Logcat 里找这几行日志（Android WebRTC 库通常会有详细的原生日志）：

1. **找 SDP**：搜索关键字 v=0 或者 m=video。看看里面有没有 H264 或者 VP8 的字样？这决定了你们在用什么编码。
2. **找 ICE**：搜索关键字 candidate。看看里面是 udp 还是 tcp？看看 IP 地址是内网（192.168.x.x）还是公网？
3. **找状态**：搜索 IceConnectionState。观察它从 CHECKING 变成 CONNECTED 或者是 COMPLETED 的过程
