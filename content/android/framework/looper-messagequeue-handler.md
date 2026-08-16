+++
  title = "Android Handler 消息机制：Looper、MessageQueue 与 Handler"
  date = "2026-08-02T00:00:00+08:00"
  draft = false
  description = "系统梳理 Android Handler 消息机制，解释 Looper、MessageQueue、Handler 的职责边界、消息分发流程、阻塞唤醒机制与常见实践问题。"
  slug = "android-handler-message-mechanism"
  categories = ["android"]
  tags = ["Android", "Handler", "Looper", "MessageQueue"]

+++

# 序言

在 Android 开发中，我们经常会写出这样的代码：

```kotlin
val mainHandler = Handler(Looper.getMainLooper())

Thread {
  val result = loadData()
  
  mainHandler.post {
    textView.text = result
  }
}.start()
```

这段代码看起来非常普通：子线程完成耗时任务，然后通过`Handler`回到主线程更新 UI。

但在面试中，面试官真正关心的通常不是你会不会调用`post()`，而是下面这些问题：

* `Handler`为什么可以完成线程切换？
* `Runnable`最终保存在哪里？
* `MessageQueue`是所有线程共享的吗？
* `Looper.loop()`是无限循环，为什么不会占满 CPU？
* 延迟消息是怎样实现的？
* 一个线程可以有几个 Looper？
* 为什么同一个 Looper 可以对应多个 Handler？
* `Handler.postDelayed()`为什么不一定准时？
* Java 层的消息队列为什么还需要 native 层的`poll`?

---

## 一、Handler 并没有真正"切换线程"

先从一个最容易产生误解的说法开始：

> Handler 可以把代码切换到主线程。

这句话在日常交流中没有问题，但从底层原理来看并不准确。

Handler 本身不会创建线程，也不会暂停当前线程并把执行线程迁移到另一个线程。它真正做的事情是：

> 将一个任务放入目标线程的消息队列，等待目标线程主动取出并执行。

以前面的代码为例：

```kotlin
mainHandler.post {
  textView.text = result
}
```

调用 `post()`的是工作线程，但执行 Lambda 的是主线程。

整个过程可以拆分成两个阶段：

```
工作线程： 
Handler.post() 
		↓ 
将任务封装成 Message 
		↓ 
插入主线程 MessageQueue 

主线程：
Looper 从 MessageQueue 取出 Message 
		↓ 
Handler 分发 Message
		↓ 
执行 Runnable.run()
```

因此，Handler 消息机制本质上是一个典型的**生产者-消费者模型**：

* 调用`post()`或`sendMessage()`的线程是生产者；
* MessageQueue 是任务缓冲区；
* Looper 所在线程是唯一的消费者。

Android 官方文档也明确指出：Handler 会把 Message 和 Runnable 交给其绑定 Looper 的 MessageQueue，并最终在该 Looper 所在的线程执行。

理解这一点后，“线程切换”的本质就变得清晰了：

> 不是当前代码被转移到了其他线程，而是当前线程提交了一个新任务，由另一个线程在未来执行。

---

## 二、Thread、Looper、MessageQueue 和 Handler到底是什么关系

Android消息机制中最重要的四个角色以及它们之间的关系是：

* 一个 Thread 最多拥有一个 Looper
* 一个 Looper 固定拥有一个 MessageQueue
* 一个 Looper 可以绑定多个 Handler
* 一个 Handler 只绑定一个 Looper

画成对象关系大致如下：

```
MainThread
    │
    └── MainLooper
            │
            ├── MessageQueue
            │
            ├── Handler A
            ├── Handler B
            └── Handler C
```

需要注意，Handler 并不是 Looper 的子对象。更准确地说，是多个 Handler 保存了同一个 Looper 和 MessageQueue 的引用。

### MessageQueue是所有线程共享的吗

不同Looper拥有不同的MessageQueue：

```
主线程
  └── MainLooper
        └── MainMessageQueue

工作线程 A
  └── Looper A
        └── MessageQueue A

工作线程 B
  └── Looper B
        └── MessageQueue B
```

但是，一个 MessageQueue 可以被多个线程并发访问。

例如主线程的 MessageQueue：

```
网络线程 ──────┐
Binder 线程 ───┤
工作线程 ──────┼── enqueue ──→ 主线程 MessageQueue
主线程自身 ────┘                    │
                                  │ next
                                  ▼
                               主线程
```

