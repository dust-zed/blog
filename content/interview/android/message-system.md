+++
title = 'Android 消息机制'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Handler', 'Looper', 'MessageQueue', 'epoll']
description = "深入理解 Android 消息机制：Handler、Looper、MessageQueue 与 epoll 的工作原理。"
slug = "android-message-system"
+++

## 核心问题

**主线程为什么不会卡死在 Looper.loop() 的死循环里？**

理解这个问题，就理解了 Android 消息机制的核心设计。

---

## 知识脉络

### 第一层：为什么需要消息机制

#### 问题：UI 不是线程安全的

如果允许多线程直接操作 UI：
- 竞态条件导致状态不一致
- 加锁会严重影响性能

#### 解决方案：单线程模型

- **主线程**：唯一能操作 UI 的线程
- **子线程**：通过消息机制通知主线程

```
子线程 → Handler.sendMessage() → 主线程 MessageQueue
                                      ↓
                              主线程 Handler.handleMessage()
```

---

### 第二层：三大核心组件

#### Handler：消息的发送者和处理者

```kotlin
// 发送消息
handler.sendMessage(Message.obtain().apply { what = 1 })
handler.post { /* 在主线程执行 */ }

// 处理消息
handler.handleMessage { msg ->
    when (msg.what) {
        1 -> { /* 处理 */ }
    }
}
```

#### Looper：消息循环

每个线程最多一个 Looper，通过 ThreadLocal 存储。

```java
// Looper 核心逻辑
public static void loop() {
    for (;;) {
        Message msg = queue.next(); // 可能阻塞
        if (msg == null) return;

        msg.target.dispatchMessage(msg);
        msg.recycleUnchecked();
    }
}
```

#### MessageQueue：消息队列

- **结构**：单链表，按时间戳排序
- **支持**：同步消息、异步消息、同步屏障

---

### 第三层：主线程为什么不卡死

#### epoll 机制

当 MessageQueue 没有消息时，不会忙等待，而是通过 **epoll** 让线程休眠。

```java
// MessageQueue.next()
Message next() {
    for (;;) {
        // 通过 epoll_wait 休眠
        nativePollOnce(ptr, nextPollTimeoutMillis);

        synchronized (this) {
            Message msg = mMessages;
            if (msg != null) return msg;
        }
    }
}
```

#### 唤醒机制

当有新消息入队时，通过 `nativeWake()` 唤醒 epoll：

```java
boolean enqueueMessage(Message msg, long when) {
    synchronized (this) {
        // 入队...
        if (needWake) {
            nativeWake(mPtr);  // 唤醒
        }
    }
}
```

#### 总结

| 状态 | 行为 |
|------|------|
| 无消息 | epoll 休眠，释放 CPU |
| 有消息 | 唤醒，处理消息 |
| 处理过久 | ANR（不是 loop 本身的问题） |

---

### 第四层：同步屏障

#### 什么是同步屏障

一个 **target 为 null** 的特殊消息。遇到屏障时，Looper 只处理异步消息。

#### 作用

确保高优先级任务（如 UI 刷新）不被普通消息阻塞。

```java
// ViewRootImpl
void scheduleTraversals() {
    mTraversalBarrier = mHandler.getLooper().getQueue().postSyncBarrier();
    mChoreographer.postCallback(...);
}

void doTraversal() {
    mHandler.getLooper().getQueue().removeSyncBarrier(mTraversalBarrier);
    performTraversals();
}
```

#### 注意

**必须手动移除**，否则主线程假死。

---

### 第五层：IdleHandler

#### 概念

在消息队列空闲时执行的回调。

```kotlin
Looper.myQueue().addIdleHandler {
    // 空闲时执行
    preloadData()
    false  // 返回 false 表示只执行一次
}
```

#### 使用场景

- 预加载资源
- 延迟初始化
- 非紧急任务

---

## 面试高频点

### Q1: Handler 内存泄漏原因及解决？

**原因**：非静态内部类持有外部类引用，Message 持有 Handler。

**解决**：

```kotlin
// 方案一：静态内部类 + 弱引用
class SafeHandler(activity: Activity) : Handler(Looper.getMainLooper()) {
    private val ref = WeakReference(activity)
    override fun handleMessage(msg: Message) {
        ref.get()?.let { /* 处理 */ }
    }
}

// 方案二：及时清理
override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
}
```

### Q2: post() 和 sendMessage() 区别？

| 方法 | 本质 |
|------|------|
| `post(Runnable)` | Runnable 存入 Message.callback |
| `sendMessage(Message)` | 直接发送 Message |

处理优先级：Message.callback > Handler.mCallback > handleMessage()

### Q3: ThreadLocal 原理？

每个 Thread 内部维护一个 Map，以 ThreadLocal 为 key 存储数据。

```java
// ThreadLocal.set()
void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = t.threadLocals;
    map.set(this, value);
}
```

### Q4: 如何在子线程创建 Handler？

```kotlin
Thread {
    Looper.prepare()  // 创建 Looper
    val handler = Handler()
    Looper.loop()     // 开始循环
}.start()
```

---

## 实战案例

### 延迟任务的最佳实践

```kotlin
// 不推荐：可能导致内存泄漏
handler.postDelayed({ updateUI() }, 1000)

// 推荐：使用生命周期感知的延迟
view.postDelayed({ updateUI() }, 1000)

// 清理
override fun onDestroyView() {
    view.removeCallbacks(null)
}
```

### 主线程卡顿监控

```kotlin
class BlockDetector : Printer {
    private var startTime = 0L

    override fun println(x: String?) {
        if (x?.startsWith(">>>>> Dispatching to") == true) {
            startTime = System.currentTimeMillis()
        } else if (x?.startsWith("<<<<< Finished to") == true) {
            val duration = System.currentTimeMillis() - startTime
            if (duration > 500) {
                Log.w("Block", "Main thread blocked for ${duration}ms")
            }
        }
    }
}

// 使用
Looper.getMainLooper().setMessageLogging(BlockDetector())
```

---

## 知识关联

- [渲染系统](rendering-system.md)：同步屏障在渲染中的应用
- [进程与线程](process-and-threads.md)：线程模型与通信
- [异步编程](async-programming.md)：协程如何替代 Handler
