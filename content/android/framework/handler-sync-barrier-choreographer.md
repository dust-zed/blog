+++
title = "Android Handler 深入：同步屏障与 Choreographer 调度机制"
date = "2026-08-10T00:00:00+08:00"
draft = false
description = "深入分析 Android Handler 消息机制中的同步屏障、异步消息与 Choreographer 帧调度流程，理解 UI 渲染为何能优先于普通同步消息执行。"
slug = "android-handler-sync-barrier-choreographer"
categories = ["android"]
tags = ["Android", "Handler", "MessageQueue", "Sync Barrier", "Choreographer"]

+++

这篇是 Handler 消息机制的进阶笔记，重点把 `MessageQueue.next()`、同步屏障、异步消息、IdleHandler、Printer 和 Choreographer 串成一条线。

## 核心结论

1. 同步屏障本质是一条没有 `target` 的特殊消息。
2. 同步屏障存在时，普通同步消息会被挡住，异步消息可以优先执行。
3. Choreographer 借助异步消息和 VSYNC，把输入、动画、布局绘制组织到一帧内。
4. `IdleHandler` 发生在队列空闲或下一条消息尚未到期时，适合做低优先级任务。
5. `Printer` 能观察消息分发前后，但不能覆盖消息等待阶段。

## 一、Handler总体流程

> Looper 每执行一轮，到底如何决定“下一步做什么”？

基础 Handler 机制只解释了正常路径：

```
MessageQueue.next()
        ↓
取出 Message
        ↓
Handler.dispatchMessage()
        ↓
再次 next()
```

而进阶机制，本质上是在这个循环的不同位置插入特殊能力：

```
MessageQueue.next()
├─ 普通消息调度
├─ SyncBarrier / Async Message
├─ IdleHandler
└─ nativePollOnce()

Looper.loopOnce()
├─ Printer
├─ Observer
├─ Trace / Slow dispatch
└─ Handler.dispatchMessage()

更上层：
Choreographer
└─ 借助异步消息 + VSYNC 构建帧调度
```

下面我们从源码把它们串起来讲：

---

## 二、先重新看一次Looper.loopOnce()

```java
for (;;) {
    Message msg = queue.next();

    msg.target.dispatchMessage(msg);

    msg.recycleUnchecked();
}
```

但实际上 AOSP 的`loopOnce()`在`dispatchMessage()`前后做了不少事情。

其中有一段：

```java
final Printer logging = me.mLogging;

if (logging != null) {
    logging.println(
        ">>>>> Dispatching to "
        + msg.target + " "
        + msg.callback + ": "
        + msg.what
    );
}

msg.target.dispatchMessage(msg);

if (logging != null) {
    logging.println(
        "<<<<< Finished to "
        + msg.target + " "
        + msg.callback
    );
}
```

也就是说，一条 Message 的执行过程实际上类似：

```
MessageQueue.next()
        ↓
Printer：Dispatching
        ↓
Observer / Trace 等监控开始
        ↓
Handler.dispatchMessage()
        ↓
Observer / Trace 等结束
        ↓
Printer：Finished
        ↓
Message.recycle()
```

当前 AOSP 的`Looper.setMessageLogging()`明确就是在**每条消息 dispatch 开始和结束时调用 Printer**。

## 三、Printer：Looper 天然提供的消息监控点

API:

```java
Looper.getMainLooper().setMessageLogging(printer);
```

例如：

```java
Looper.getMainLooper().setMessageLogging { text ->
    Log.d("LooperMonitor", text)
}
```

实际上`Printer`只有：

```java
void println(String x);
```

Looper会在消息执行前打印类似：

```
>>>>> Dispatching to Handler ... : 0
```

执行结束后：

```
<<<<< Finished to Handler ...
```

源码就是在`dispatchMessage()`前后进行这两次回调。

因此你可以记录时间：

```java
Looper.getMainLooper().setMessageLogging { line ->

    if (line.startsWith(">>>>>")) {
        start = SystemClock.uptimeMillis()
    }

    if (line.startsWith("<<<<<")) {
        val cost =
            SystemClock.uptimeMillis() - start

        if (cost > 100) {
            Log.w(
                "BlockMonitor",
                "Main thread blocked ${cost}ms"
            )
        }
    }
}
```