所以应当区分两个概念：

* **归属关系**：一个 MessageQueue 只属于一个 Looper；
* **访问关系**：多个线程可以向同一个 MessageQueue 投递消息。

它是一种典型的：

> 多生产者、单消费者队列。

消息入队可能发生在任意线程，而消息出队和执行只发生在 Looper 所属线程。

---

## 三、Looper.prepare()：为当前线程创建消息环境

普通 Java 线程创建后，并不会自动拥有消息循环。

下面这个线程执行完代码后就会退出：

```kotlin
Thread {
  println("执行任务")
}.start()
```

如果希望它像 Android 主线程一样长期存活、持续接收任务，就需要为它创建 Looper：

```kotlin
Looper.prepare();
Looper.loop();
```

其中，`prepare()`负责初始化，`loop()`负责启动循环。

### 3.1 ThreadLocal如何保证一个线程一个Looper

Looper 中最关键的静态字段之一是：

```java
static final ThreadLocal<Looper> sThreadLocal = new ThreadLocal<>();
```

`ThreadLocal`可以理解为一个以线程为作用域的变量。

虽然所有线程访问的是同一个`sThreadLocal`对象，但每个线程看到的值不同：

```
主线程读取 sThreadLocal    → MainLooper
线程 A 读取 sThreadLocal   → Looper A
线程 B 读取 sThreadLocal   → Looper B
普通线程读取 sThreadLocal  → null
```

`Looper.prepare()`的核心逻辑可以简化为：

```java
private static void prepare(boolean quitAllowed) {
  if (sThreadLocal.get != null) {
    throw new RuntimeException(
      	"Only one Looper may be created per thread"
    );
  }
  sThreadLocal.set(new Looper(quitAllowed));
}
```

这里完成了两件事：

1. 检查当前线程是否已经存在 Looper；
2. 创建一个 Looper，并保存到当前线程的 ThreadLocal 中。

因此：

```kotlin
Looper.myLooper()
```

本质上就是：

```kotlin
sThreadLocal.get()
```

它获取的是**调用该方法的当前线程所绑定的 Looper**。

### 3.2 为什么一个线程只能有一个Looper

因为线程只有一条执行流，而`Looper.loop()`是一个持续运行的循环。

假设一个线程允许创建两个 Looper：

```kotlin
looperA.loop();
looperB.loop();
```

第一个`loop()`不退出，第二个就永远得不到执行机会。

因此，一个线程设置多个独立消息循环既没有实际意义，也会造成消息队列归属混乱。Android 直接在`prepare()`阶段禁止这种情况。

### 3.3 Looper创建时也会创建MessageQueue

Looper的构造逻辑可以简化为：

```java
private Looper(boolean quitAllowed) {
  mQueue = new MessageQueue(quitAllowed);
  mThread = Thread.currentThread();
}
```

所以真正的初始化链路是：

```
线程调用 Looper.prepare()
        ↓
创建 Looper
        ↓
创建 MessageQueue
        ↓
记录 Thread.currentThread()
        ↓
将 Looper 保存到 ThreadLocal
```

这也解释了为什么 Looper 和 MessageQueue 是一一对应关系。

---

## 四、Handler创建时到底绑定了什么

现在来看：

```kotlin
val handler = Handler(Looper.getMainLooper())
```

Handler 构造函数的核心逻辑可以简化为：

```java
public Handler(
        Looper looper,
        Callback callback,
        boolean async
) {
    mLooper = looper;
    mQueue = looper.mQueue;
    mCallback = callback;
    mAsynchronous = async;
}
```

Handler 会保存两个关键引用：

```
mLooper → 目标 Looper
mQueue  → 目标 Looper 对应的 MessageQueue
```

所以所谓的：

> Handler 绑定主线程。

准确含义是：

```
Handler
   ↓
MainLooper
   ↓
MainThread
```

Handler 自己并不决定代码在哪个线程执行，真正决定执行线程的是它所绑定的 Looper。

---

## 五、消息发送：从 sendMessage 到 enqueueMessage

假设调用：

```kotlin
handler.sendMessage(message);
```

它依次经过：

```kotlin
sendMessage()
    ↓
sendMessageDelayed(message, 0)
    ↓
sendMessageAtTime(message, uptimeMillis)
    ↓
enqueueMessage(queue, message, uptimeMillis)
```

