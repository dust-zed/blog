+++
date = '2026-02-09T10:10:12+08:00'
draft = true
title = 'Android App 启动流程'
categories = ['android']
tags = ['Android', 'Startup', 'Framework', 'Zygote']
description = "从点击图标到页面显示：Launcher、AMS、Zygote 三方协作的完整启动流程解析。"
slug = "android-app-startup"
+++

## 从点击图标到页面显示

我们把这个过程分为三个剧场：**Launcher（桌面）**, **System Server(AMS)**, **Zygote (孵化器)**

### 第一阶段：请求与孵化（The Request & The Fork）

这是一个“借刀杀人”的过程。Launcher 自己不能启动 App，它必须求助于 AMS。

#### 1. Launcher -> AMS (Binder 通信)

* 动作： 当你点击桌面图标，Launcher 进程调用`startActivity`。
* 底层： Launcher(Client)通过 Binder 告诉 AMS（Server）：“我要启动某某 App 的 MainActivity”。
* 知识点：这里发生来了一次 Binder IPC。

#### 2. AMS的决策

* AMS 检查这个 App 的进程是否已经存在。
* 如果存在（热启动）：直接通过 Binder 通知该进程`onResume`,速度很快。
* 如果不存在（冷启动）：AMS 必须创建一个新进程。

#### 3. AMS -> Zygote（Socket通信 -- 高频）

* 动作：AMS 发现需要新进程，它不是自己去创建，而是通知 **Zygote 进程**。
* 底层：AMS 通过`LocalSocket`发送请求给 Zygote。
* 必须知道：为什么这里不用 **Binder** 而用 **Socket**？
  * **死锁风险**：Zygote 的主要工作是`fork()`。在 Linux 中，`fork()`只会拷贝当前**线程**，而不会拷贝**其他线程**。如果 Zygote 使用 Binder（它是多线程的），且`fork()`时某个 Binder 锁被其他线程持有，新进程里这个锁就永远处于**被锁住**的 状态（不会被释放？因为持有线程的锁没有被拷贝过来），导致新进程一启动就**死锁**。
  * **Socket 优势**：Socket 是单线程、顺序执行的，对于`fork`这种敏感操作更安全。

#### 4. Zygote -> 新进程（Fork）

* 动作：Zygote 收到请求，执行`fork()`系统调用，复制自身，生成一个新的 App 进程。
* 底层：利用**Copy-on-Write(写时复制)**技术。新进程共享 Zygote 的资源库（系统类、资源），只有当新进程需要修改数据时，才会真正拷贝物理内存。这就是 Android 应用启动快，省内存的秘诀。

### 第二阶段：初始化与绑定（Init & Attach）

新进程刚出生时是一张白纸，它不知道自己是谁，也不知道要干嘛。

#### 5. 新进程启动（ActivityThread.main）

* 动作： 新进程开始执行入口函数`ActivityThread.main()`。
* 底层：这里会初始化我们熟悉的**Looper.prepareMainLooper()** 和 **Looper.loop()** -- **主线程的消息循环从此开始运转**。

#### 6. 新进程 -- AMS（Binder 通信）

* 动作：新进程（现在它是 Client）通过 Binder 告诉 AMS（Server）：“大佬，我启动好了，请把 Application 信息发给我。”
* 方法名： `attachApplication`。
* 知识点：这是新进程主动发起的第一次 Binder 调用。

### 第三阶段：生命周期回调（LifeCycle）

AMS 确认“人”到了，开始派活。

#### 7. AMS -> 新进程（Binder通信）

* 动作： AMS 通过 Binder 接口（`IApplicationThread`）发回指令。
* 指令 1：`bindApplication` -- 触发`Application.onCreate()`。
* 指令 2：`scheduleLaunchActivity` -- 触发 `Activity.onCreate()`。

#### 8. 主线程处理（Handler）

* 动作: 新进程的 Binder 线程池收到 AMS 指令后，通过`Handler`把消息抛给主线程(`H`类)。
* 执行： 主线程 Looper 收到消息后，执行`handleBindApplication`和`handleLaunchActivity`。
* 结果：在屏幕上终于显示出了界面。

