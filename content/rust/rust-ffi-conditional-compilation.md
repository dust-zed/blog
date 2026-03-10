+++
date = '2026-01-18T10:37:29+08:00'
draft = false
title = 'Rust FFI 最佳实践：利用条件编译实现零成本模型共享'
categories = ['rust']
tags = ['Rust', 'FFI', 'UniFFI', 'ConditionalCompilation']
description = "利用条件编译实现 Rust Core + 跨平台架构中的零成本模型共享。"
slug = "rust-ffi-conditional-compilation"
publication = "rust-cross-platform"
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