延迟发送的逻辑大致为：

```java
public final boolean sendMessageDelayed(
				Message msg,
  			long delayMills
) {
 		if (delayMills < 0) {
      delayMills = 0
    } 
  	
  	return sendMessageAtTime(
    				msg,
      			SystemClock.uptimeMills() + delayMills
    );
}
```

需要注意的是，MessageQueue 保存的不是“延迟多少毫秒”，而是一个绝对执行时间：

```
when = 当前 uptimeMills + delayMills
```

例如：

```
当前 uptimeMillis = 10,000
delayMillis        = 2,000

message.when        = 12,000
```

这条消息的含义是：

> 当系统运行时间达到 12,000ms 后，该消息具备执行资格。

Handler 使用的时间基准是 `SystemClock.uptimeMillis()`。设备进入深度休眠时，该时钟不会继续增长，因此深度休眠可能造成延迟任务比预期更晚执行。

---

## 六、message.target: Looper 怎么知道该交给哪个 Handler

消息真正入队前，会经过 Handler 的 `enqueueMessage()` :

``` java
private boolean enqueueMessage(
				MessageQueue queue,
  			Message msg,
  			long uptimeMills
) {
  msg.target = this;
  
  if (mAsynchronous) {
    	msg.setAsynchronous(true);
  }
  
  return queue.enqueueMessage(msg, uptimeMillis);
}
```

其中最关键的一句是：

```java
msg.target = this;
```

这里的`this` 就是当前的 Handler。

为什么`Message`必须保存 target？

因为同一个 MessageQueue 中可能存在多个 Handler 发送的消息：

```
MessageQueue
    ├── Message A → Handler A
    ├── Message B → Handler B
    ├── Message C → Handler A
    └── Message D → Handler C
```

Looper 只负责从队列里中取消息，它不知道每条消息对应什么业务逻辑。

所以 Message 需要自己携带接收方：

```
Message.target → 负责处理该消息的 Handler
```

随后 Looper 只需要调用：

```java
msg.target.dispatchMessage(msg);
```

就能将消息交回正确的 Handler。

---

## 七、 MessageQueue 不是简单的先进先出队列

很多人看到MessageQueue，回自然认为它是普通的 FIFO 队列。

实际上，它更接近一个按照执行时间排序的单链表。

Message 中有两个重要字段：

```java
long when;
Message next;
```

队列结构可以理解为：

```
mMessages
    ↓
Message A
when = 100
next ─────→ Message B
             when = 300
             next ─────→ Message C
                          when = 800
```

队头始终是最早应该执行的消息。

假设当前队列是：

```
A(100) → B(300) → C(800)
```

现在插入一条：

```
D(500)
```

MessageQueue会从队头开始遍历，找到正确位置：

```
A(100) → B(300) → D(500) → C(800)
```

因此，消息的执行顺序首先取决于 when，而不是单纯取决于发送顺序。

例如：

```java
handler.postDelayed(taskA, 3000)
handler.postDelayed(taskB, 1000)
handler.post(taskC)
```

理论上的队列顺序是：

```
taskC → taskB → taskA
```

即使 taskA 最先发送，它依然最后执行。

### 为什么入队需要同步

MessageQueue 可能被多个线程同时写入：

```
线程 A 正在插入消息 A
线程 B 同时插入消息 B
Looper 线程可能正在读取队头
```

如果没有同步保护，可能出现：

* `next` 指针被覆盖；
* 链表结构断裂；
* 消息丢失；
* 消息顺序错误；
* 同一条消息被重复处理。

因此经典 `MessageQueue`实现会在操作链表时使用同步保护：

```java
synchronized (this) {
  // 检查退出状态
  // 设置 message.when
  // 按执行时间插入链表
  // 判断是否需要唤醒 Looper
}
```

这里也再次证明：`MessageQueue` 虽然只被一个 Looper 线程消费，却可能被多个发送线程并发写入。

---

## 八、为什么插入消息后有时要唤醒Looper

假设主线程当前没有立即执行的任务，队头消息需要 10 秒后执行。

于是主线程进入等待：

```
Message A：10 秒后执行
Looper：准备休眠 10 秒
```

这时工作线程插入一条立即执行的消息：

```
Message B：立即执行
```

队列变成：