### 核心图谱 : Android 的创世纪三部曲

我们要搞清楚三个角色的出场顺序：Init 进程 -> Zygote进程 -> System Server 进程。

#### 第一铲：万物起源 -- Init进程（PID =1）

* 角色： Linux 系统的第一个用户级进程，所有进程的老祖宗。
* 动作：
  1. 电源键按下，Bootloader 引导 kernel 启动。
  2. Kernel 启动完毕后，查找并执行`/init`文件。
  3. Init 进程读取`init.rc`配置文件。
  4. 关键指令： 在配置文件里写着一行`service zygote ...`，Init 也就是在这里把 **Zygote**启动了起来。

#### 第二铲：母体降临 -- Zygote进程（Java世界的夏娃）

* 角色：Android Java 世界的孵化器。所有的 App 进程（包括 System Server）都是它的子孙。
* 动作（ZygoteInit.main）:
  1. 启动虚拟机（ART/Dalvik）：这是 Java 代码运行的基础。
  2. 预加载资源（Preload）：（面试必考）Zygote 会把常用的系统类（`String`, `Activity`等）和资源（drawable, styles）加载到自己的内存里。
     * 为什么要这样做？因为后面 fork 出的新进程会继承这些内存（Copy-on-Write）。大家共享这些资源，既省内存，启动又快。
  3. 启动 System Server：Zygote 觉得一个人太孤独，且管不过来，于是它`fork`出了它的长子 -- **System Server**。
  4. **建立 Socket 服务端**: 任务完成，Zygote 建立一个`LocalSocket`服务端，进入死循环，等待 System Server 发号施令。

#### 第三铲：大管家上位 -- System Server 进程

* 角色： Android 系统的“CEO”。它虽然是 Zygote 生成的，但它掌管着 Zygote 的接单权。
* 动作（SystemServer.main）:
  1. 启动 Binder 线程池：**（关键差异）** Zygote 为了防死锁不用 Binder，但 System Server 是大管家，必须处理海量并发请求，所以它第一件事就是初始化 Binder。
  2. 启动系统服务：它一口气启动了 80+ 个服务，包括我们熟悉的：
     * AMS (Activity Manager Service) : 统管四大组件。
     * WMS（Window Manager Service）：统管窗口。
     * PMS （Package Manager Service）：统管安装包。
  3. 进入 Looper 循环：这里的 Looper 就在等着处理各种 Binder 也就是 App 发来的请求了。

#### 夺命连环问

##### 1. 为什么System Server 要被Zygote Fork出来，而不是有Init直接启动？

这个问题考察对**Copy-on-Write(COW)**的理解。

* 回答要点：
  * 资源共享：System Server 本质上也是一个 Java 进程，它也需要运行环境和系统类。
  * 继承红利：如果 Init 直接启动，System Server 就得自己重新加载一遍虚拟机和资源，既慢有浪费内存。让 Zygote fork 它，它就能直接继承 Zygote 预加载好的所有资源（类、图片、各种 drawable），落地即满级。

##### 2. Zygote 和System Server是怎么配合工作的？

这个问题考察你对 IPC 架构的理解。

* 回答要点：
  * 父子关系：Zygote fork 了 System Server。
  * C/S 关系（Socket）：
    * System Server（里的 AMS）充当 Client。
    * Zygote 充当 **Socket Server**。
    * 当 AMS 需要启动新 App 时，它通过 Socket 发消息给 Zygote：“给我 fork 个新进程”。
  * C/S 关系（Binder）：
    * App 启动后（Client），会通过 Binder 找 AMS 注册自己。

##### 3. 如果System Server挂了（Crash）会发生什么？

这个问题考察你对 **Android 系统稳定性**的认知

* 回答要点：
  * 手机重启（Soft Reboot）。
  * Zygote 会监听他的子进程。如果 System Server 挂了，Zygote 会"自杀"（因为大管家没了，系统没法运行了）。
  * Init 进程发现 Zygote 挂了，会重启 Zygote。
  * Zygote 重启后，又会再次启动 System Server。
  * 这就是为什么有时候手机卡死黑屏后，会显示开机动画重新进入系统。