这就是很多早期卡顿监控方案的基本思想：

```
Dispatching
    ↓
记录开始时间
    ↓
Message 执行
    ↓
Finished
    ↓
计算耗时
```

所以`Printer`并不是普通意义上的日志 API。

它实际暴露了一个非常重要的 Hook：

> Looper 每条消息执行的边界。

---

## 四、Printer能检测什么，不能检测什么

假设：

```kotlin
handler.post {
  	Thread.sleep(1000)
}
```

Printer 可以非常容易发现：

```
Dispatching
    ↓
1000ms
    ↓
Finished
```

所以它能检测:

> 单条 Looper Message 执行时间过长。

但要注意，它测量的是：

```
dispatchMessage 开始
↓
dispatchMessage 结束
```

而不是：

```
消息进入队列
↓
消息真正执行
```

所以如果：

```
Message B
已经在队列等待 3 秒
```

Printer  本身并不能直接告诉你：

> B 在队列里等了 3 秒。

它更适合检测：

```
当前正在执行的 Message 是否太慢
```

而不是完整的 Message 排队延迟。

这也是为什么现代性能工作还需要 Trace、Prefetto 等更完整的调度信息。

---

## 五、IdleHandler：MessageQueue 空闲时还能做什么

Printer位于：

```
Looper.dispatchMessage()
```

附近。

IdleHandler 则完全不同。

它直接位于:

```java
MessageQueue.next()
```

内部。

接口非常简单：

```java
public interface IdleHandler {
  	boolean queueIdle();
}
```

AOSP 注释对它的描述是：

> 当消息队列已经没有当前可以执行的消息、准备等待更多消息时调用。

而且即使队列中还有 Message，只要这些 Message 都是**未来才执行的延迟消息**，仍然可以视作 idle。

这一点很重要。

所谓：

```java
MessageQueue idle
```

不是：

```java
MessageQueue 完全为空
```

而是：

> 当前没有可以立即执行的 Message

例如：

```
当前时间：1000ms

MessageQueue：
A when=5000ms
B when=8000ms
```

虽然队列不为空，但现在没有任何 Message 能执行。

因此：

```
MessageQueue 扔然处于 idle 状态。
```

---

## 六、IdleHandler 在 next() 的哪个位置执行

简化`MessageQueue.next()`

```java
for (;;) {

    nativePollOnce(...);

    synchronized (this) {

        Message msg = 找下一条消息;

        if (msg 已经到期) {
            return msg;
        }

        // 当前没有立即可执行 Message

        if (pendingIdleHandlerCount < 0
                && isIdle()) {

            pendingIdleHandlerCount =
                    mIdleHandlers.size();
        }
    }

    // 执行 IdleHandler

    for (...) {

        boolean keep =
                idler.queueIdle();

        if (!keep) {
            removeIdleHandler(idler);
        }
    }

    ...
}
```

当前 AOSP 中仍然是这个基本流程：确认 queue idle 后复制`IdleHandler`列表，然后依次调用`queueIdle()`；返回`false`的 handler 会被移除。

所以：

```
MessageQueue.next()
       ↓
发现没有当前可执行 Message
       ↓
有没有 IdleHandler？
       ↓
有
       ↓
queueIdle()
       ↓
然后继续 next()
       ↓
最终 nativePollOnce()
```

---

## 七、同步屏障其实也发生在MessageQueue.next()

现在进入另一个特殊分支。

普通 Message：

```java
msg.target != null
```

因为 Handler 入队时会：

```java
msg.target = this;
```

但同步屏障是一个非常特殊的 Message：

```java
msg.target == null
```

当前`MessageQueue`源码也明确要求普通`enqueueMessage()`的 Message 必须有`target`；而屏障节点则用`target == null`来区分。

假设队列：

```
Barrier
   ↓
Message A(sync)
   ↓
Message B(sync)
   ↓
Message C(async)
```

`next()`中有这样的核心逻辑：

```java
if (msg != null && msg.target == null) {

    // 被 barrier 挡住

    do {
        prevMsg = msg;
        msg = msg.next;

    } while (
        msg != null
        && !msg.isAsynchronous()
    );
}
```

当前源码就是：

```
发现队首是 Barrier
        ↓
不断向后找
        ↓
直到发现 asynchronous Message
```



