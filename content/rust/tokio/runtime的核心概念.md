+++
date = '2025-09-06T18:53:34+08:00'
draft = false
title = 'Runtime的核心概念'
categories = ['rust', 'tokio']

+++

#### 1. Runtime基本架构

Tokio的runtime是异步应用的核心，主要负责：

* 任务调度
* I/O事件循环
* 定时器管理
* 线程池管理

让我们看看runtime的主要组件：

##### 1.1 Runtime结构体

`Runtime`结构体是整个异步运行时的入口点。

```rust
pub struct Runtime {
  /// Task scheduler
  scheduler: Scheduler,
  /// handles to runtime, also contains driver handles
  handle: Handle,
  /// Blocking pool handle, used to signal shutdown
  blocking_pool: BlockingPool,
}
```

#### 2. 核心组件

##### 2.1 scheduler

**作用：**

* 负责任务的调度和执行
* 管理任务队列和任务状态
* 决定任务的执行顺序

**设计原因**

- 将调度逻辑与运行时其他部分解耦
- 支持不同的调度策略（单线程/多线程）
- 使调度器可以独立测试和优化

##### 2.2 handle

**作用：**

- 提供对运行时的轻量级引用
- 允许在运行时外部分发任务
- 包含对I/O驱动、定时器等组件的访问

**设计原因**

- 避免直接暴露`Runtime`的所有权
- 允许多个地方持有对运行时的引用
- 支持跨线程发送任务
- 便于在异步代码中获取当前运行时

##### 2.3 BlockingPool

**作用：**

- 管理阻塞操作的工作线程池
- 执行可能阻塞的操作，如文件I/O或CPU密集型计算
- 防止阻塞操作影响异步任务调度

**设计原因**

- 隔离阻塞操作，避免影响事件循环
- 提供明确的API来处理阻塞操作
- 允许控制阻塞操作的并发度

#### 3. 整体设计考量

##### 1. 关注点分离

- `scheduler`处理任务调度
- `handle`提供运行时访问
- `blocking_pool`处理阻塞操作

##### 2. 所有权管理

- `Runtime`拥有所有资源的所有权
- `Handle`提供了共享访问的方式
- 资源在`Runtime`被drop时正确清理

##### 3. 性能优化

* 轻量级的`Handle`可以大量复制
* 阻塞操作不会阻塞事件循环
* 调度器可以根据需要选择单线程或多线程实现

##### 4. 灵活性

- 支持不同的运行时配置
- 可以扩展新的调度策略
- 便于测试和模拟

#### Handle为什么是Runtime的轻量级引用

1. `Runtime`中的`scheduler`字段
   - 这是主要的`Scheduler`实例
   - 它拥有任务队列和其他资源
2. `Handle`中的引用
   - 不是引用`Scheduler`本身
   - 而是引用`Scheduler`内部的共享状态
   - 这些状态通常是通过`Arc`包装的独立结构
3. 具体实现
   - `CurrentThread`调度器可能使用`Rc<RefCell<...>>`
   - `MultiThread`调度器使用`Arc`进行线程间共享
   - 这些内部结构在`Scheduler`初始化创建

4. 所有权关系

```rust
struct CurrentThread {
    // 内部使用 Rc 共享状态
    shared: Rc<Shared>,
    // ...
}

struct Handle {
    // 共享相同的 Rc<Shared>
    shared: Rc<Shared>,
    // ...
}
```

- 创建Handle时，会克隆`Arc/Rc`增加引用计数
- 这样的设计体现了`Scheduler`是`Runtime`的核心

#### 文件I/O为什么使用阻塞线程池

- 网络I/O：现代操作系统提供了专门的非阻塞API（如Linux的epoll，macOS的kqueue）
- 文件I/O：大多数操作系统的文件系统API底层仍然是阻塞的
- 性能考量：文件操作通常比网络操作快得多；使用非阻塞API反而增加开销；磁盘I/O的延迟通常比网络I/O更可预测。
