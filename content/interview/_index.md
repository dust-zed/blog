+++
title = '面试'
description = '技术面试准备：以知识体系为核心，而非碎片化问答。'
+++

## 理念

**不是"八股文问答"，而是"知识体系理解"。**

每个主题从核心问题出发，构建完整的知识脉络，最后才是面试高频点。

---

## Android

### 系统核心

| 主题 | 核心问题 |
|------|----------|
| [渲染系统](android/rendering-system.md) | 一帧画面如何从代码变成屏幕像素？ |
| [消息机制](android/message-system.md) | 主线程为什么不会卡死在 loop()？ |
| [进程与线程](android/process-and-threads.md) | Activity 是如何启动的？ |

### 编程范式

| 主题 | 核心问题 |
|------|----------|
| [异步编程](android/async-programming.md) | 协程如何用同步代码写异步逻辑？ |
| [现代 UI 架构](android/modern-ui-architecture.md) | Compose 如何实现声明式 UI？ |

### 优化与工程

| 主题 | 核心问题 |
|------|----------|
| [内存管理](android/memory-management.md) | 对象什么时候会被回收？ |
| [性能优化](android/performance-optimization.md) | 如何系统化地进行性能优化？ |
| [跨端技术](android/cross-platform.md) | 如何用 Rust 构建跨平台核心层？ |

---

## Rust

| 主题 | 核心问题 |
|------|----------|
| [所有权系统](rust/basics-ownership.md) | 为什么 FnOnce 只能调用一次？ |

---

## 学习建议

1. **先理解核心问题**：每个主题都有驱动性问题
2. **建立知识脉络**：从第一层到第四层递进理解
3. **关联实践**：通过实战案例巩固
4. **面试高频点**：最后再看，自然理解

---

## 知识图谱

```
渲染系统 ←→ 消息机制
    ↓           ↓
性能优化 ←→ 内存管理
    ↓
异步编程 ←→ 现代 UI 架构
    ↓
跨端技术
```
