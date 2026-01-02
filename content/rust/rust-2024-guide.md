+++
date = '2025-12-30T15:55:01+08:00'
draft = true
title = 'Rust2024优雅开发手册'
categories = ['rust']
tags = ['Rust 2024', 'Best Practices', 'Guide']
description = "Rust 2024 语境下的工程化最佳实践手册，涵盖文档、测试、错误处理及设计模式。"
slug = "rust-2024-guide"
+++

# Rust 2024 优雅开发手册 (The Elegant Rust Handbook)

> **核心哲学**：**显式优于隐式，正确性优于便利性，编译器是最好的结对编程伙伴。**

这份手册旨在总结 Rust 2024 语境下的工程化最佳实践，涵盖注释规范、测试策略、错误处理及设计模式。

## 1. 文档与注释 (Documentation)

在 Rust 中，文档即代码。优雅的代码必须包含能够生成高质量 HTML 文档的注释。

### 1.1 文档注释 (`///` 和 `//!`)

- **API 文档 (`///`)**：用于 `pub` 的函数、结构体、枚举和模块。
- **模块级文档 (`//!`)**：放在文件顶部 (`src/lib.rs` 或 `mod.rs`)，描述整个 crate 或模块的设计意图。

**黄金结构：**

1. **第一行摘要**：简练的一句话总结（会被 Cargo Doc 提取为列表简介）。
2. **详细描述**：解释“为什么”和“做什么”，而不是“怎么做”。
3. **`# Examples`**：这是 Rust 的杀手锏。代码块不仅是示例，更是**测试**（Doc Tests）。
4. **`# Panics`**：明确列出什么情况下会 Panic。
5. **`# Errors`**：如果返回 `Result`，列出可能返回的错误类型。
6. **`# Safety`**：如果函数是 `unsafe` 的，**必须**解释调用者需要保证什么条件才安全。

**示例代码：**

```
/// 将两个数相除。
///
/// 这是一个用于演示文档规范的简单函数。它处理了除以零的情况。
///
/// # Examples
///
/// ```
/// let result = my_crate::divide(10, 2);
/// assert_eq!(result, Ok(5));
/// ```
///
/// # Errors
///
/// 如果 `b` 为 0，则返回 `DivideByZero` 错误。
pub fn divide(a: i32, b: i32) -> Result<i32, &'static str> {
    if b == 0 {
        return Err("DivideByZero");
    }
    Ok(a / b)
}

/// 解引用裸指针。
///
/// # Safety
///
/// 调用者必须确保 `ptr` 是有效的，并且指向已初始化的内存。
pub unsafe fn read_ptr(ptr: *const i32) -> i32 {
    *ptr
}
```

### 1.2 实现注释 (`//`)

- **只解释“为什么”**：不要翻译代码逻辑（代码本身应该足够清晰）。
- **TODO 标记**：使用 `// TODO: 说明 (User)` 格式，方便 IDE 索引。

## 2. 测试策略 (Testing Strategy)

Rust 的测试分为三层。业界关于 TDD（测试驱动开发）在 Rust 中的共识是：**类型驱动开发 (Type-Driven Development) 优先，测试驱动开发 (TDD) 辅助。**

因为 Rust 强大的类型系统会在编译期拦截大量错误，因此你不需要像 Python/JS 那样为每个类型检查编写测试。

### 2.1 单元测试 (Unit Tests)

- **位置**：直接写在源码文件中，通常位于底部。
- **模块**：使用 `mod tests` 并标记 `#[cfg(test)]`。
- **可见性**：单元测试可以（且应该）测试私有函数 (`private functions`)。

```
// src/math.rs

fn internal_helper(x: i32) -> i32 {
    x + 1
}

#[cfg(test)]
mod tests {
    use super::*; // 引入父模块所有内容

    #[test]
    fn test_internal_helper() {
        assert_eq!(internal_helper(1), 2);
    }
    
    // 优雅技巧：测试返回 Result，可以使用 ? 操作符
    #[test]
    fn test_with_result() -> Result<(), String> {
        let val = internal_helper(1);
        if val != 2 {
            return Err("Value incorrect".to_string());
        }
        Ok(())
    }
}
```

### 2.2 集成测试 (Integration Tests)

- **位置**：项目根目录的 `tests/` 文件夹。
- **原则**：把你的 Crate 当作第三方库来用。只能访问 `pub` API。
- **用途**：测试多个模块协同工作的流程。

