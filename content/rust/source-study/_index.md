+++
title = '源码学习'
description = '通过阅读优秀开源项目源码学习 Rust 最佳实践。'
+++

## 学习路径

### Tokio 运行时

| 主题 | 重点 |
|------|------|
| [运行时概念](tokio/runtime-concepts.md) | Runtime 整体架构 |
| [调度器](tokio/runtime-code-reading.md) | 任务调度原理 |
| [时间轮](tokio/timer-wheel.md) | 定时器实现 |
| [并发处理](tokio/handle-responsibilities.md) | Handle 职责 |
| [线程停车](tokio/park-thread.md) | 线程休眠与唤醒 |

### 标准库

| 主题 | 重点 |
|------|------|
| [迭代器](std/iterator.md) | Iterator trait 实现 |
| [Option 所有权](std/option-ownership-pattern-matching.md) | 模式匹配与所有权 |

### 命令行工具

| 主题 | 重点 |
|------|------|
| [ripgrep 命令](ripgrep/ripgrep-command.md) | 高性能搜索 |
| [ripgrep Glob](ripgrep/glob-syntax.md) | 文件匹配语法 |

### HTTP 客户端

| 主题 | 重点 |
|------|------|
| [reqwest 概述](reqwest/index.md) | HTTP 客户端设计 |
