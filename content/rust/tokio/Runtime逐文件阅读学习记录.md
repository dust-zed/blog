+++
date = '2025-09-09T00:20:36+08:00'
draft = true
title = 'Runtime逐文件阅读学习记录'
categories = ['rust', 'tokio', 'runtime']

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

#### driver.rs

在tokio运行时中扮演着聚合和管理不同I/O和系统事件驱动器的角色。主要处理线程的挂起和唤醒机制。

##### 1. 驱动器聚合

* 它聚合了多种底层驱动器，包括I/O驱动器(`IoDriver`)，信号驱动器(`SingalDriver`)和事件驱动器(`TimeDriver`)

##### 2. 唤醒/挂起支持

* 提供了`park()`和`unpark()`方法用于线程的挂起和唤醒
* `park()`方法会使当前线程进入休眠状态，等待事件发生
* `unpark()`方法用于唤醒被挂起的线程

##### 3. 多模式支持

* 支持启用或禁用特定功能(如I/O驱动)的不同运行时配置
* 例如，`IoStack`枚举有`Enabled`和`Disabled`两种变体，分别对应启用和禁用I/O驱动的情况

##### 4. 超时支持

* 提供了`park_timeout()`方法，允许线程唤醒在指定的超时后自动唤醒

##### 5. 优秀设计

关注点分离，`IoStack`关注于parking,`IoHandle`关注于unparking

##### config.rs

runtime命令配置，用于定制运行时行为。以下是各字段的详细说明

1. **`global_queue_interval: Option<u32>`**
   * 控制从全局/远程任务队列拉取任务的频率
   * `None`表示每次检查全局队列
   * `Some(n)`表示每n个tick检查一次全局队列
2. **`event_interval: u32`**
   * 执行定时器和I/O事件检查的频率
   * 较小的值提高响应性，但可能增加CPU使用率

3. **`before_park: Option<Callback>`**

   - 工作线程挂起前执行的回调

   - 用于执行线程特定的清理或状态保存

4. **`after_unpark: Option<Callback>`**

   - 工作线程唤醒后执行的回调

   - 用于恢复线程特定状态或执行初始化

5. **`before_spawn: Option<TaskCallback>`**

   - 每个任务生成前执行的回调

   - 用于任务级别的监控或初始化

6. **`after_termination: Option<TaskCallback>`**

   - 每个任务终止后执行的回调

   - 用于资源清理或统计信息收集

7. **`before_poll: Option<TaskCallback>`** (仅限 unstable 特性)
   - 每次 poll 操作前执行的回调
   - 用于性能分析或调试

8. **`after_poll: Option<TaskCallback>`** (仅限 unstable 特性)

   - 每次 poll 操作后执行的回调

   - 通常与 `before_poll` 配对使用

9. **LIFO 插槽相关配置**（代码片段中未完全显示）

   - 用于优化任务调度

   - 特别适用于消息传递等模式

#### builder.rs

`Runtime`核心构建配置

##### **I/O驱动`enable_io`和`nevents`**

* `enable_io`：是否启用I/O驱动
  * 启用时：支持异步I/O操作（如TCP/UDP套接字、文件I/O等）
  * 禁用时：相关API将不可用，减少运行时开销
* `nevents`： 每次轮询时处理的最大事件数
  * 影响I/O吞吐量和响应性
  * 值越大，吞吐量可能越高，但延迟可能增加

##### 事件驱动(`enable_time`)

* 控制是否启用时间相关的功能
* 启用时：
  * 支持`tokio::time`模块（如`sleep`、`timeout`等）
  * 允许使用定时器和时间相关的异步操作
* 禁用时：
  * 减少运行时开销
  * 事件相关`API`将不可用

##### 时钟控制(`start_paused`)

* 控制运行时时钟的初始状态
* `true`：时钟从暂停状态开始
  * 时间不会自动推进
  * 适用于测试，可以精确控制时间
* `false`(默认)：使用系统时钟
  * 时间正常流逝
  * 适用于生产环境

##### 时间驱动(Time Wheel)实现

- 使用多级时间轮管理定时器
- 每个时间轮有不同的精度，形成层级结构
  - 第一级：毫秒级精度
  - 第二级：秒级精度
  - 更高层：分钟/小时级精度
- 优点：O(1) 时间复杂度插入/删除定时器

##### 系统调用

- 主要使用 `timerfd` (Linux) 或 `kqueue` (macOS) 等系统级定时器
- 与 I/O 多路复用集成，统一事件循环

##### 与I/O驱动的集成

```rust
// 简化的时间轮结构
struct TimeWheel {
    // 不同精度的时间轮
    wheels: [Wheel; LEVELS],
    // 当前时间
    now: u64,
}
```