因此：

```
Barrier
 ↓
Sync A    跳过
 ↓
Sync B    跳过
 ↓
Async C   返回
```

---

## 八、同步屏障到底是什么作用

同步屏障之后的同步消息会暂停执行，直到调用`removeBarrier()`；异步消息不受barrier影响。并且barrier必须成对移除，否则消息队列可能无法恢复正常运行。

所以：

```
Sync Barrier
```

其实就是：

> MessageQueue 临时改变自己的消息选择规则。

平时：

```
选择最早到期 Message
```

Barrier 存在：

```
选择最早到期 Async Message
```

一般开发者**不应该，也基本不能直接调用**同步屏障的添加/移除接口。`postSyncBarrier()`和`removeSyncBarrier()`虽然在源码里是 public 的，但同时也标记了`@hide`，属于隐藏 API。因此这套机制主要是给**Framework 自己使用的调度能力**，典型就是 View 绘制链路。

例如`ViewRootImpl.scheduleTraversals()`的经典设计就是：

```
UI 请求 layout / draw
        ↓
ViewRootImpl.scheduleTraversals()
        ↓
postSyncBarrier()
        ↓
普通同步 Message 暂时被挡住
        ↓
Choreographer 的异步帧消息可以穿过去
        ↓
VSYNC
        ↓
doFrame()
        ↓
Traversal
        ↓
doTraversal()
        ↓
removeSyncBarrier(token)
```

所以你可以把 SyncBarrier 看成：

> Framework为了控制主线程消息调度顺序而保留的一种“内部交通管制能力”。

而不是开发者通用的：

> "提高我的 Message优先级"工具。

不过开发者**可以合法使用和它相关的另一半机制：异步 Handler**。

Android 提供公开 API：

```kotlin
val handler = Handler.createAsync(Looper.getMainLooper())
```

这种 Handler 发出的消息会被标记为异步消息，因此如果队列里存在同步屏障，它们不会被屏障阻塞。

## 九、Choreographer 和 Handler连接起来的地方

Choreographer 源码开头直接说明了自己的职责：

```
协调 animation、input、drawing 的时间
接收来自显示系统的 timing pulse，例如 VSYNC
然后安排下一帧工作
```

而且每个Looper 线程可以拥有自己的 Choreographer，回调最终运行在那个 Choreographer 所绑定的 Looper 线程。

注意 Choreographer 内部字段：

```java
private final Looper mLooper;
private final FrameHandler mHandler;

private final FrameDisplayEventReceiver
        mDisplayEventReceiver;

private final CallbackQueue[]
        mCallbackQueues;
```

构造：

```java
mLooper = looper;
mHandler = new FrameHandler(looper);

mDisplayEventReceiver =
        new FrameDisplayEventReceiver(
            looper,
            vsyncSource,
            layerHandle
        );
```

也就是说：

```
Choreographer
├─ Looper
├─ Handler
├─ DisplayEventReceiver
└─ 自己的 CallbackQueue
```

这里一个非常重要的结论出现了：

> Choreographer 自己还有一套 CallbackQueue，但它最终仍依托 Looper/Handler 驱动。

---

## 十、Choreographer 为什么还需要自己的CallbackQueue

Handler的MessageQueue管：

```
整个线程的所有 Message
```

Choreographer 自己则需要进一步区分：

```
INPUT
ANIMATION
INSETS_ANIMATION
TRAVERSAL
COMMIT
```

当前源码定义的 callback 顺序就是：

```java
CALLBACK_INPUT = 0 
CALLBACK_ANIMATION = 1
CALLBACK_INSETS_ANIMATION = 2
CALLBACK_TRAVERSAL = 3
CALLBACK_COMMIT = 4
```

其中源码注释明确指出 Traversal 负责 layout 和 draw。

所以可以理解成两级调度：

```
一级调度
MessageQueue
负责线程所有任务

        ↓
二级调度
Choreographer.CallbackQueue
负责一帧内部的不同阶段
```

这跟我们前面说的：

```
target → Handler
what → Handler 内部分类
```

其实是类似的设计思想：

> 不同层级分别负责自己的任务分类和调度。

---

## 十一、一次Choreographer回调是怎么样开始的

比如：

