+++
date = '2025-09-11T21:51:21+08:00'
draft = false
title = '时间轮算法'
categories = ['rust', 'tokio']
tags = ['Rust', 'Tokio', 'Timer', 'Algorithm', 'Time Wheel']
description = "详解 Tokio 定时器核心算法：分层时间轮的结构、层级设计与工作流程。"
slug = "timer-wheel"

+++

时间轮(Time Wheel)是Tokio定时器实现的核心算法，它通过分层的方式高效管理大量定时器。

## 1. 基本概念

### 1.1 Wheel结构与层级关系

#### 1.1.1 时间轮结构

```rust
pub(crate) struct Wheel {
  ///当前时间轮已过去的时间
  elapsed: u64,
  ///时间轮的分层
  levels: Box<[Level; NUM_LEVELS]>,
  ///Entries queued for firing
  pending: EntryList,
}
```

#### 1.1.2 层级

```rust
struct Level {
  slot: [EntryList; LEVEL_MULT],		//槽位数组
  level: usize,
  occupied: u64,										// bit field指示slot是否占用
}
```

#### 1.1.3 槽位

```rust
struct Slot {
  head: Option<NonNull<TimerShared>>,
}
```

### 1.2 分层设计

Tokio使用多级时间轮（通常为6级），每级包含固定数量的槽位，每级包含固定数量的槽位(slots)：

* 第0级：64个槽位，每个64^0毫秒
* 第1级：64个槽位，每个64^1毫秒
* 第2级：32个槽位，每个64^2毫秒
* 第3级：32个槽位，每个64^3毫秒
* 第4级：32个槽位，每个64^4毫秒
* 第5级：32个槽位，每个64^5毫秒

### 时间轮的工作流程

1. **添加一个500ms后触发的定时器**：
   * 第0级：500 > 64ms → 不适用
   * 第1级：500 / 64 = 7.8 → 放入第7个槽位
2. **时间推进**：
   - 每毫秒检查第0级
   - 每64ms检查第1级
   - 依此类推
3. **降级**：
   - 当高层级的时间轮转动时，将定时器重新分配到更精确的层级

这种多级设计使得tokio能够：

* 精确处理短期定时器(毫秒级)
* 高效管理长期定时器( 年)
* 保持较低的内存占用和计算开销
* 根据`elapsed`确定需要检查的时间轮层级和槽位

时间轮和时英钟（时针、分针、秒针）可以进行类比理解。