```
Message B → Message A
```

如果只是修改链表，却不唤醒 Looper，那么 Looper 仍可能继续休眠10 秒，导致 B 无法及时执行。

因此，当新消息改变了队列下一次应该唤醒的时间时，需要调用 native 层的唤醒机制。

可以概括为：

```
新消息成为新的有效队头
        +
Looper 当前正在阻塞
        ↓
唤醒 Looper
```

但并不是每次入队都需要唤醒。

假设`Looper`原本会在 100ms 后醒来，新插入的消息要 5 秒后执行：

```
原队头：100ms 后执行
新消息：5000ms 后执行
```

新消息并没有改变下一次唤醒时间，所以没有必要额外唤醒线程。

这是一种重要的性能优化：

>只有新消息会影响当前等待状态时，才进行 native wake

---

## 九、Looper.loop(): 消息循环真正开始

`Looper.prepare()` 只是创建环境，真正开始处理消息的是：

```java
Looper.loop();
```

其核心逻辑可以压缩为：

```java
public static void loop() {
  Looper me = myLooper();
  
  if (me == null) {
    throw new RuntimeException(
    				"No Looper; Looper.prepare() wasn't called"
    );
  }
  
  for (;;) {
    if (!loopOnce(me)) {
      	return;
    }
  }
}
```

单次循环的核心又可以简化为：

```java
private static boolean loopOnce(Looper me) {
  	Message msg = me.mQueue.next();
  
  	if (msg == null) {
      return false;
    }
  
  	msg.target.dispatchMessage(msg);
  	msg.recycleUnchecked();
  
  	return true;
}
```

忽略日志、Trace、慢消息检测和 Observer 等工程代码，Looper 每轮只做三件事：

```
从 MessageQueue 获取下一条消息
        ↓
交给 message.target 分发
        ↓
回收 Message
```

这里真正复杂的部分不在`Looper.loop()`, 而在：

```java
MessageQueue.next();
```

因为`next()` 必须回答一个问题：

> 当前是否存在可以立即执行的消息？如果没有，线程应该等待多久？

---

## 十、MessageQueue.next()： 为什么无限循环不占满CPU

`MessageQueue.next()`的经典逻辑可以简化为：

```java
Message next() {
  int nextPollTimeoutMills = 0;
  
  for(;;) {
    	nativePollOnce(
      				mPtr,
        			nextPollTimeoutMills
      );
    
    	synchronized(this) {
        	long now = 
            			SystemClock.uptimeMillis();
        
        	Message msg = mMessage;
        
        	if (msg != null) {
            	if (now < msg.when) {
                nextPollTimeoutMillis =
                  			(int) Math.min(
                								msg.when - now,
                  							Integer.MAX_VALUE
                				);
              } else {
                	mMessages = msg.next;
                	msg.next = null;
                	return msg;
              }
          } else {
            	nextPollTimeoutMillis = -1;
          }
        
        	if (mQuiting) {
            return null;
          }
      }
  }
}
```

虽然源码细节会随 Android 版本演进，但基本判断可以分为三种情况。

### 情况一：队头消息已经到期

假设：

```
now      = 1000
msg.when = 800
```

此时满足：

```
now >= msg.when
```

MessageQueue 会:

```
从链表摘除队头
清除 msg.next
返回该 Message
```

Looper 随后执行：

```
msg.target.dispatchMessage(msg);
```

### 情况二：队头消息尚未到期

假设：

```
now      = 1000
msg.when = 1500
```

还需要等待：

```
1500 - 1000 = 500ms
```

于是下一轮 native poll 最多阻塞约 500ms：

```kotlin
nativePollOnce(mPtr, 500);
```

如果期间没有新事件，线程会在超时后自动醒来。

如果期间插入了一条更早的消息，其他线程会唤醒 Looper，让它重新计算等待时间。

### 情况三：队列为空

如果队列中完全没有消息:

```kotlin
nextPollTimeoutMillis = -1;
```

通常表示无限等待，直到：

* 有新消息入队；
* native 文件描述符事件到达；
* 队列退出；
* 其他唤醒事件发生。

### 无限循环为什么不会占满CPU

`Looper.loop()` 确实是一个无限循环：

```kotlin
for(;;) {
  	messageQueue.next();
}
```

但无限循环不等于忙循环。

忙循环是：