```java
postCalback(
		CALLBACK_TRAVERSAL,
  	runnable,
  	token
);
```

内部：

```java
final long now =
        SystemClock.uptimeMillis();

final long dueTime =
        now + delayMillis;

mCallbackQueues[callbackType]
        .addCallbackLocked(
            dueTime,
            action,
            token
        );
```

然后：

```java
if (dueTime <= now) {
  	scheduleFrameLocked(now);
}
```

否则：

```java
Message msg =
    mHandler.obtainMessage(
        MSG_DO_SCHEDULE_CALLBACK,
        action
    );

msg.arg1 = callbackType;

msg.setAsynchronous(true);

mHandler.sendMessageAtTime(
    msg,
    dueTime
);
```

注意这里非常关键的一行：

```java
msg.setAsynchronous(true);
```

当前 Choreographer 源码确实将这类调度 Message 标记为异步。

现在 Handler 与 Choreographer 就真正连起来了。

---

## 十二、VSYNC 到底怎么进入Java世界

Choreographer里面还有：

```java
FrameDisplayEventReceiver
  	extends DisplayEventReceiver
```

当显示系统产生 VSYNC 时，会进入：

```java
FrameDisplayEventReceiver.onVsync();
```

然后源码会创建一个 Message：

```java
Message msg =
        Message.obtain(
            mHandler,
            this
        );

msg.setAsynchronous(true);

mHandler.sendMessageAtTime(
        msg,
        timestamp
);
```

之后 Runnable：

```java
@Override
public void run() {
    mHavePendingVsync = false;

    doFrame(
        mTimestampNanos,
        mFrame,
        mLastVsyncEventData
    );
}
```

当前 Choreographer 的`FrameDisplayEventReceiver`就是这样把 VSYNC 转换成异步 Message，再最终调用`doFrame()`。

因此完整链：

```
Display subsystem
      ↓
VSYNC
      ↓
DisplayEventReceiver
      ↓
FrameDisplayEventReceiver
      ↓
创建 Async Message
      ↓
Main MessageQueue
      ↓
MainLooper
      ↓
FrameDisplayEventReceiver.run()
      ↓
Choreographer.doFrame()
```

这一步非常重要。

Choreographer 并不是：

```
一个独立线程不停轮询 VSYNC
```

而是：

> VSYNC 最终被转换成 Looper 可以处理的任务，并在 Choreographer 所绑定线程上执行

---

## 十三、doFrame() 才是一帧真正执行的地方

进入：

```java
Choreographer.doFrame()
```

后，源码最终按照顺序调用：

```java
doCallbacks(CALLBACK_INPUT);

doCallbacks(CALLBACK_ANIMATION);

doCallbacks(
    CALLBACK_INSETS_ANIMATION
);

doCallbacks(CALLBACK_TRAVERSAL);

doCallbacks(CALLBACK_COMMIT);
```

于是整个主线程的结构变得很有意思：

```
Looper
 │
 └─ 一次 doFrame Message
          ↓
      Choreographer
          ↓
      INPUT
          ↓
      ANIMATION
          ↓
      TRAVERSAL
          ↓
      COMMIT
```

也就是说：

> 对 Looper 来说，一帧可能只是它正在 dispatch 的一个任务；但这个任务内部，Choreographer 又实现了一套完整的帧阶段调度。

---

## 十四、那ViewRootImpl 又是怎么进来的

ViewRootImpl的：

```java
scheduleTraversals()
```

会安排：

```
TraversalRunnable
```

进入：

```
Choreographer.CALLBACK_TRAVERSAL
```

最后在：

```
Choreographer.doFrame()
```

执行：

```java
doCallbacks(
    CALLBACK_TRAVERSAL
);
```

Traversal 的语义在当前 Choreographer 源码里就明确负责 layout 和 draw。

随后 ViewRootImpl 的：

```
TraversalRunnable.run()
        ↓
doTraversal()
        ↓
performTraversals()
```

进一步进入 View 树的：

```
messasure
layout
draw
```

所以：

```
Handler
```

一路往上最终可以连接到：

```
View 绘制
```

MessageQueue 解决的是**整个主线程下一事情执行什么**

Choreographer 解决的是**既然现在要处理这一帧，那么这一帧内部各类任务以什么顺序执行**