### 2.3 文档测试 (Doc Tests)

- **位置**：`///` 注释中的代码块。
- **原则**：保证文档永远不会过期。这对于库（Library）开发是**强制要求**。

## 3. 错误处理 (Error Handling)

Rust 2024 生态中，错误处理已经高度标准化。

### 3.1 库 (Libraries) 开发

- **原则**：不要强制用户使用特定的错误处理库，保持依赖轻量。
- **工具**：**`thiserror`**。
- **做法**：定义一个枚举，派生 `Error` trait。

```
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("data not found")] // 自动实现 Display
    NotFound,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error), // 自动实现 From<io::Error>
    #[error("unknown error")]
    Unknown,
}
```

### 3.2 应用 (Applications) 开发

- **原则**：只关心错误发生，不关心错误的具体类型结构，方便透传。
- **工具**：**`anyhow`** (或 `eyre`)。
- **做法**：在 `main` 和顶层逻辑中使用 `anyhow::Result`。

```
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let content = std::fs::read_to_string("config.toml")
        .context("Failed to read configuration file")?; // 添加上下文信息
    Ok(())
}
```

### 3.3 Panic 的使用礼仪

- **库代码**：**永远不要 Panic**。除非遇到了内部状态彻底损坏（Bug）或者违反了 `unsafe` 契约。使用 `Result`。
- **Unwrap**：只在测试代码、原型代码，或者**你 100% 确定不会失败且写了注释**的情况下使用。
  - *推荐*：`expect("why this is valid")` 优于 `unwrap()`。

## 4. 代码风格与习语 (Idioms)

### 4.1 格式化与 Lint

- **fmt**：不要争论大括号换行。`cargo fmt` 是唯一的真理。
- **clippy**：`cargo clippy` 是你的导师。在 CI 中强制开启 `clippy -- -D warnings`。
  - *心态*：如果 Clippy 建议修改，通常它是对的（性能更好或更 Rust 味）。

### 4.2 构造函数

Rust 没有 `constructor` 关键字。

- **惯例**：使用 `new()` 作为构造函数名。
- **Builder 模式**：如果参数超过 3 个或大部分参数可选，使用 Builder 模式（推荐 `derive_builder` crate）。

### 4.3 转换 (Conversions)

- 优先实现 `From<T>` 而不是 `Into<T>`。因为实现了 `From` 会自动获得 `Into`。
- 对于字符串转换，接受 `impl Into<String>` 或 `AsRef<str>` 通常比直接接受 `String` 更优雅。

### 4.4 模块系统

- **Rust 2018+ 风格**：避免使用 `mod.rs`。
  - *推荐*：`src/auth.rs` + `src/auth/login.rs`。
  - *不推荐*：`src/auth/mod.rs` (这会导致编辑器里全是 `mod.rs` 标签)。

### 4.5 异步 (Async Rust)

- **Send + Sync**：确保你的 Future 是 `Send` 的（除非你做单线程 reactor）。这意味着不要在 `await` 跨度中持有 `MutexGuard`（要用 `tokio::sync::Mutex` 或限制作用域）。
- **取消安全 (Cancel Safety)**：在 `select!` 循环中，确保你的操作是取消安全的。

## 5. 项目工程化结构

一个优雅的 Rust Workspace 结构：

```
my-project/
├── Cargo.toml        (Workspace 定义)
├── Cargo.lock
├── Makefile.toml     (cargo-make 脚本，可选)
├── crates/           (核心逻辑拆分)
│   ├── core/         (领域模型，无 I/O，纯逻辑)
│   ├── api/          (HTTP/gRPC 接口)
│   └── storage/      (数据库层)
└── tests/            (端到端集成测试)
```

## 6. 总结：优雅检查清单

1. [ ] **`cargo fmt`** 和 **`cargo clippy`** 是否通过且无警告？
2. [ ] 公共 API 是否都有 **`///` 文档** 且包含 **`# Examples`**？
3. [ ] 核心业务逻辑是否有 **单元测试**？
4. [ ] 所有的 `unsafe` 块是否都有 **`// SAFETY:`** 注释？
5. [ ] 库代码是否避免了 `unwrap()` 和 `panic!`？
6. [ ] 错误类型是否使用了 `thiserror` 定义？
7. [ ] 是否优先利用了**类型系统**来保证状态有效性（例如使用 `Enum` 而不是 `bool` 或 `int` 状态码）？
