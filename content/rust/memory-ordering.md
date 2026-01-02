+++
date = 2025-09-08T11:16:22+08:00
title = "Rust 并发编程：深入理解内存排序 (Memory Ordering)"
categories = ["rust"]
tags = ["并发", "原子操作", "内存模型", "底层原理"]
series = ["Rust 并发进阶"]
description = "深入理解 Rust 内存排序：Relaxed, Release/Acquire, SeqCst 的区别与应用场景。"
slug = "memory-ordering"
+++

在多线程编程中，编译器和 CPU 为了追求极致性能，会对指令进行**重排序 (Reordering)**。内存排序（Memory Ordering）就是我们用来告诉编译器和 CPU：“这里的顺序不能乱，必须按我规定的来”。

Rust 通过 `std::sync::atomic::Ordering` 枚举提供了从弱到强的几种排序约束。

## 1. Relaxed (松散顺序)
* **强度**：最弱。
* **保证**：只保证**当前原子操作本身**是原子的。
* **不保证**：不保证多线程间的操作顺序，也不保证其他普通变量的读写顺序。
* **适用场景**：全局计数器、统计数据（不依赖其他数据）。

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
static COUNTER: AtomicUsize = AtomicUsize::new(0);

// 线程 A
COUNTER.fetch_add(1, Ordering::Relaxed);
// 线程 B
let count = COUNTER.load(Ordering::Relaxed);
```
## 2. Release & Acquire (释放与获取)
这是并发编程中最常用的组合，用于建立**先行发生（Happens-Before）**关系。它们必须成对使用。
* Release(写):通常用于发送方。
  * **写屏障**：确保 Release 操作**之前**的所有内存写入（包括普通变量）都已完成。
  * 告诉 CPU：“在我修改这个变量之前，前面所有的数据准备工作都必须落盘”，不能重排到我后面

* Acquire（读）：通常用于接收方。
  * 读屏障：确保在 Acquire 操作**之后**的所有内存读取都能看到 Release 线程写入的数据。
  * 告诉 CPU：“再我读取这个原子变量之后，后面所有的逻辑才能执行，不能重排到我前面。”


### 经典场景：数据传递（Flag 模式）
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3]); // 普通数据
    let ready = Arc::new(AtomicBool::new(false)); // 原子 Flag

    let data_clone = data.clone();
    let ready_clone = ready.clone();

    // 生产者线程
    thread::spawn(move || {
        // 1. 准备数据 (普通写)
        // thread::sleep(...); 
        
        // 2. 发送信号 (Release)
        // 保证：上面的数据准备一定会在这一步之前完成，不会被乱序下去
        ready_clone.store(true, Ordering::Release); 
    });

    // 消费者线程
    // 3. 等待信号 (Acquire)
    while !ready.load(Ordering::Acquire) {
        std::hint::spin_loop();
    }
    
    // 4. 读取数据 (普通读)
    // 保证：因为上面用了 Acquire，这里的读取一定能看到线程 A 准备好的数据
    assert_eq!(data[0], 1);
}
```
## 3. AcqRel
* 语义：同时包含 Acquire 和 Release
* 场景：通常用于`fetch_add`或`compare_and_exchange`这种既读又写的操作。你希望读取之时保证之前的顺序，写入时保证之后的顺序。

## 4. SeqCst (顺序一致性)
* 强度：最强。

* 保证：除了包含 Acquire/Release 的所有保证外，还保证全局唯一的执行顺序。

* 代价：性能开销最大（通常会阻止 CPU 缓存优化，强制同步所有核心的缓存）。

* 场景：当多个线程同时对多个原子变量进行操作，且你非常关心它们在时间线上的绝对先后顺序时。如果你不确定用什么，用 SeqCst 通常是安全的，但可能较慢。

## 总结
一句话记忆：`Relaxed` 是为了不乱序自己；`Acquire/Release` 是为了不乱序别人（保护普通数据）；`SeqCst` 是为了大家都不乱。