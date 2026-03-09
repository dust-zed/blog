+++
date = '2026-01-18T10:37:29+08:00'
draft = true
title = 'Rust FFI 最佳实践：利用条件编译实现零成本模型共享'
categories = ['rust']
tags = ['Rust', 'FFI', 'UniFFI', 'ConditionalCompilation']
description = "利用条件编译实现 Rust Core + 移动端 UI 架构中的零成本模型共享。"
slug = "rust-ffi-conditional-compilation"
+++

### 1. 背景与痛点

在构建 "Rust Core + 移动端 UI"的架构时，我们通常会将项目分为三层：

1. **Domain/Feature Layer**: 纯 Rust 实现的业务逻辑，不依赖任何 FFI 库，保持纯洁性。
2. **FFI Layer**: 负责将 Rust 接口暴露给 Kotlin，通常使用 uniffi。
3. **Client Layert**：移动端平台原生代码。

**痛点：双重模型定义(The Dual Model Problem)**

为了让 Uniffi 能生成胶水代码，我们需要在结构体上标记（例如`#[derive(uniffi::Record)]`）。但 Domain Layer 不想也不应该引入 uniffi 依赖。于是，我们不得不写两套代码：

* Domain Layer

```rust
// domain/src/user.rs
pub struct User { pub id: i64, pub name: String }
```

* FFI Model (Wrapper)

```rust
// ffi/src/adapter.rs
#[derive(uniffi::Record)]
struct FfiUser { pub id: i64, pub name: String }

impl From<User> for FfiUser { ... } // 繁琐的数据转换
```

这导致了**代码冗余、维护成本翻倍以及运行时内存拷贝开销**。

---

### 2. 解决方案： 条件编译

我们的目标是：**One Model, Two Behaviors**。同一个结构体，在纯 Rust 环境下是普通的 Struct ，在 FFI 编译环境下自动获得跨语言能力。

我们利用Rust的`#[cfg_attr]`属性宏来实现这一点。

#### 2.1 架构设计

我们将所有共享的数据模型提取到一个独立的 Crate（例如 `shared-model`），并为其定义一个可选的 `ffi` 特性。

目录结构：

```
workspace/
├── domain-core/          # 业务逻辑 (Pure Rust)
├── android-ffi/          # 适配层
└── shared-model/         # 共享数据模型
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── auth.rs       # 业务模型
        └── primitive.rs  # 基础类型
```

#### 2.2 实现细节

##### Step 1: 定义 Feature 开关

在`shared-model/Cargo.toml`中：

```toml
[features]
default = []
# 只有当开启 ffi feature 时，才引入 uniffi 依赖
ffi = ["dev:uniffi"]
[dependencies]
serde = { version = "1.0", features = {"derive"} }
uniffi = { version = "0.30", optional = true }
```

##### Step 2: 编写双模结构体

在`shared-model/src/auth.rs`中：

```rust
use serde::{Deserialize, Serialize};
// ✨ 核心技巧：
// #[cfg_attr(condition, attributes)]
// 当 feature = "ffi" 激活时，展开为 #[derive(uniffi::Record)]
// 否则，它只是个普通的 Rust 宏，不会产生任何 FFI 依赖。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ffi", derive(uniffi::Record))]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
    pub avatar_url: Option<String>,
}
// 枚举同理
#[derive(Debug, Clone, Copy)]
#[cfg_attr(feature = "ffi", derive(uniffi::Enum))]
pub enum UserStatus {
    Active,
    Banned,
}
```

##### Step 3: FFI 层的零成本引用

在 `android-ffi` Crate 中，我们不需要再重新定义 `FfiUser`，而是直接引用：

```toml
# android-ffi/Cargo.toml
[dependencies]
# 显式开启 shared-model 的 ffi 能力
shared-model = { path = "../shared-model", features = ["ffi"] }
```

```rust
// android-ffi/src/lib.rs
use shared_model::auth::UserInfo;
#[uniffi::export]
pub fn get_current_user() -> UserInfo {
    // 直接返回业务层对象，无需 into()/from() 转换
    // 因为 UserInfo 在此时已经具备了 Record 特性
    domain_core::auth::get_cached_user()
}
```

---

### 3. 方案收益

通过这种架构重构，我们获得了显著的提升：

1. **单一真理源**：模型定义存在于一个文件。修改字段只需修改一次， Android/iOS 侧同步更新。
2. **零开销抽象**:   消除了 FFI 边界的所有数据转换代码。业务对象直接“流入” FFI 管道，没有内存拷贝，没有 CPU 消耗。
3. **架构清晰度**：
   * `Domain Layer` 保持了 100% 的平台无关性（不知道 FFI 存在）。
   * `FFI Layer` 退化为极薄的 API 暴露层， 符合 **"Humble Object"** 模式。

