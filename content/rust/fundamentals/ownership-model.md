+++
title = 'Rust 所有权模型'
date = '2025-09-19T10:20:18+08:00'
draft = false
categories = ['rust']
tags = ['Rust', 'Ownership', 'PhantomData', 'MemoryOrdering']
description = "深入理解 Rust 所有权模型：PhantomData 类型标记与内存排序机制。"
slug = "rust-ownership-model"
+++

Rust 的核心是所有权系统。本文深入两个关键机制：**PhantomData** 的类型标记和 **Memory Ordering** 的并发安全。

---

## 一、PhantomData：零成本类型标记

`PhantomData` 是零大小类型（ZST），运行时不占内存，但编译期提供关键信息。

### 1.1 核心作用

| 作用 | 说明 |
|------|------|
| 类型标记 | 告诉编译器"逻辑上拥有 T" |
| 生命周期追踪 | 帮助验证生命周期正确性 |
| 变体控制 | 影响泛型参数的协变/逆变 |
| Drop 检查 | 影响 Drop 检查器行为 |

### 1.2 经典案例：JoinHandle

```rust
pub struct JoinHandle<T> {
    raw: RawTask,         // 原始任务指针，不直接包含 T
    _p: PhantomData<T>,   // 逻辑上表示"拥有 T"
}
```

`PhantomData<T>` 表示：
- **所有权标记**：`JoinHandle<T>` 逻辑上"拥有"一个 `T` 类型的值
- **类型关联**：将 `RawTask` 与返回类型 `T` 关联
- **Drop 检查**：确保 `JoinHandle` 被 drop 时，`T` 的析构函数正确调用

### 1.3 常见使用场景

```rust
// 1. 不安全代码中标记所有权
struct MyPtr<T> {
    ptr: *mut u8,
    _marker: PhantomData<T>,
}

// 2. 生命周期标记
struct Slice<'a, T> {
    data: *const T,
    len: usize,
    _marker: PhantomData<&'a T>,
}

// 3. 变体控制（使 T 协变）
struct Producer<T> {
    data: *const (),
    _marker: PhantomData<fn() -> T>,
}

// 4. 类型安全抽象
struct Token<T> {
    _private: PhantomData<T>,
}
```

---

## 二、内存排序：并发编程的顺序保证

多线程编程中，编译器和 CPU 会**重排序**指令以优化性能。内存排序用于约束这种重排。

### 2.1 排序强度

| 排序 | 强度 | 保证 | 场景 |
|------|------|------|------|
| Relaxed | 最弱 | 只保证原子性 | 计数器、统计 |
| Acquire/Release | 中等 | Happens-Before | 数据传递 |
| SeqCst | 最强 | 全局顺序 | 复杂同步 |

### 2.2 Release & Acquire

最常用的组合，建立 **Happens-Before** 关系：

- **Release（写）**：确保之前的写操作完成
- **Acquire（读）**：确保之后的读能看到 Release 的写

```rust
use std::sync::atomic::{AtomicBool, Ordering};

// 生产者
data.prepare();                          // 普通写
ready.store(true, Ordering::Release);    // Release

// 消费者
while !ready.load(Ordering::Acquire) {}  // Acquire
data.use_it();                           // 一定能看到 prepare 的结果
```

### 2.3 经典模式：Flag 传递

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3]);
    let ready = Arc::new(AtomicBool::new(false));

    // 生产者
    let data_clone = data.clone();
    let ready_clone = ready.clone();
    thread::spawn(move || {
        // 准备数据
        // ready_clone.store 之前的写不会被重排到后面
        ready_clone.store(true, Ordering::Release);
    });

    // 消费者
    while !ready.load(Ordering::Acquire) {
        std::hint::spin_loop();
    }
    // 这里一定能看到生产者准备的数据
    assert_eq!(data[0], 1);
}
```

### 2.4 一句话总结

| 排序 | 记忆口诀 |
|------|----------|
| Relaxed | 不乱序自己 |
| Acquire/Release | 不乱序别人（保护普通数据） |
| SeqCst | 大家都不乱 |

---

## 知识关联

- [异步基础](async-basics.md)：Pin 与自引用结构
- [Tokio 源码](../source-study/tokio/runtime.md)：运行时的原子操作
