+++
date = '2025-06-16T06:49:21+08:00'
draft = false
title = 'Choreographer类解析'
categories = ['android-develop']

+++

#### 一、核心作用

Choreographer是Android系统**协调动画、输入和绘制操作的核心调度器**。它通过VSYNC信号确保帧的渲染与屏幕刷新率同步，避免画面撕裂和卡顿。

#### 二、关键概念

* VSYNC：垂直同步信号，表示屏幕开始刷新新的一帧
* Frame Callbacks：注册的回调函数，在下一帧的特定阶段执行
* Callback Types（按执行顺序排序）
  * CALLBACK_INPUT
  * CALLBACK_ANIMATION
  * CALLBACK_INSETS_ANIMATION
  * CALLBACK_TRAVERSAL
  * CALLBACK_COMMIT

```java
public final class Choreographer {
    // 五种回调类型
    public static final int CALLBACK_INPUT = 0;
    public static final int CALLBACK_ANIMATION = 1;
    public static final int CALLBACK_INSETS_ANIMATION = 2;
    public static final int CALLBACK_TRAVERSAL = 3;
    public static final int CALLBACK_COMMIT = 4;
    public static final int CALLBACK_LAST = CALLBACK_COMMIT; // 最后一种类型
    
    // 单例模式实现
    private static final ThreadLocal<Choreographer> sThreadInstance =
        new ThreadLocal<Choreographer>() {
            @Override
            protected Choreographer initialValue() {
                Looper looper = Looper.myLooper();
                return new Choreographer(looper, VSYNC_SOURCE_APP);
            }
        };
    
    // 回调队列数组
    private final CallbackQueue[] mCallbackQueues;
    
    // VSYNC 接收器
    private final FrameDisplayEventReceiver mDisplayEventReceiver;
    
    // 处理消息的Handler
    private final FrameHandler mHandler;
}
```



#### 三、核心架构图解

```tex
┌───────────────────────┐       ┌───────────────────────┐
│    VSYNC 信号源        │──────>│ FrameDisplayEventReceiver │
└───────────────────────┘       │  (接收硬件VSYNC信号)     │
                                └───────────┬───────────┘
                                            │
                                            ▼
┌───────────────────────┐       ┌───────────────────────┐
│     FrameHandler       │<──────│    onVsync()          │
│   (处理3类消息)        │──────>│    scheduleVsync()    │
└───────────┬───────────┘       └───────────────────────┘
            │
            ▼
┌───────────────────────┐
│      doFrame()         │
│ (帧处理核心方法)       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│   CallbackQueue[]      │
│ (5种类型回调链表)      │
└───────────────────────┘
```

#### 三、回调添加入口

##### 1. 添加回调入口

```java
public void postCallback(int callbackType, Runnable action, Object token) {
    postCallbackDelayed(callbackType, action, token, 0);
}

public void postCallbackDelayed(int callbackType, Runnable action, long delayMillis) {
    postCallbackDelayedInternal(callbackType, action, token, delayMillis);
}
```

##### 2. 内部添加实现

```java
private void postCallbackDelayedInternal(int callbackType,
        Object action, Object token, long delayMillis) {
    
    synchronized (mLock) {
        final long now = SystemClock.uptimeMillis();
        final long dueTime = now + delayMillis;
        
        // 1. 添加到对应的回调队列
        mCallbackQueues[callbackType].addCallbackLocked(dueTime, action, token);

        // 2. 调度帧处理
        if (dueTime <= now) {
            // 立即调度
            scheduleFrameLocked(now);
        } else {
            // 延迟调度
            Message msg = mHandler.obtainMessage(MSG_DO_SCHEDULE_CALLBACK, action);
            msg.arg1 = callbackType;
            msg.setAsynchronous(true);
            mHandler.sendMessageAtTime(msg, dueTime);
        }
    }
}
```

##### 3. 回调链表结构

```java
private static final class CallbackQueue {
    private CallbackRecord mHead;
    
    public void addCallbackLocked(long dueTime, Object action, Object token) {
        CallbackRecord callback = obtainCallbackLocked(dueTime, action, token);
        
        if (mHead == null) {
            mHead = callback;
            return;
        }
        
        // 链表按照执行时间排序（小到大）
        if (dueTime < mHead.dueTime) {
            callback.next = mHead;
            mHead = callback;
            return;
        }
        
        CallbackRecord entry = mHead;
        while (entry.next != null) {
            if (dueTime < entry.next.dueTime) {
                callback.next = entry.next;
                entry.next = callback;
                return;
            }
            entry = entry.next;
        }
        entry.next = callback;
    }
}

// 链表节点定义
private static final class CallbackRecord {
    public CallbackRecord next;
    public long dueTime;
    public Object action; // Runnable 或 FrameCallback
    public Object token;
}
```

#### 四、VSYNC同步机制

##### 1、 VSYNC请求

```java
private void scheduleFrameLocked(long now) {
    if (!mFrameScheduled) {
        mFrameScheduled = true;
        
        if (USE_VSYNC) {
            // 通过 FrameDisplayEventReceiver 请求 VSYNC
            if (isRunningOnLooperThreadLocked()) {
              //注册
                scheduleVsyncLocked();
            } else {
                // 非UI线程发送消息到UI线程
                Message msg = mHandler.obtainMessage(MSG_DO_SCHEDULE_VSYNC);
                msg.setAsynchronous(true);
                mHandler.sendMessageAtFrontOfQueue(msg);
            }
        } else {
            // 无VSYNC直接安排帧
            final long nextFrameTime = ...;
            Message msg = mHandler.obtainMessage(MSG_DO_FRAME);
            msg.setAsynchronous(true);
            mHandler.sendMessageAtTime(msg, nextFrameTime);
        }
    }
}

private void scheduleVsyncLocked() {
    mDisplayEventReceiver.scheduleVsync();
}
```