不仅代码量减少了 50%，更重要的是，我们利用 Rust 编译时特性，完美平衡了架构的整洁性与实用性。





# Android 高级开发工程师 - 刘永杰

**基本信息**

- **学历：** 华中科技大学（985/211） | 计算机科学与技术 | 本科
- **电话：** 18926286764
- **邮箱：** 1186669164@qq.com
- **博客：** [www.dust-zed.site](http://www.dust-zed.site) (持续输出 Compose/Kotlin 技术沉淀)
- **求职意向：** Android 高级开发 / 架构方向

------

### 核心优势

- **架构设计能力：** 熟练掌握 Clean Architecture、MVVM，具备从0到1搭建现代化Android工程的能力（Gradle Convention + KSP + DI）。
- **前沿技术栈：** 深度掌握 **Jetpack Compose** 声明式UI开发；具备 **Rust** 跨平台开发经验，熟悉 **UniFFI** 混合编程。
- **性能优化专家：** 在腾讯期间主导性能监控体系建设，具备Gson源码级问题排查与修复能力，擅长内存、渲染及启动优化。
- **音视频/云游戏：** 了解 WebRTC 工作流程，具备云游戏场景下的流媒体客户端开发经验。

------

### 工作经历

**广州游算科技有限公司** | **Android 独立开发 / 架构负责人** | *2025.11 - 至今**(核心项目：云游戏平台客户端)***工作内容：** 负责云游戏项目的从0到1架构选型、核心功能开发及跨平台方案落地。**核心产出：**

- **现代化架构搭建：**
  - 设计并落地 **Clean Architecture** 分层架构，利用 **Hilt** 实现依赖注入，确保业务逻辑与UI彻底解耦，提升代码可测试性。
  - 采用 **Jetpack Compose** 全面构建原生UI，建立了一套符合云游戏交互规范的Design System组件库。
  - 引入 **Gradle Build Convention Plugins** 管理构建逻辑，统一依赖版本规范，显著降低多模块维护成本。
- **跨平台与高性能层（Rust + UniFFI）：**
  - 设计 **Rust + UniFFI** 跨平台架构，将核心业务逻辑及高性能计算模块下沉至 Rust 层，为后续移植 iOS/Desktop 打下基础，利用 Rust 的所有权机制确保内存安全。
- **云游戏流媒体实现：**
  - 基于开源 **WebRTC** 方案实现低延迟音视频流接收与解码，处理信令交互（SDP/ICE），打通云端与本地的输入指令映射，保障高流畅度的游戏体验。

**个人发展与技术沉淀** | *2022.07 - 2025.10*

- **经历：** 从事实体行业创业（以此锻炼了项目统筹与抗压能力）。
- **技术保持：** 期间并未脱离技术，持续追踪 Android 前沿动态。深度钻研 **Kotlin Coroutines (Flow)** 及 **Jetpack Compose** 源码，并将学习成果输出至个人技术博客（[dust-zed.site](http://www.dust-zed.site)），保持了敏锐的技术嗅觉。

**腾讯科技（深圳）有限公司** | **Android 开发工程师 (前端架构组)** | *2021.04 - 2022.04**(核心项目：3D数字藏品展厅 / 性能监控平台)*

- **Unity 3D 跨端通信架构：**
  - 主导 **Unity 与 Android** 混合开发框架搭建，设计双向通信协议，解决了跨进程事件分发与大数据量传输的稳定性问题。
  - 负责 3D 展厅的加载优化与渲染性能调优，确保在低端机型上的 60fps 流畅运行。
- **性能监控体系建设：**
  - 从0搭建性能监控 SDK，覆盖**启动耗时、页面渲染、卡顿检测**等关键指标；通过数据上报与分析定位线上瓶颈，驱动业务线性能达标率提升 30%+。
- **工程化提效：**
  - 引入 **KSP (Kotlin Symbol Processing)** 技术，开发自定义注解处理器自动生成网络请求样板代码，减少 80% 的重复编码工作，大幅降低人为错误。

**广州市百果园网络科技有限公司** | **Android 开发工程师** | *2019.07 - 2021.04**(核心项目：语音房社交 App)*

- **复杂动画系统优化：**
  - 设计**多级缓存 + 优先级调度**的礼物动画系统，解决高并发场景下的动画丢帧问题。
  - 采用“属性动画 + View复用池”方案重构核心模块，使内存占用降低 **40%**，显著提升中低端机表现
