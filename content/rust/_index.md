+++
title = 'Rust'
description = 'Rust 学习：从语言基础到源码分析，从理论到工程实践。'
+++

## 学习路径

```
基础 (fundamentals)
    ↓
源码学习 (source-study)
    ↓
实战项目 (practice)
    ↓
工程指南 (guides)
```

---

## fundamentals / 基础

语言核心概念与机制。

| 主题 | 核心问题 |
|------|----------|
| [所有权模型](fundamentals/ownership-model.md) | PhantomData 与内存排序如何保证安全？ |
| [异步基础](fundamentals/async-basics.md) | 为什么 async trait 这么复杂？ |
| [Rust 熟悉度](fundamentals/rust-familiarity.md) | 日常开发技巧 |
| [栈帧与虚表](fundamentals/rust-stack-frame-vtable-memory.md) | 底层内存布局 |
| [FFI 条件编译](fundamentals/rust-ffi-conditional-compilation.md) | 跨平台编译 |
| [IO 操作](fundamentals/rust-io-operations.md) | 文件与网络 |
| [Benchmark 学习](fundamentals/benchmark-learning.md) | 性能测试方法 |

---

## source-study / 源码学习

通过阅读优秀开源项目学习 Rust。

| 项目 | 主题 |
|------|------|
| **Tokio** | Runtime、调度器、时间轮、并发 |
| **Ripgrep** | 命令行设计、 glob 语法 |
| **Reqwest** | HTTP 客户端 |
| **Std** | 迭代器、Option 模式匹配 |

---

## practice / 实战

跨端开发与图形编程。

| 主题 | 内容 |
|------|------|
| [UniFFI + KMP](practice/uniffi/kmp-rust-uniffi-setup.md) | Rust 与 Kotlin 跨端 |
| [WGPU 基础](practice/wgpu-concepts-initialization.md) | 图形编程入门 |

---

## guides / 指南

学习路线与工程配置。

| 主题 | 内容 |
|------|------|
| [学习计划](guides/rust-learning-plan.md) | 系统化路径 |
| [项目脚手架](guides/rust-project-scaffolding-guide.md) | 工程化配置 |

---

## 核心原则

```
能用 Rust 就用 Rust
```

- **内存安全**：编译期保证，无 GC
- **零成本抽象**：高级语法，C 级性能
- **跨平台**：一次编写，多端编译
