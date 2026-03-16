+++
title = "Rust 项目工程化脚手架指南"
date = "2026-03-16T10:00:00+08:00"
draft = false
description = "以 Embers 项目为例，介绍现代 Rust (2024 Edition) 的项目结构、工具链配置、代码规范等工程化最佳实践"
slug = "rust-project-scaffolding-guide"
categories = ["rust"]
tags = ["project-setup", "best-practices", "2024-edition", "tooling", "ddd", "typedd"]
image = ""
status = "draft"
+++

# Rust 项目工程化脚手架指南

> 以 Embers 项目为例，涵盖现代 Rust (2024 Edition) 的最佳实践

---

## 目录

1. [Workspace 统一依赖管理](#1-workspace-统一依赖管理)
2. [Cargo 命令使用时机](#2-cargo-命令使用时机)
3. [项目结构：DDD 分层架构](#3-项目结构ddd-分层架构)
4. [TypeDD：类型驱动开发](#4-typedd类型驱动开发)
5. [错误处理策略](#5-错误处理策略)
6. [Examples 编写规范](#6-examples-编写规范)
7. [Tests 编写规范](#7-tests-编写规范)
8. [文档注释规范](#8-文档注释规范)
9. [CI/CD 常用命令速查](#9-cicd-常用命令速查)

---

## 1. Workspace 统一依赖管理

### 1.1 根 Cargo.toml 结构

```toml
# Cargo.toml (workspace root)

[workspace]
resolver = "2"  # Rust 2021+ 必须使用 v2 resolver

members = [
    "crates/embers-client",
    "crates/embers-server",
    "crates/embers-stream",
    "crates/embers-proto",
]

# ========== 统一元数据 ==========
[workspace.package]
version = "0.1.0"
edition = "2024"
authors = ["Your Name <email@example.com>"]
license = "MIT"
repository = "https://github.com/user/repo"

# ========== 统一依赖版本 ==========
[workspace.dependencies]
# 异步运行时
tokio = { version = "1.49", features = ["full", "tracing"] }

# 序列化
serde = { version = "1", features = ["derive"] }
bincode = "1.0"

# 错误处理
thiserror = "2.0"  # 库：精确错误
anyhow = "1.0"     # 应用：错误传播

# 日志
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# ========== 内部 crate 引用 ==========
embers-proto = { path = "crates/embers-proto" }
embers-stream = { path = "crates/embers-stream" }
```

### 1.2 子 Crate 引用方式

```toml
# crates/embers-server/Cargo.toml

[package]
name = "embers-server"
version.workspace = true      # 继承 workspace 版本
edition.workspace = true      # 继承 workspace edition

[dependencies]
# 从 workspace 继承，保证版本一致
tokio = { workspace = true }
serde = { workspace = true }
thiserror = { workspace = true }

# 引用内部 crate
embers-proto = { workspace = true }
embers-stream = { workspace = true }

# crate 独有依赖（不需要统一）
some-specific-lib = "1.0"
```

### 1.3 优势

| 优势 | 说明 |
|-----|------|
| **版本一致性** | 所有 crate 使用相同版本的 tokio/serde，避免冲突 |
| **减少编译时间** | 相同版本的依赖只编译一次 |
| **简化升级** | 升级时只需修改根 Cargo.toml |
| **强制规范** | 新 crate 必须遵循 workspace 约定 |

---

## 2. Cargo 命令使用时机

### 2.1 开发阶段命令

| 命令 | 时机 | 说明 |
|-----|------|------|
| `cargo check` | 频繁 | **最快**，只检查类型错误，不生成代码 |
| `cargo check -p <crate>` | 频繁 | 只检查特定 crate，更快 |
| `cargo clippy` | 提交前 | 检查代码风格和潜在问题 |
| `cargo test` | 写完功能 | 运行单元测试 |
| `cargo test -p <crate>` | 调试时 | 只测试特定 crate |
| `cargo build` | 需要运行时 | 生成 debug 二进制 |
| `cargo run -p <bin>` | 调试时 | 运行特定二进制 |

### 2.2 提交前检查流程

```bash
# 1. 快速类型检查
cargo check --workspace --all-targets

# 2. Lint 检查
cargo clippy --workspace --all-targets -- -D warnings

# 3. 运行测试
cargo test --workspace

# 4. 格式化检查
cargo fmt -- --check
```

### 2.3 性能对比

```
cargo check        ████████░░  (8s)  - 推荐：开发时
cargo build        ████████████████ (16s) - 需要：运行时
cargo build --release ████████████████████████ (24s) - 发布
```

### 2.4 常用组合命令

```bash
# 只检查特定 crate（节省时间）
cargo check -p embers-server

# 运行特定 example
cargo run -p embers-stream --example capture_encode

# 运行特定测试
cargo test -p embers-stream --test test_quic

# 查看依赖树
cargo tree -p embers-client

# 检查过时依赖
cargo outdated  # 需要 cargo-outdated
```

---

## 3. 项目结构：DDD 分层架构

### 3.1 目录结构

```
embers/
├── Cargo.toml                 # Workspace 根配置
├── CLAUDE.md                  # AI 协作指南
│
└── crates/
    ├── embers-proto/          # 【协议层】共享内核
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       └── *.rs           # 纯数据结构
    │
    ├── embers-stream/         # 【流媒体核心】
    │   ├── Cargo.toml
    │   ├── examples/          # 可执行示例
    │   │   ├── capture_encode.rs
    │   │   └── test_client.rs
    │   └── src/
    │       ├── lib.rs
    │       ├── domain.rs      # 领域层导出
    │       ├── infra.rs       # 基础设施层导出
    │       ├── domain/        # 【领域层】纯逻辑
    │       │   ├── capture.rs   # CaptureSource trait
    │       │   ├── network.rs   # NetworkTransmitter trait
    │       │   ├── frame.rs     # Frame, FrameNumber 等
    │       │   └── error.rs     # 领域错误
    │       └── infra/         # 【基础设施层】IO 实现
    │           ├── cgdisplay.rs # macOS 屏幕捕获
    │           ├── encoder.rs   # GStreamer 编码
    │           └── quic.rs      # QUIC 网络实现
    │
    ├── embers-server/         # 【服务端】
    │   └── src/
    │       ├── domain/        # SessionManager, StreamTaskManager
    │       └── infra/         # QuicServer, 具体实现
    │
    └── embers-client/         # 【客户端】
        └── src/
            ├── domain/        # JitterBuffer, Receiver 状态机
            ├── infra/         # H264Decoder, StreamReceiver
            └── client.rs      # FFI 整合层
```

### 3.2 分层规则（单向依赖）

```
┌─────────────────────────────────────────────────┐
│                 基础设施层 (Infra)               │
│  GStreamer, QUIC, CGDisplay, wgpu, evdev       │
│  实现 Domain 定义的 Trait                       │
└──────────────────────┬──────────────────────────┘
                       │ 依赖
                       ▼
┌─────────────────────────────────────────────────┐
│                   领域层 (Domain)                │
│  CaptureSource, NetworkTransmitter, Frame       │
│  纯逻辑，无 IO，可单元测试                       │
└──────────────────────┬──────────────────────────┘
                       │ 依赖
                       ▼
┌─────────────────────────────────────────────────┐
│                   协议层 (Proto)                 │
│  纯数据结构 + Serde，无逻辑                      │
│  客户端/服务端共享                               │
└─────────────────────────────────────────────────┘
```

### 3.3 lib.rs 组织方式（Rust 2024 风格）

```rust
// src/lib.rs
// ❌ 不要使用 mod.rs（Rust 2015 风格）
// ✅ 使用目录同名文件

#![allow(async_fn_in_trait)]  // 模块级配置

pub mod domain;   // 对应 src/domain.rs + src/domain/
pub mod infra;    // 对应 src/infra.rs + src/infra/
```

```rust
// src/domain.rs（目录同名文件，导出子模块）
pub mod capture;
pub mod network;
pub mod frame;
pub mod error;

// 重导出常用类型，简化调用
pub use capture::{CaptureConfig, CaptureSource};
pub use frame::{Frame, FrameNumber, FrameRate, Resolution};
```

---

## 4. TypeDD：类型驱动开发

### 4.1 NewType 模式（防止参数混淆）

```rust
// ❌ 错误：容易搞反参数顺序
fn resize(width: u32, height: u32);
resize(1920, 1080);  // 还是 resize(1080, 1920)?

// ✅ 正确：使用 NewType
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Width(u32);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Height(u32);

fn resize(width: Width, height: Height);
resize(Width(1920), Height(1080));  // 编译器帮我们检查
```

### 4.2 实际示例：Resolution

```rust
// crates/embers-stream/src/domain/frame.rs

/// 分辨率，使用 NewType 模式保证有效性。
///
/// # Type Safety
///
/// 无法构造无效分辨率（如 0x0）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Resolution {
    width: u32,
    height: u32,
}

impl Resolution {
    /// 创建新分辨率。
    ///
    /// # Errors
    ///
    /// 宽高必须 > 0，否则返回 `None`。
    pub fn new(width: u32, height: u32) -> Option<Self> {
        if width > 0 && height > 0 {
            Some(Self { width, height })
        } else {
            None
        }
    }

    #[inline]
    pub const fn width(&self) -> u32 {
        self.width
    }

    #[inline]
    pub const fn height(&self) -> u32 {
        self.height
    }
}
```

### 4.3 Parse, Don't Validate（解析而非校验）

```rust
// ❌ 错误：到处校验
fn process_frame(frame: &[u8]) {
    if frame.len() < 4 {
        return;
    }
    // ... 使用 frame
}

fn send_frame(frame: &[u8]) {
    if frame.len() < 4 {
        return;
    }
    // ... 发送 frame
}

// ✅ 正确：类型保证有效性
pub struct ValidatedFrame(Vec<u8>);

impl ValidatedFrame {
    /// 解析并验证帧数据。
    ///
    /// # Errors
    ///
    /// 帧数据无效时返回错误。
    pub fn parse(data: Vec<u8>) -> Result<Self, FrameError> {
        if data.len() < 4 {
            return Err(FrameError::TooShort);
        }
        Ok(Self(data))
    }
}

fn process(frame: &ValidatedFrame) {
    // 无需校验，类型已保证有效性
}
```

### 4.4 状态机模式

```rust
/// 接收器状态机。
///
/// 通过类型系统防止非法状态转换。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ReceiverState {
    #[default]
    Disconnected,
    Connecting,
    Connected,
    Receiving,
    Error,
}

impl ReceiverState {
    /// 尝试转换到目标状态。
    ///
    /// # Errors
    ///
    /// 非法转换时返回错误。
    pub fn transition_to(self, target: Self) -> Result<Self, StateError> {
        use ReceiverState::*;
        match (self, target) {
            (Disconnected, Connecting) => Ok(Connecting),
            (Connecting, Connected) => Ok(Connected),
            (Connected, Receiving) => Ok(Receiving),
            (_, Error) => Ok(Error),  // 任何状态都可以转到 Error
            _ => Err(StateError::InvalidTransition { from: self, to: target }),
        }
    }
}
```

---

## 5. 错误处理策略

### 5.1 库使用 `thiserror`

```rust
// crates/embers-stream/src/domain/error.rs

/// 捕获相关错误。
#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("Invalid resolution: {width}x{height}")]
    InvalidResolution { width: u32, height: u32 },

    #[error("Capture not started")]
    NotStarted,

    #[error("Platform error: {0}")]
    Platform(#[from] std::io::Error),
}
```

### 5.2 应用/二进制使用 `anyhow`

```rust
// examples/capture_encode.rs

use anyhow::Result;

fn main() -> Result<()> {
    // ? 操作符自动转换错误
    let config = CaptureConfig::new(...)?;
    capture.start(config).await?;
    Ok(())
}
```

### 5.3 错误处理规则

| 场景 | 使用 | 原因 |
|-----|------|------|
| 库 (Library) | `thiserror` | 调用者需要精确处理不同错误 |
| 应用 (Application) | `anyhow` | 简化错误传播，统一处理 |
| Example | `anyhow` | 演示代码，简洁优先 |
| ❌ 生产代码 | `unwrap()` | 禁止！可能导致 panic |

---

## 6. Examples 编写规范

### 6.1 Example 位置

```
crates/embers-stream/
├── examples/
│   ├── capture_encode.rs    # 独立可运行
│   └── test_client.rs
└── src/
```

### 6.2 Example 结构模板

```rust
//! Example: 演示捕获和编码管道。
//!
//! # Usage
//!
//! ```bash
//! cargo run -p embers-stream --example capture_encode
//! ```

use embers_stream::{
    domain::{CaptureConfig, CaptureSource, FrameRate, Resolution},
    infra::{cgdisplay::CGDisplayCapture, encoder::GStreamerEncoder},
};
use futures::StreamExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 0. 初始化日志
    tracing_subscriber::fmt::init();

    // 1. 配置参数（带注释说明）
    let width = 1920u32;
    let height = 1080u32;
    let fps = 30u32;

    // 2. 创建组件
    let mut capture = CGDisplayCapture::new();
    let mut encoder = GStreamerEncoder::new(width, height, fps)?;

    // 3. 构建配置（展示 TypeDD 用法）
    let resolution = Resolution::new(width, height)
        .ok_or_else(|| anyhow::anyhow!("Invalid resolution"))?;
    let frame_rate = FrameRate::new(fps)
        .ok_or_else(|| anyhow::anyhow!("Invalid frame rate"))?;
    let config = CaptureConfig::new(resolution, frame_rate, PixelFormat::Bgra)?;

    // 4. 启动捕获
    capture.start(config).await?;

    // 5. 处理帧流
    let mut frame_stream = std::pin::pin!(capture.frame_stream());

    while let Some(frame) = frame_stream.next().await {
        encoder.encode(frame?)?;

        while let Some(packet) = encoder.pull_packets()? {
            // 处理编码后的包
        }
    }

    Ok(())
}
```

### 6.3 运行 Example

```bash
# 运行特定 example
cargo run -p embers-stream --example capture_encode

# 带参数运行
cargo run -p embers-stream --example capture_encode -- --help

# 带日志运行
RUST_LOG=debug cargo run -p embers-stream --example capture_encode
```

---

## 7. Tests 编写规范

### 7.1 测试位置

```
crates/embers-stream/
├── src/
│   ├── domain/
│   │   └── jitter.rs       // 内联单元测试 #[cfg(test)]
│   └── ...
└── tests/                   // 集成测试（可选）
    └── integration_test.rs
```

### 7.2 单元测试（内联）

```rust
// src/domain/jitter.rs

/// 抖动缓冲器。
pub struct JitterBuffer {
    // ...
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(num: u64) -> (FrameNumber, Vec<u8>) {
        (FrameNumber::new(num).unwrap(), vec![num as u8; 100])
    }

    #[test]
    fn test_buffer_reorders_frames() {
        let mut buffer = JitterBuffer::new(3);

        // 乱序插入
        buffer.insert(make_frame(3));
        buffer.insert(make_frame(1));
        buffer.insert(make_frame(2));

        // 应该按顺序输出
        assert_eq!(buffer.pop().unwrap().0.get(), 1);
        assert_eq!(buffer.pop().unwrap().0.get(), 2);
        assert_eq!(buffer.pop().unwrap().0.get(), 3);
    }

    #[test]
    fn test_buffer_waits_for_target_depth() {
        let mut buffer = JitterBuffer::new(3);

        // 只插入 2 帧，不够 target_depth
        buffer.insert(make_frame(1));
        buffer.insert(make_frame(2));

        // 应该返回 None（等待更多帧）
        assert!(buffer.pop().is_none());
    }
}
```

### 7.3 异步测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test;  // 注意：使用 tokio::test

    #[tokio::test]
    async fn test_async_capture() {
        let mut capture = MockCapture::new();
        capture.start(Default::default()).await.unwrap();

        let frame = capture.capture_frame().await.unwrap();
        assert!(!frame.data().is_empty());
    }
}
```

### 7.4 运行测试

```bash
# 运行所有测试
cargo test --workspace

# 运行特定 crate 测试
cargo test -p embers-stream

# 运行特定测试
cargo test -p embers-stream test_buffer_reorders

# 显示 println! 输出
cargo test -- --nocapture

# 运行被 ignore 的测试
cargo test -- --ignored
```

---

## 8. 文档注释规范

### 8.1 三要素

```rust
/// 抖动缓冲器，用于重排序网络传输的乱序帧。
///
/// # Why
///
/// 网络传输（尤其是 UDP/QUIC）可能乱序到达。
/// JitterBuffer 按 FrameNumber 排序，保证解码器收到连续帧。
///
/// # How
///
/// ```text
/// [网络] → [乱序帧: 3,1,2] → [JitterBuffer] → [有序帧: 1,2,3]
/// ```
///
/// # Example
///
/// ```
/// use embers_client::domain::JitterBuffer;
///
/// let mut buffer = JitterBuffer::new(3);
/// buffer.insert((frame_num, data));
/// if let Some(frame) = buffer.pop() {
///     // 处理帧
/// }
/// ```
pub struct JitterBuffer {
    // ...
}
```

### 8.2 模块级文档

```rust
//! 屏幕捕获领域抽象。
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────┐
//! │ CaptureSource   │  ← Trait (Domain)
//! └────────┬────────┘
//!          │ impl
//! ┌────────▼────────┐
//! │ CGDisplayCapture│  ← macOS 实现
//! │ X11Capture      │  ← Linux 实现
//! └─────────────────┘
//! ```
//!
//! # Trade-offs
//!
//! - **优点**: 平台无关的捕获逻辑
//! - **代价**: 需要运行时动态分发

pub use capture::{CaptureConfig, CaptureSource};
```

---

## 9. CI/CD 常用命令速查

### 9.1 本地开发

```bash
# 快速检查
cargo check --workspace

# 完整检查
cargo clippy --workspace --all-targets -- -D warnings

# 运行测试
cargo test --workspace

# 格式化
cargo fmt

# 构建文档
cargo doc --workspace --no-deps --open
```

### 9.2 CI Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo fmt -- --check
      - run: cargo clippy --workspace --all-targets -- -D warnings
      - run: cargo test --workspace
```

### 9.3 发布前检查

```bash
# 1. 确保无警告
cargo clippy --workspace --all-targets -- -D warnings

# 2. 确保测试通过
cargo test --workspace

# 3. 检查文档
cargo doc --workspace --no-deps

# 4. 检查未使用的依赖
cargo machete  # 需要 cargo-machete

# 5. 安全审计
cargo audit    # 需要 cargo-audit
```

---

## 总结：Rust 工程化检查清单

| 检查项 | 命令/规范 |
|-------|----------|
| ✅ Workspace 依赖统一 | `[workspace.dependencies]` |
| ✅ 子 crate 继承 | `version.workspace = true` |
| ✅ DDD 分层 | `domain/` 无 IO，`infra/` 实现 trait |
| ✅ TypeDD | NewType 模式，`parse, don't validate` |
| ✅ 错误处理 | 库用 `thiserror`，应用用 `anyhow` |
| ✅ 无 unwrap | 生产代码禁止 |
| ✅ 文档注释 | What/Why/How 三要素 |
| ✅ Examples | `examples/` 目录，可独立运行 |
| ✅ Tests | 内联 `#[cfg(test)]` + 集成测试 |
| ✅ Clippy 无警告 | `cargo clippy -- -D warnings` |
| ✅ 格式化 | `cargo fmt` |
