+++
date = '2025-09-19T12:38:14+08:00'
draft = false
title = 'Tokio任务系统解析'
categories = ['rust', 'tokio']

+++

Tokio的任务系统是其异步运行时的核心，它负责调度和执行异步任务。让我们深入分析其设计和实现。

### 1. 核心组件

#### 1.1 任务表示

```rust
pub(crate) struct Task<S: 'static> {
  raw: RawTask,
  _p: PhantomData<S>,
}
```

* `RawTask`：实际的任务数据，包含任务状态、调度器等。
* `PhantomData<S>`：关联调度器类型，用于类型安全

#### 1.2 任务头(Header)

```rust
pub(crate) struct Header {
    state: State,                   // 任务状态
    queue_next: UnsafeCell<...>,    // 任务队列指针
    vtable: &'static Vtable,        // 虚函数表
    owner_id: UnsafeCell<...>,      // 任务所有者ID
    // ...
}
```

#### 2. 任务生命周期

#### 2.1 创建任务

```rust
fn new_task<T, S>(task: T, scheduler: S, id: Id) -> (Task<S>, Notified<S>, JoinHandle<T::Output>)
where
    T: Future + 'static,
    S: Schedule,
{
    let raw = RawTask::new::<T, S>(task, scheduler, id, spawned_at);
    // 创建三种句柄
    let task = Task { raw, _p: PhantomData };
    let notified = Notified(Task { raw, _p: PhantomData });
    let join = JoinHandle::new(raw);
    (task, notified, join)
}
```

`RawTask`实现了Copy，故这里可以这样做，同时我们需要知道`RawTask`的初始引用计数状态。

```rust
pub(super) fn new() -> State {
  State {
    val: AtomicUsize::new(INTIAL_STATE),
  }
}
```

初始状态设置为：

```rust
const INITIAL_STATE: usize = (REF_ONE * 3) | JOIN_INTEREST | NOTIFIED;
```

这意味着：

1. 初始引用计数是`REF_ONE * 3`
2. 同时设置了 `JOIN_INTEREST` 和 `NOTIFIED` 标志位

一个任务创建会返回三个句柄：

1. `Task`：用于取消或释放任务
2. `Notified`：表示任务已准备好执行
3. `JoinHandle`：用于等待任务完成并获取结果

### 3. 核心机制

#### 3.1 任务调度

```rust
// 在调度器中的执行循环
loop {
    let task = self.next_task();  // 获取下一个就绪任务
    task.run();                  // 执行任务
}
```

#### 3.2 唤醒机制

```rust
// Waker 实现
struct Waker {
    header: NonNull<Header>,
    // ...
}

impl std::task::Wake for Waker {
    fn wake(self) {
        self.wake_by_ref();
    }
    
    fn wake_by_ref(&self) {
        // 将任务标记为就绪并重新调度
        unsafe { (self.header.as_ref().vtable.schedule)(self.header) };
    }
}
```

### 4. 内存管理

#### 4.1 任务分配

```rust
impl<T: Future, S: Schedule> RawTask<T, S> {
    fn new(future: T, scheduler: S, id: Id) -> NonNull<Header> {
        // 1. 计算内存布局
        // 2. 分配内存
        // 3. 初始化 Header 和 Future
        // 4. 返回指向 Header 的指针
    }
}
```

#### 4.2 内存布局

```rust
+-------------------+
|      Header       |  // 包含任务元数据和虚函数表
+-------------------+
|   Scheduler (S)   |  // 调度器实例
+-------------------+
|   Future (T)      |  // 实际的 Future
+-------------------+
|   Output Slot     |  // 存储 Future 的输出
+-------------------+
|   Traces          |  // 调试和跟踪信息
+-------------------+
```

### 5. 并发控制

#### 5.1 状态管理

```rust
struct State {
    // 使用原子操作管理状态
    // - 运行中标志
    // - 完成标志
    // - 取消标志
    // - 引用计数
    value: AtomicUsize,
}
```

具体来说：

* 高位的比特位用于引用计数(`REF_COUNT_MASK`)
* 低位的比特位用于任务状态(`STATE_MASK`)

#### 5.2 锁优化

```rust
// 使用无锁算法优化热点路径
fn transition_to_running(&self) -> TransitionToRunning {
    // 使用原子操作更新状态
    // 避免使用互斥锁
}
```

### 7. 设计模式

#### 7.1 类型擦除

```rust
// 使用虚函数表实现类型擦除
struct Vtable {
    poll: unsafe fn(NonNull<Header>),
    dealloc: unsafe fn(NonNull<Header>),
    // ...
}
```

#### 7.2 零成本抽象

```rust
// 使用泛型和编译期多态
impl<T, S> Task<T, S> {
    // 零成本抽象
}
```

