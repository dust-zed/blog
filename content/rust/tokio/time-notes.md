+++
date = '2025-09-11T16:20:08+08:00'
draft = false
title = 'Time的阅读学习记录'
categories = ['rust', 'tokio']
tags = ['Rust', 'Tokio', 'Time', 'Source Code']
description = "Tokio Time 模块源码阅读记录：source.rs, entry.rs, mod.rs 等核心文件详解。"
slug = "time-notes"

+++

## source.rs

* 用于管理时间戳转换
* `start_time`记录运行时启动的绝对时间点

## entry.rs

### 1. 核心数据结构

* `TimerEntry`：表示一个定时器条目
* `TimerShared`：定时器的共享状态，包含并发控制逻辑
* `StateCell`：管理定时器状态的原子操作封装

### 2. 主要功能

#### 定时器状态管理

* 使用原子操作实现无锁状态转换
* 支持定时器的注册、取消和触发
* `StateCell`有三种状态
  * 具体的过期时间戳（定时器已调度，待触发）
  * `STATE_PENDING_FIRE`（定时器已到期，正准备触发）
  * `STATE_DEREGISTERED`(已取消/完成)

```rust
[已调度] -- 时间到 --> [待触发] -- 触发完成 --> [已取消]
   |                                          ^
   |                                          |
   +------------------ 取消 -------------------+
```

* `TimerShared`负责管理定时器的共享状态和并发安全，分离了定时器的注册时间，用于时间轮调度
* `TimerEntry`是用户可见的句柄，包含完整的生命周期管理

## mod.rs

负责管理所有与时间相关的功能

### 核心结构

* Driver结构体，时间驱动的主要实现，负责
  * 管理时间轮（time wheel）实例
  * 处理定时器的注册、取消和触发
  * 与I/O驱动协同工作
* `Inner`和`InnerState`
  * 包含时间轮实例
  * 管理驱动状态（如是否已关闭）
  * 提供线程安全的内部状态访问

### 关键方法

process_at_time方法

* 处理当前时间点所有到期的定时器
* 处理系统时间回退的情况
* 批量唤醒等待的任务

reregister方法

* 重新注册定时器到新的时间点
* 线程安全的更新定时器
* 处理驱动关闭的情况