```java
while (true) {
    // 不断执行，没有阻塞点
}
```

这种循环会持续消耗 CPU。

Looper 的循环则是：

```kotlin
while (true) {
  val messsage = blockingNext()
}
```

当没有可执行消息时，线程会在 native poll 中阻塞休眠，因此不会持续占用 CPU。

所以真正应该记住的是：

> 是否耗 CPU，不取决于有没有无限循环，而取决于循环内部有没有阻塞等待机制。

---

## 十二、为什么 Android 使用nativePollOnce，而不是Object.wait

纯 Java 消息循环完全可以使用：

```java
synchronized (queue) {
    queue.wait(timeout);
}
```

但 Android 主线程等待的不只是 Java 层的 Handler 消息。

它还需要统一处理：

* 输入事件；
* native 层回调；
* 文件描述符事件；
* UI 系统事件；
* 某些系统服务通信；
* Handler 消息。

因此 Android 在 native 层使用 Looper 和 poll/epoll 类机制统一等待多种事件。

Java 层主要暴露两个关键入口：

```
nativePollOnce(mPtr, timeoutMillis);
nativeWake(mPtr);
```

可以近似理解为：

```
MessageQueue.next()
        ↓
nativePollOnce()
        ↓
Native Looper
        ↓
poll / epoll 等待
        ↓
消息到达、FD 可读、超时或被唤醒
        ↓
返回 Java 层继续处理
```

这说明 Android 的主线程 Looper 并不只是一个普通 Java 阻塞队列。

它本质上是应用进程中的一个完整事件循环，同时协调 Java 消息和 native 事件。

---

## 十三、dispatchMessage(): 最终执行Runnable 还是handleMessage

Looper取出消息后，会调用：

```java
msg.target.dispatchMessage(msg);
```

Handler 的分发逻辑可以简化为：

```java
public void dispatchMessage(Message msg) {
    if (msg.callback != null) {
        handleCallback(msg);
    } else {
        if (mCallback != null
                && mCallback.handleMessage(msg)) {
            return;
        }

        handleMessage(msg);
    }
}
```

它的优先级是：

```text
1. Message.callback
2. Handler.Callback
3. Handler.handleMessage()
```

### 第一优先级：Message.callback

来源通常是：

```kotlin
handler.post {
    updateUi()
}
```

因为 Runnable 被保存到了：

```java
message.callback
```

所以最终执行：

```java
message.callback.run();
```

### 第二优先级：Handler.Callback

创建 Handler 时可以传入 Callback：

```kotlin
val handler = Handler(
    Looper.getMainLooper()
) { message ->
    true
}
```

Callback 返回 `true` 表示消息已被消费，不再继续调用 `handleMessage()`。

返回 `false` 则继续向下分发。

### 第三优先级：handleMessage()

传统用法是继承 Handler：

```kotlin
val handler = object :
    Handler(Looper.getMainLooper()) {

    override fun handleMessage(msg: Message) {
        when (msg.what) {
            1 -> handleResult(msg.obj)
        }
    }
}
```

只有 Message 没有 callback，并且 Handler.Callback 没有消费时，才会进入 `handleMessage()`。

因此面试中可以这样回答：

> `Handler.post()` 和 `sendMessage()` 最终都会生成 Message。post 的 Runnable 保存在 `Message.callback` 中，sendMessage 通常依赖 what、obj 等字段。Looper 取出 Message 后调用 Handler.dispatchMessage，优先执行 Message.callback，其次 Handler.Callback，最后才是 handleMessage。

---

## 十四、重新理解“Handler 为什么能切换线程”

现在把整条链路连起来。

假设工作线程调用：

```java
mainHandler.post {
  	updateUi()
}
```

实际过程是：

```
工作线程执行 Handler.post()
        ↓
创建 Message
        ↓
Runnable 保存到 Message.callback
        ↓
Message.target 指向 mainHandler
        ↓
工作线程把 Message 插入主线程 MessageQueue
        ↓
必要时唤醒主线程
        ↓
主线程 Looper 从 MessageQueue 取出 Message
        ↓
主线程调用 mainHandler.dispatchMessage()
        ↓
主线程调用 Runnable.run()
```

因此代码最终在哪个线程执行，取决于：

```
哪个线程正在运行目标 Looper.loop()
```

不是取决于：

```
哪个线程调用 Handler.post()
```

