+++
date = '2025-09-09T00:20:36+08:00'
draft = true
title = 'Runtime逐文件阅读学习记录'
categories = ['rust']

+++

#### thread_id.rs

* 主要类`ThreadId`，其功能是为线程生成不重复的线程id
* 主要学习到的内容
  * 内存排序，Atomic类不仅是原子操作，还有内存排序的功能

### task_hooks.rs

#### 1. 核心类型

`TaskCallback`

```rust
pub(crate) type TaskCallback = std::sync::Arc<dyn Fn(&TaskMeta<'_>) + Send + Sync>;
```

* 表示一个任务回调函数
* 使用`Arc`实现引用计数，支持多线程共享
* 接收`&TaskMeta<'_>`作为参数，包含任务元数据

`TaskMeta`

```rust
pub struct TaskMeta<'a> {
    id: super::task::Id,         // 任务ID
    spawned_at: SpawnedAt,       // 任务创建位置
    _p: std::marker::PhantomData<&'a ()>,
}
```

* 包含任务的基本数据
* 使用生命周期参数`'a`确保引用的有效性

`TaskHooks`

```rust
pub(crate) struct TaskHooks {
    pub(crate) task_spawn_callback: Option<TaskCallback>,  //任务生成
    pub(crate) task_terminate_callback: Option<TaskCallback>, //任务结束
    #[cfg(tokio_unstable)]
    pub(crate) before_poll_callback: Option<TaskCallback>,
    #[cfg(tokio_unstable)]
    pub(crate) after_poll_callback: Option<TaskCallback>,
}
```

* 在任务不同的状态回调

#### process.rs

主要解决Unix系统上孤儿进程回收问题

- 通过`GlobalOrphanQueue`管理需要回收的进程
- 使用`SignalDriver`监听`SIGCHLD`信号
- 非阻塞地检查子进程状态
- 孤儿进程指父进程已经终止或退出，但子进程仍在运行的进程。
- `SIGCHLD`是用于通知父进程其子进程状态发生变化的信号。

#### park.rs

实现线程的挂起与唤醒
