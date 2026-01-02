+++
date = '2025-09-10T10:04:26+08:00'
draft = false
title = 'Park 线程挂起的实现'
categories = ['rust', 'tokio']
tags = ['Rust', 'Tokio', 'Concurrency', 'Thread Park']
description = "深入解析 Tokio 中 Park 线程挂起与恢复的实现机制（park.rs）。"
slug = "park-thread-suspension"

+++

`park.rs`是Tokio运行时中用于线程挂起和恢复的核心。

## 核心结构

### ParkThread 和 UnParkThread

```rust
pub(crate) struct ParkThread {
  inner: Arc<Inner>,
}

pub(crate) struct UnParkThread {
  inner: Arc<Inner>,
}
```

乍一看，这两根本就是相同的结构，但是它们是用在不同地方的，以及impl块有区别。

```rust
tokio_thread_local! {
    static CURRENT_PARKER: ParkThread = ParkThread::new();
}
```

这是最重要的区别，`ParkThread`用在了线程局部变量上，而`UnParkThread`没有线程局部限制，另外`UnParkThread`只实现了`unpark`方法，目的是让其他线程只能唤醒。

### Inner

`Inner`结构体使用原子操作管理线程状态，这种状态管理是构建无锁并发原语的基础。

```rust
const EMPTY: usize = 0;			//初始状态或unpark状态
const PARKED: usize = 1;		//线程已挂起
const NOTIFIED: usize = 2;	//线程已被通知唤醒

struct Inner {
  state: AtomicUsize,
  mutex: Mutex<()>,
  condvar: Condvar,
}
```

* 为什么直接用`Mutex<Usize>`而是多用了一个`AtomicUsize`
  * `AtomicUsize`是无锁的，比获取 `Mutex`快
  * 内存顺序保证
  * 状态更新使用原子操作，减少锁的持有时间
  * 锁粒度控制，`Mutex`只保护条件变量的等待/通知时机

## 具体功能的实现

### park()

```rust
fn park(&self) {
  if self
  		.state
  		.compare_exchange(NOTIFIED, EMPTY, SeqCst, SeqCst)
  		.is_ok() {
        return; // “虚假唤醒”保护，另一个线程unpark，此线程又park，避免了没必要的线程挂起和唤醒操作
  }
  // 获取锁,并修改状态至parked
  let mut m: std::sync::MutexGuard<'_, ()> = self.mutex.lock();
  match self.state.compare_exchange(EMPTY, PARKED, SeqCst, SeqCst) {
    Ok(_) => {}
    Err(NOTIFIED) => {
      let old = self.state.swap(EMPTY, SeqCst);
      debug_assert_eq!(old, NOTIFIED, "park state changed unexpectedly");
      return;
    }
    Err(actual) => panic!("inconsistent park state; actual = {actual}"),
  }
  loop {
    m = self.condvar.wait(m).unwrap(); //释放锁并挂起线程等待notify
    if self
    		.state
    		.compare_exchange(NOTIFIED, EMPTY, SeqCst, SeqCst)
    		.is_ok() 
    {
      return; //确保有效唤醒，NOTIFIED -> EMPTY,忽略错误唤醒
    }
  }
}
```

#### 双重检查模式

* 第一次检查避免不必要的锁获取
* 第二次检查处理竞态条件

#### 虚假唤醒处理

```rust
loop {
    m = self.condvar.wait(m).unwrap();
    if self.state.compare_exchange(NOTIFIED, EMPTY, SeqCst, SeqCst).is_ok() {
        return;
    }
}
```

这个循环确保只有收到真正的通知才会返回，处理了条件变量的虚假唤醒问题。

### unpark

```rust
fn unpark(&self) {
  //无论什么状态都置为NOTIFIED
  match self.state.swap(NOTIFIED, SeqCst) {
    EMPTY => return,
    NOTIFIED => return,
    PARKED => {}
    _ => panic!("inconsistent state in unpark"),
  }
  //通过lock确保目标线程已经是PARKED了
  drop(self.mutex.lock());
  self.condvar.notify_one();
}
```

通过控制ParkThread和UnParkThread的方法，完成了功能分离，配合之前的`ThreadLocal`,完成了线程自己挂起，然后其他线程可以唤醒此线程的功能。同时UnParkThread也可以转为`Waker`。

### shutdown

通知线程该醒了，具体的shutdown操作由调用者处理。

### CachedParkThread

1. 缓存`Waker`避免重复分配
2. 提供`block_on`方法，这是运行时执行future的基础
3. 通过线程局部存储管理每个线程的parker
4. `_anchor: PhantomData<Rc<()>>`隐含了`!Send + !Sync`，CachedParkThread 不可跨线程。