可以把它总结为一句面试回答：

> Handler 不负责真正的线程切换。发送线程只负责把 Message 放入 Handler 所绑定的 Looper 的 MessageQueue，目标 Looper 所在线程负责从队列取出并执行，所以任务最终运行在目标 Looper 的线程中。

---

## 十五、postDelayed 为什么不保证准时

假设：

```kotlin
handler.postDelayed(taskB, 1000)
```

很多人会把它理解为：

> taskB 一定会在 1000ms 后执行。

实际上它只能保证：

> taskB 不会早于指定时间进入可执行状态。

假设主线程正在执行一个耗时 5 秒的任务：

```
0ms：
主线程开始执行任务 A

1000ms：
任务 B 已经到期

5000ms：
任务 A 执行结束

5000ms 之后：
Looper 才有机会取出任务 B
```

虽然 B 在 1000ms 时已经到期，但 Looper 所在线程当时正在执行 A，无法同时处理另一条消息。

因此 Handler 的延迟调度不是实际调度。

影响实际执行时间的因素包括：

* 前面消息的执行耗时；
* 队列中更早消息的数量；
* 线程调度；
* 设备深度休眠；
* 同步屏障等特殊机制。

所以面试中应当回答：

> `postDelayed()` 只保证消息最早执行时间，不保证精确执行时间。消息到期后仍需等待 Looper 完成当前任务，并处理排在它前面的消息。

---

## 十六、主线程为什么会卡顿

Android 主线程只有一个Looper，同一时间只能处理一条消息。

执行过程天然串行:

```
Message A 开始
Message A 结束
Message B 开始
Message B 结束
Message C 开始
```

如果 Message A 执行时间过长：

```
Message A 耗时 3 秒
        ↓
后续输入事件无法及时处理
        ↓
绘制任务无法及时执行
        ↓
生命周期回调继续排队
        ↓
出现掉帧、卡顿，严重时触发 ANR
```

所以“不能在主线程执行耗时任务”并不是一句抽象规范。

它直接来自 Looper 的单线程串行消费模型:

> 当消息不执行结束，Looper 就无法调用下一次 MessageQueue.next()

---

## 十七、Message 为什么需要对象池

Looper 完成消息分发后，会执行类似：

```java
msg.recycleUnchecked();
```

Message是 Android 中非常高频的对象：

* Handler通信；
* UI 绘制；
* 输入事件；
* 生命周期；
* 动画；
* 系统组件回调；

如果每次发生消息都创建新对象，会增加对象分配和垃圾回收压力。

因此 Android 为 Message 维护了一个静态对象池：

```
Message.obtain()
        ↓
优先从对象池取出旧 Message

消息执行结束
        ↓
清除字段
        ↓
放回对象池
```

这也是为什么推荐：

```java
Message.obtain()
```

或者：

```java
handler.obtainMessage()
```

而不是频繁直接：

```java
new Message()
```

消息入队后还会被标记为正在使用，避免同一个 Message 被重复发送或者重复插入队列。

对象池并不是 Handler 机制成立的基础，而是一项针对高频消息分配的性能优化。

---

## 十八、 Handler 消息机制的线程安全边界

Handler 经常用于跨线程传递数据：

```kotlin
val result = calculateResult();

mainHandler.post {
  	showResult(result)
}
```

消息入队和出队过程具有必要的同步机制，因此发送之前完成的状态可以安全发布给处理线程。

但是，这并不意味着 Message 中携带的所有对象都会变成线程安全对象。

例如：

```kotlin
val list = mutableListOf<String>()

handler.post {
  	println(list)
}

list.add("new item")
```

这里传递的是同一个可变对象引用。

消息发送后，其他线程仍然修改`list` ，就可能产生竞态或不可预测结果。

更安全的做法是发送不可改变快照：

```kotlin
val snapshot = list.toList()

handler.post {
    println(snapshot)
}
```

所以应当区分：

* 消息队列本身是线程安全的；
* 消息中引用的业务对象不一定线程安全。

---

## 十九、面试高频问题总结

### 1. 一个线程可以有几个Looper

最多一个。

Looper 通过 ThreadLocal 与线程绑定，`prepare()` 会检查当前线程是否存在 Looper。

### 2. 一个Looper可以对应一个Handler

可以对应多个。

