+++
date = '2026-02-21T09:56:14+08:00'
draft = true
title = 'Embers : Stream与tokio::select的艺术'
+++

#### 前言

在云游戏的实时系统中，我们面临一个核心问题：**如何优雅地处理无限的数据流？**

屏幕每秒产生 60 帧，网络每秒传输数千个包 --- 这些都是“无限流”，没有明确的终点。传统的迭代器模式在这里显得力不从心，而 Rust 的 Stream 正是为这种场景而生。

---

## 一、从迭代器到 Stream

### 1.1 迭代器的局限

迭代器处理的是同步、有限的数据：

```rust
let numbers = vec![1, 2, 3];
let mut iter = numbers.into_iter();

while let Some(n) = iter.next() {
  println!("{}", n);
}
// 结束，有明确的终点
```

但现实世界的数据流往往是：

* 异步的：数据可能还没准备好
* 无限的：屏幕捕获没有"最后一张"
* 需要等待的：网络包需要时间到达

### 1.2 Stream 是什么？

Stream 就是**异步版本的迭代器**：

```rust
// 迭代器
trait Iterator {
  type Item;
  fn next(&mut self) -> Option<Self::Item>;
}
// Stream 简化版
trait Stream {
  type Item;
  fn poll_next(self: Pin<&mut self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>>;
}
```

使用时的感觉：

```rust
while let Some(item) = stream.next().await {
  // 每个 item 可能需要等待
  process(item);
}
```

**关键区别：** `next()`是`async`的，意味着每次获取元素都可能让出控制权。

---

## 二、函数式流：unfold 模式

### 2.1 传统方式 vs 函数式方式

假设我们要实现屏幕捕获流，传统思路是写一个循环：

```rust
// 命令式：难以组合、难以测试
fn capture_loop(mut capture: Capture) {
  loop {
    let frame = capture.next_frame();
    process(frame);
  }
}
```

函数式的思路是：**把如何产生下一个元素和如何消费一个元素分离**。

### 2.2 unfold: 将状态机变成流

`futures::stream::unfold`是创建流的利器：

```rust
use futures::stream::{self, Stream};
fn infinite_counter() -> impl Stream<Item = u64> {
  stream::unfold(0u64, |state| async move {
    // 返回，(当前值，下一个状态)
    Some((state, state + 1))
  })
}
```