##### 4. 为什么zygote不直接当System Server呢

一句话就是 **各司其职**。具体来说，是因为 **内存洁癖**、**生死隔离**、**并发死锁** 和 **权限安全**这四大硬性约束。

我们来逐一拆解：

###### 1. 内存洁癖：Zygote必须是"纯净的母体"

这是最核心的原因。

* Zygote的角色： 它是一个**模板(Template)** 。他的内存里应该只包含所有 **App 公用的、只读的**基础资源（比如`String`类、`View`类、`drawable`资源）。
* System Server 的角色：它是一个**管理员**。它的内存里塞满了 **动态的、脏的**运行时数据（比如当前运行了哪些 App、窗口的位置、电池电量、用户的锁屏密码等）。

如果 Zygote 直接当 System Server：Zygote 的内存里就会包含上述的脏数据。当 Zygote fork 一个新的 App（比如微信）时，根据`Copy-on-Write`机制，**微信会继承 Zygote 的所有内存数据**。

* 后果：微信一启动，内存里就莫名其妙多了"当前所有 App 的列表"、“电池电量记录”等它根本不需要、甚至不该知道的数据。这不仅浪费内存，还可能导致数据泄露。

所以：Zygote 必须保持“纯洁”和“静态”，只包含通用的代码和资源。一旦 fork 出 System Server，System Server 就可以尽情地在自己的进程里搞脏自己的内存，而不会影响后续孵化出来的 App。

###### 2. 生死隔离： Zygote不能死

* Zygote 的使命：它是 Android 世界的女娲。只要它活着，App 挂了可以重开，System Server 挂了可以重启。
* System Server 的风险：它运行着 80+ 个系统服务，逻辑极其复杂，代码量巨大，还要处理各种第三方 App 的奇怪请求。它崩溃的概率远高于 Zygote。

如果 Zygote 直接当 System Server：一旦 AMS 或 WMS 因为某个 Bug 崩溃了，整个 Zygote 进程就会挂掉。

* 后果： Android 系统彻底死透了。因为孵化器没了，没人能重建系统，也没人能孵化新 App，只能等待 Linux 内核（Init 进程）重启手机。

现在的架构：System Server 挂了 -> Zygote 还在 -> Zygote 监听到子进程死亡 -> Zygote 重启 System Server -> 手机"软重启"（Soft reboot，只闪一下开机动画，不用重新引导内核）。

###### 3. 并发死锁：Binder与Fork的天生互斥

我们在前面提到过，**Zygote 为什么用 Socket 而不用 Binder**?因为 Binder 是多线程的，而`fork()`在多线程环境下即易死锁。

* System Server: 必须高度依赖 Binder（它是系统的大管家，要处理成千上万的并发请求）。所以 System Server 里有密密麻麻的 Binder 线程池。
* Zygote ：必须保持单线程（或者极简的线程模型）、才能安全地执行`fork()`。

如果 Zygote 直接当 System Server：它既要运行 Binder 线程池来处理系统服务，又要执行`fork()`来孵化 App。

* 后果：当 zygote 正在处理一个 Binder 请求（锁住了某个资源）时，突然来了一个孵化请求执行`fork()`。新生成的 App 进程里，那个"锁"是被锁住的，但持有锁的线程没被拷贝过来 -- **死锁发生了，新 App 永远卡死在启动界面**。

###### 4. 权限安全：Root vs System

* Zygote: 必须拥有 Root 权限。因为它要操作底层资源，要`setuid`(给新 App 分配独立的用户 ID)，这都是特权操作。
* System Server: 只需要 System 权限（`uid=1000`）。它虽然权力大，但不能拥有 Root 权限，以防被黑客利用攻破整个系统内核。

现在的架构：Zygote(Root) -> fork() -> 新进程 -> 降权（Drop Permission） -> 变成了 System Server （System User）或者 App（App User）。这样最安全，权限最小化。

##### 5. 为什么Binder 被锁阻塞的线程拷贝过来就永远是锁住的呢？

简单的答案是：因为`fork()`只有复制当前执行`fork()`的那个线程，而不会复制其他线程。但是，它却复制了所有线程持有锁的状态。