多个Handler可以绑定同一个 Looper，并向同一个 MessageQueue 发送消息。Message 通过`target`区分最终交给哪个 Handler。

### 3. MessageQueue是所有线程共享的吗

不是全局共享。

一个Looper对应一个MessageQueue，但多个线程可以并发向该`MessageQueue`投递消息，只有Looper所在线程负责消费。

### 4. Handler 如何完成线程切换

发送线程把Message 放进目标 Looper 的 `MessageQueue`，目标线程的`Looper`取出并执行。Handler 本身不创建线程，也不迁移执行栈。

### 5、Looper.loop() 为什么不会占满CPU

因为`MessageQueue.next()` 在没有可执行消息时会通过 native poll 阻塞线程。它是阻塞循环，不是忙循环。

### 6、Handler.post() 和 sendMessage() 有什么区别

两者最终都会发送 Message。

`post()` 将 Runnable 保存在 `Message.callback`；`sendMessage()` 通常使用 `what`、`arg1`、`arg2` 和 `obj`。

### 7. postDelayed 为什么不一定准时

延迟消息只决定消息最早可执行时间。Looper 当前任务耗时、前序消息拥堵、线程调度和深度休眠都会造成进一步延迟。

### 8. 为什么 MessageQueue 要按照时间排序

因为它同时支持立即消息和延迟消息。按`when`排序后，队头始终是最早应执行消息，Looper 才能正确计算下一次阻塞时间。

### 9. 为什么Message需要target

同一个 MessageQueue 中可能存在多个 Handler 的消息。Looper 通过 `message.target.dispatchMessage(message)` 将消息交回正确的 Handler。

### 10. 主线程为什么不能执行耗时任务

主线程 Looper 串行处理消息。当前消息不结束，后续输入、绘制和生命周期消息都无法执行，从而产生卡顿甚至 ANR。

---

## 二十、用一段伪代码概括整个机制

最后，可以把一条 `Handler.post()` 调用压缩成下面这段伪代码：

```java
// 工作线程执行

Message msg = Message.obtain();
msg.callback = runnable;
msg.target = mainHandler;
msg.when = SystemClock.uptimeMillis();

mainMessageQueue.enqueueMessage(msg);

// 必要时唤醒主线程
nativeWake();
```

主线程则一直运行：

```java
while (true) {
    Message msg = mainMessageQueue.next();

    if (msg == null) {
        return;
    }

    msg.target.dispatchMessage(msg);
    msg.recycleUnchecked();
}
```

而 Handler 分发消息：

```java
void dispatchMessage(Message msg) {
    if (msg.callback != null) {
        msg.callback.run();
    } else if (
        callback != null
        && callback.handleMessage(msg)
    ) {
        return;
    } else {
        handleMessage(msg);
    }
}
```

至此，完整链路形成闭环：

```text
Handler 决定消息投递到哪个 Looper
        ↓
Message 保存执行时间、任务和目标 Handler
        ↓
MessageQueue 按时间保存和调度消息
        ↓
Looper 阻塞等待并不断取出消息
        ↓
Handler 在 Looper 所在线程完成消息分发
        ↓
Thread 真正执行 Runnable 或 handleMessage
```

------

## 结语

Handler、Looper 和 MessageQueue 并不是三个孤立的类，而是一套完整的线程事件循环系统。

理解这套机制后，很多 Android 问题都会得到统一解释：

- Handler 为什么能跨线程提交任务；
- 主线程为什么必须保持消息循环；
- 为什么主线程不能执行耗时任务；
- 为什么延迟任务可能晚执行；
- HandlerThread 为什么能串行处理后台任务；
- `Dispatchers.Main` 为什么最终仍要回到主线程事件循环；
- Choreographer、VSYNC 和 UI 绘制为什么都离不开主线程消息队列。

真正值得记住的不是某几行源码，而是下面这套模型：

```text
发送线程只负责入队
目标线程负责出队与执行

一个线程最多一个 Looper
一个 Looper 对应一个 MessageQueue
一个 Looper 可以绑定多个 Handler

MessageQueue 多线程生产
Looper 线程单线程消费
```

当能够从 `Handler.post()` 一直讲到 `MessageQueue.next()`、`nativePollOnce()` 和 `dispatchMessage()` 时，Handler 消息机制就不再是一组需要背诵的面试题，而是一套可以自然推导的底层模型。
