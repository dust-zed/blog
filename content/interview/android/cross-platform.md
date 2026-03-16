+++
title = '跨端技术'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Rust', 'UniFFI', 'KMP', 'WebRTC', 'CrossPlatform']
description = "以 Rust 为核心的跨端技术：UniFFI、KMP 与流媒体实战。"
slug = "android-cross-platform"
+++

## 核心问题

**如何用 Rust 构建跨平台核心层？**

理解这个问题，就理解了现代跨端架构的核心设计。

---

## 知识脉络

### 第一层：为什么选择 Rust

#### 痛点

| 方案 | 问题 |
|------|------|
| C++ | 内存泄漏难排查 |
| Java/Kotlin | 无法跨 iOS |
| 平台原生 | 重复开发 |

#### Rust 优势

- **内存安全**：编译期保证，无 GC
- **零成本抽象**：高级语法，C 级性能
- **跨平台**：编译为各平台原生产物

---

### 第二层：UniFFI 跨端方案

#### 架构

```
┌─────────────────────────────────────┐
│           UI / 业务层               │  ← Android (Kotlin) / iOS (Swift)
├─────────────────────────────────────┤
│           FFI 桥接层                │  ← UniFFI 自动生成
├─────────────────────────────────────┤
│           核心逻辑层                │  ← Rust
│   • 音视频处理                      │
│   • 网络通信                        │
│   • 数据处理                        │
└─────────────────────────────────────┘
```

#### vs JNI

| 维度 | JNI | UniFFI |
|------|-----|--------|
| 代码量 | 大量手写 | 自动生成 |
| 类型安全 | 运行时 | 编译时 |
| 错误处理 | 易崩溃 | Result 类型 |

#### 内存管理

```kotlin
// Kotlin 端持有 Handle
class RustObject(handle: Long) {
    protected fun finalize() {
        // GC 时调用 Native 释放
        rustDestroy(handle)
    }
}
```

---

### 第三层：KMP 方案

#### 架构

```
┌─────────────────┐
│  Android UI     │  iOS UI (SwiftUI)
├─────────────────┤
│  KMP shared     │  ← Kotlin 业务逻辑
├─────────────────┤
│  Platform       │
└─────────────────┘
```

#### expect/actual

```kotlin
// Common
expect fun getPlatform(): Platform

// Android
actual fun getPlatform() = Platform.Android

// iOS
actual fun getPlatform() = Platform.IOS
```

---

### 第四层：WebRTC 实战

#### 低延迟优化

| 策略 | 原理 |
|------|------|
| GCC | 动态码率 |
| 零等待 Jitter Buffer | 最小延迟 |
| FEC | 前向纠错，避免重传 |
| PLI | 快速请求关键帧 |

#### 双 PeerConnection 架构

Audio/Video 分离，串行初始化避免 SDP 冲突。

---

## 面试高频点

### Q1: UniFFI 内存模型？

- Rust 对象通过 `Arc<T>` 管理引用计数
- 传给 Kotlin 时增加计数，返回 Handle
- Kotlin GC 时调用 Native 释放

### Q2: KMP vs Flutter？

| 维度 | KMP | Flutter |
|------|-----|---------|
| 共享范围 | 逻辑层 | 逻辑 + UI |
| 性能 | 原生 | 接近原生 |
| 学习成本 | Kotlin | Dart |
| 生态 | 渐成熟 | 成熟 |

### Q3: Rust + UniFFI 适用场景？

- 音视频处理
- 加密算法
- 高性能计算
- 跨平台核心库

---

## 实战案例

### UniFFI 集成

```rust
// Rust
#[uniffi::export]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

```kotlin
// Kotlin (自动生成)
val greeting = greet("World")
```

---

## 知识关联

- [进程与线程](process-and-threads.md)：FFI 与线程安全
- [性能优化](performance-optimization.md)：Rust 性能优势