假设 Zygote 进程里有两个线程：

1. 线程 A（Binder 线程）：正在准备处理一个系统请求，它拿了一把锁（Mutex），准备写日志。
2. 线程 B（主线程）：准备执行`fork()`来孵化新进程（比如启动微信）。

###### 第一步：Zygote正常运行

* 线程 A 运行到一半，执行了`lock.acquire()`（加锁）。
* 此时，锁（Mutex）的状态在内存里变成了"Locked"。
* 线程 A 还没来的及释放锁，CPU 时间片到了，切到了线程 B。

###### 第二步：执行Fork

* 线程 B 执行 fork
* 关键点：Linux 的 fork（）规定，只复制**调用 fork 的那个线程**（也就是线程 B）。
* 后果：新生成的进程（微信进程）里，只有**线程 B 的克隆体，没有线程 A**

###### 第三步：遗产继承（灾难开始）

* 虽然线程 A 没过来，但是 Zygote 进程里的所有内存数据都被复制过来了（通过 Copy-on-Write）。
* 重点：那把锁（Mutex）是内存里的一个对象。在 Zygote 里，它是"Locked"状态，所以，在新进程里，这把**锁也依然是 Locked 状态**。

###### 第四步：新进程启动

* 新进程（微信）开始初始化。
* 微信的初始化代码里，也需要写日志（或者使用 Binder）。
* 微信的主线程尝试执行`lock.accquire()`。

###### 第五步：死锁（DeadLock）

* 微信的主线程发现：咦？这把锁已经被锁住了
* 于是微信主线程挂起，等待锁被释放
* 但是！真正持有这把锁的人 -- **Zygote 里的线程 A** -- 根本没有被拷贝到微信进程里来
* 结局：微信进程流永远没有任何人能去执行`lock.release()`。这把锁成了“幽灵锁”，微信进程一出生就卡死在初始化阶段，永远等待一个不存在的线程来解锁。

#### 什么是Copy-on-Write

这是操作系统偷懒的内存管理策略。

简单一句话总结：**只有在真正修改数据时，才去复制一份；如果只是读取，那就大家共用一份**。

##### 1. 核心原理：能不复制，就不复制

为了彻底理解，我们还是用 Zygote 和新 App 的例子。

假设 Zygote 进程内存里有一张 100MB 的资源地图（里面有 String 类，Drawable 图片，系统主题等）。

###### 第一阶段：Fork发生时（假装复制）

当 Zygote 执行`fork()`孵化新App 时：

* 操作系统不做的事：它不会傻乎乎的把这 100MB 物理内存 Copy 一份给新 App。那太慢了
* 操作系统做的事：他只是把 Zygote 的“页表”（Page Table， 也就是内存地址映射关系）复制了一份给新 App。
* 结果： Zygote 和新 App 的虚拟地址虽然是独立的，但它们指向的**物理内存是完全同一块**。
* 标记：操作系统会把这块共享的内存区域标记为**只读**（Read-Only）。

###### 第二阶段：大家只读不写（和平共处）

* 只要新 App 和 Zygote 都只是读取这些数据（比如读取一个 String，或者加载一张系统图标），它们就一直共用这块物理内存。
* 收益：内存占用极低，因为没有产生新的副本。

###### 第三阶段：有人要搞事了（触发写时复制）

* 动作：突然，新 App 想要修改某个变量（比如把一个静态变量`sConfig ="default"` 改为`custom`）。
* 冲突： 也就是写操作。
* 异常：因为这块内存被标记为“只读”，CPU 会立即抛出一个** 缺页异常（Page Fault）**,告诉操作系统有人想要只读数据
* 处理：操作系统介入。它会说：好吧，既然你要改，那这页数据就不能共享了。
  	1. 操作系统把 **这一页（通常是 4KB）**数据复制一份 ，生成一个新的物理内存页。
  	1. 把新 App 的页表指向这个 新的物理页
  	1. 把新页的权限改为可读写。
* 结果：现在，新 App 可以随意修改这份新的数据了，而 Zygote 手里的那份依然是旧的。它们从此在这一页数据上分道扬镳。
