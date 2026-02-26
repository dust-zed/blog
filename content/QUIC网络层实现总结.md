+++
date = '2026-02-25T10:46:36+08:00'
draft = true
title = 'QUIC网络层实现总结'
+++

# QUIC 网络层实现总结

> 项目：Embers
>
> 模块：embers-stream/src/infra/quic.rs

---

### 一、完成的工作

|            任务            | 状态 |      |
| :------------------------: | :--: | ---- |
|   `QuicServer` 发送能力    | done |      |
|   `QuicServer` 接收能力    | done |      |
|   `QuicClient` 发送能力    | done |      |
|   `QuicClient` 接收能力    | done |      |
|   `ServerReceiver` trait   | done |      |
|   `ClientReceiver` trait   | done |      |
| `NetworkTransmitter` trait | done |      |
|          集成测试          | done |      |

---

## 二、 架构设计

### 2.1 分层结构

  ┌────────────────────
  │                      Domain Layer                           │
  │  ┌─────────────────┐  
  │  │ ServerReceiver  │  │ ClientReceiver  │ 
  │  │ (多连接接收)     │  │ (单连接接收)     │ 
  │  └─────────────────┘  
  └────────────────────
                              ▲
                              │ 实现
                              │
  ┌────────────────────
  │                   Infrastructure Layer                      │
  │  ┌─────────────────┐  
  │  │   QuicServer    │  │   QuicClient    │     
  │  │  (quinn 实现)   │  │  (quinn 实现)   │      
  │  └─────────────────┘  
  └────────────────────

### 2.2 Trait 设计

```rust
// 服务端接收器：多连接，需要知道数据来源
pub trait ServerReceiver: Send + Sync {
  type Error: std::error::Error + 'static + Send;
  
  async fn accept(&mut self) -> Result<ConnectionId, Self::Error>;
  async fn receive_from(&mut self, conn_id: ConnectionId) -> Result<NetPacket, Self::Error>;
  fn receive_stream(
    &mut self
  ) -> impl Stream<Item = Result<(ConnectionId, NetPacket), Self::Error>> + '_;
}
// 客户端接收器：单连接，无需 ConnectionId
pub trait ClientReceiver: Send + Sync {
  type Error: std::error::Error + Send + 'static;
  
  async fn receive(&mut self) -> Result<NetPacket, Self::Error>;
  fn receive_stream(&mut self) -> impl Stream<Item = Result<NetPacket, Self::Error>> + '_;
}
```

**设计决策**：Server 和 Client 分开，因为语义不同

- Server 管理多个连接，返回`(ConnectionId, NetPacket)`
- Client 只有一个连接，返回`NetPacket`

---

## 三、技术亮点

### 3.1 异步流： `futures::stream::unfold`

**问题**：如何把异步函数变成`Stream`?

```rust
fn receive_stream(&mut self) -> impl Stream<Item = Result<NetPacket, Self::Error>> + '_ {
  futures::stream::unfold(self, |client| async move {
    match client.receive().await {
      Ok(packet) => Some((Ok(packet), clent)),
      Err(e) => Some((Err(e), client)),
    }
  })
}
```

**要点**

- `unfold(initial_state, |state| async { Some((item, next_state)) })`
- 返回`Some`继续流，返回 `None`结束流
- 生命周期 `'_`表示借用了`self`

### 3.2 并发连接：`tokio::join!`

**问题**：Server accept 和 Client connect 谁先谁后？

```rust
let (accept_result, connect_result) = tokio::join!(
	server.accept_connection(),
  client.connect(server_addr)
);
```

**要点**：

- 解决先有鸡还是先有蛋的并发问题
- 两个 future 并发执行，都完成才继续
- 避免死锁

**拓展**

1. `tokio::select!`是竞争关系，先完成者赢，其他取消
2. `tokio::join!` 并发等待多个 future，必须都完成才返回。

### 3.3 QUIC协议要点

| 概念       | 代码体现                                  |
| ---------- | ----------------------------------------- |
| 面向连接   | `open_bi()`创建双向流                     |
| TLS 强制   | 自签名证书 + `SkipServerCertVerification` |
| 流多路复用 | 每次发送都`open_bi()`，不阻塞其他流       |
| 优雅关闭   | `finish()` + `close()` 发送关闭帧         |

---

## 四、学到的 Rust 概念

| 概念                       | 应用场景            |
| -------------------------- | ------------------- |
| `impl Stream + '_`         | 返回借用 self 的流  |
| `futures::stream::unfold`  | 创建异步状态机流    |
| `#[cfg(debug_assertions)]` | 仅 debug 模式下编译 |

---

## 五、面试问答模板

**Q: 为什么用 QUIC 而不是 TCP？**

QUIC 相比 TCP 的优势：

1. 0-RTT 连接：恢复连接时可以立即发送数据
2. 内置TLS：加密是强制的，不需要额外配置
3. 多路复用：多个流不阻塞，丢包只影响单个流
4. 连接迁移：网络切换(Wifi -> 4G)不需要重建连接

对于实时音视频场景，这些特性非常关键。
