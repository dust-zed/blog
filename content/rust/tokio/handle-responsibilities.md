+++
date = '2025-09-12T02:39:18+08:00'
draft = true
title = '各类Handle之职责区分'
categories = ['rust', 'tokio']
tags = ['Rust', 'Tokio', 'Handle', 'Architecture']
description = "Tokio 中各类 Handle (Runtime, Time, Scheduler, IO) 的职责与设计目的区分。"
slug = "handle-responsibilities"

+++

Tokio中的Handle有很多，它们各自负责不同的功能模块。

## 1. runtime::Handle

* runtime的顶层句柄
* 提供创建任务、进入运行时上下文的能力
* 包含其他子系统的句柄

## 2. time::Handle

* 时间子系统的入口
* 管理定时器和时间相关的操作
* 内部持有`scheduler::Handle`来唤醒任务

## 3. scheduler::Handle

* 任务调度的核心句柄
* 负责任务的提交和唤醒
* 被其他Handle用来与调度器交互

## 4.IoStack / IoHandle

*  I/O子系统的句柄
* 管理I/O资源和事件交互
* 与操作系统I/O原语交互

## 引用关系

```rust
runtime::Handle
  ├── time::Handle
  │     └── scheduler::Handle
  ├── scheduler::Handle
  └── IoStack
        └── IoHandle
```

## 设计目的

1. 关注点分离：每个Handle只关注自己的领域
2. 生命周期管理：通过Arc共享所有权
3. 线程安全：内部使用锁或原子操作
4. 灵活性：可以单独使用或组合使用
