+++
title = 'Kotlin'
description = 'Kotlin 学习笔记：协程基础、挂起函数、Continuation、状态机、CoroutineScope 与结构化并发。'
+++

这个分类目前重点整理 Kotlin 协程。协程笔记会分成两类：一类关注如何正确使用，另一类关注编译器和运行时到底做了什么。

## 推荐阅读顺序

1. **协程知识点**：先理解 suspend、回调转挂起函数、CoroutineScope、async/await 等基础用法。
2. **协程原理**：再看挂起函数、Continuation、CPS 变换、状态机和结构化并发。

## 整理原则

协程相关笔记要把“看起来像同步代码”的表象和“底层状态机 + 回调续体”的本质区分开。实践部分关注生命周期、取消传播、异常处理和线程调度边界。