##### 2. VSYNC接收与处理

```java
private final class FrameDisplayEventReceiver extends DisplayEventReceiver {
    @Override
    public void onVsync(long timestampNanos, long physicalDisplayId, int frame) {
        // 1. 计算正确的帧时间
        long now = System.nanoTime();
        long intendedFrameTimeNanos = ...;
        
        // 2. 发送MSG_DO_FRAME消息
        Message msg = Message.obtain(mHandler, MSG_DO_FRAME);
        msg.setAsynchronous(true);
        mHandler.sendMessageAtTime(msg, intendedFrameTimeNanos / NANOS_PER_MS);
    }
}
```

##### 3. 帧处理核心 - doFrame()

```java
void doFrame(long frameTimeNanos, int frame) {
    final long startNanos;
    synchronized (mLock) {
        // 检查帧调度状态
        if (!mFrameScheduled) return;
        
        // 计算跳帧情况
        long jitterNanos = startNanos - frameTimeNanos;
        if (jitterNanos >= mFrameIntervalNanos) {
            final long skippedFrames = jitterNanos / mFrameIntervalNanos;
            // 超过阈值打印警告日志
            if (skippedFrames >= SKIPPED_FRAME_WARNING_LIMIT) {
                Log.i(TAG, "Skipped " + skippedFrames + " frames!");
            }
            frameTimeNanos = ...; // 调整帧时间
        }
        
        mLastFrameTimeNanos = frameTimeNanos;
        mFrameScheduled = false;
    }

    try {
        // 按优先级顺序执行回调
        mFrameInfo.markInputHandlingStart();
        doCallbacks(Choreographer.CALLBACK_INPUT, frameTimeNanos);

        mFrameInfo.markAnimationsStart();
        doCallbacks(Choreographer.CALLBACK_ANIMATION, frameTimeNanos);

        mFrameInfo.markPerformTraversalsStart();
        doCallbacks(Choreographer.CALLBACK_TRAVERSAL, frameTimeNanos);

        doCallbacks(Choreographer.CALLBACK_COMMIT, frameTimeNanos);
    } finally {
        // 清理工作
    }
}
```

#### 五、回调执行处理

##### 1. 执行回调核心逻辑

```java
void doCallbacks(int callbackType, long frameTimeNanos) {
    CallbackRecord callbacks;
    synchronized (mLock) {
        // 提取所有到期的回调
        final long now = frameTimeNanos / NANOS_PER_MS;
        callbacks = mCallbackQueues[callbackType].extractDueCallbacksLocked(now);
        if (callbacks == null) return;
        mCallbacksRunning = true;
    }
    
    try {
        // 执行链表中的所有回调
        for (CallbackRecord c = callbacks; c != null; c = c.next) {
            // 执行回调
            if (c.action instanceof Runnable) {
                ((Runnable) c.action).run();
            } else {
                ((FrameCallback) c.action).doFrame(frameTimeNanos);
            }
        }
    } finally {
        synchronized (mLock) {
            // 回收CallbackRecord对象
            recycleCallbackRecordsLocked(callbacks);
            mCallbacksRunning = false;
        }
    }
}
```

##### 2.到期回调提取算法

```java
CallbackRecord extractDueCallbacksLocked(long now) {
    CallbackRecord callbacks = null;
    CallbackRecord next = mHead;
    
    // 遍历链表，找出所有dueTime<=now的节点
    while (next != null && next.dueTime <= now) {
        CallbackRecord temp = next;
        next = next.next;
        temp.next = callbacks;  // 新节点插入链表头部
        callbacks = temp;       // 新链表头
    }
    
    // 更新原链表
    mHead = next;
    
    // 返回的是倒序链表（最近加入的先执行）
    return callbacks;
}
```

#### 六、Choreographer的其他作用

##### 1. 帧率监控

开发者可以通过postFrameCallback实现帧率监控：

```java
public void startMonitoring() {
    Choreographer.getInstance().postFrameCallback(new FrameCallback() {
        long lastFrameTime = 0;
        
        @Override
        public void doFrame(long frameTimeNanos) {
            if (lastFrameTime != 0) {
                long frameInterval = (frameTimeNanos - lastFrameTime) / 1000000;
                if (frameInterval > 16) {
                    // 记录掉帧情况
                }
            }
            lastFrameTime = frameTimeNanos;
            Choreographer.getInstance().postFrameCallback(this);
        }
    });
}
```

#### 七、总结

Choreographer 是 Android 渲染系统的核心协调器，其工作原理可以概括为：

1. **任务管理**：通过 5 个链表队列管理不同优先级的回调任务

   - 输入 > 动画 > 插入动画 > 视图遍历 > 提交

2. **VSYNC 同步**：

   ```
   scheduleVsync() → DisplayEventReceiver → onVsync() → doFrame()
   ```

3. **帧生命周期**：

   ```
   doFrame() → 
     doCallbacks(INPUT) → 
     doCallbacks(ANIMATION) → 
     doCallbacks(TRAVERSAL) → 
     doCallbacks(COMMIT)
   ```

4. **性能监控**：内置跳帧检测和警告机制

5. **系统协调**：作为动画系统、UI 系统、输入系统的同步中枢

整个设计体现了 Android 系统对以下关键目标的平衡：

- **精确性**：通过 VSYNC 精准同步
- **高效性**：链表结构和对象复用
- **优先级**：严格的分级回调顺序
- **扩展性**：支持多种回调类型
- **监控能力**：内置性能检测机制

**`scheduleVsync()` 的唯一目的就是在 VSYNC 到来时触发 `doFrame()`**，而整个 Choreographer 的核心任务就是确保所有帧处理操作完美对齐 VSYNC 时间序列。
