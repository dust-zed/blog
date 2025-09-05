+++
date = '2025-09-05T18:51:54+08:00'
draft = false
title = 'Waker和Context机制'
categories = ['rust', 'tokio']

+++

#### 基本概念

* **Context**：提供异步任务执行的上下文信息，最重要的是包含Waker
* **Waker**：用于唤醒被挂起的异步任务的机制
* **Poll**：Future的轮询状态, `Ready`或`Pending`

#### Context的定义

`Context` 是Rust标准库中`std::task`模块提供的结构体，它主要包含：

1. 对`Waker`的引用
2. 可选的任务本地存储

在Tokio中，`Context`主要用于：

```rust
impl Future for MyFuture {
    type Output = ();

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // 使用 cx.waker() 获取 Waker
        // 当 I/O 未就绪时，保存 Waker 以便后续唤醒
    }
}
```

#### Waker的核心实现

在Tokio中，`Waker`是异步任务通知机制的核心。先看看Tokio中的关键实现

```rust
pub(super) struct WakerRef<'a, S: 'static> {
  waker: ManuallyDrop<Waker>,
  _p: PhantomData<(&'a Header, S)>,
}
```

##### Waker的创建

```rust
fn raw_waker(header: NonNull<Header>) -> RawWaker {
  let ptr = header.as_ptr() as *const();
  RawWaker::new(ptr, &WAKER_VTABLE)
}
```

##### Waker的VTable

```rust
static WAKER_VTABLE: RawWakerVTable = RawWakerVTable::new(
    clone_waker,    // 克隆 Waker
    wake_by_val,    // 消费 Waker 并唤醒任务
    wake_by_ref,    // 不消费 Waker 的情况下唤醒任务
    drop_waker,     // 释放 Waker 资源
);
```

##### waker的生命周期

1. 创建： 当任务被创建时，会创建一个对应的Waker
2. 唤醒：当I/O事件就绪或定时器触发
3. 消费：任务被唤醒后，Waker会被消费掉
4. 重建：如果需要再次唤醒任务，需要重新创建Waker

#### 工作流程示例

简易的任务唤醒流程：

##### 1. 任务创建

```rust
let task = async {
  //异步代码
}
tokio::spawn(task);
```

##### 2. Waker创建

* Tokio运行时为任务创建Waker
* Waker包含指向任务状态的指针

##### 3. I/O注册

```rust
// 当调用类似 TcpStream::read 时
let ready = ready!(self.io.poll_read_ready(cx)?);
```

##### 4. 任务挂起

* 如果I/O未就绪，保存Waker
* 返回`Poll::Pending`

##### 5. 事件就绪

* I/O事件就绪，保存Waker
* 事件循环调用保存的Waker的`wake()`方法

##### 6. 任务恢复

* Waker将任务放回就绪队列
* 调度器再次轮询该任务
