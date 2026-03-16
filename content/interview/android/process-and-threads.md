+++
title = 'Android 进程与线程'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Process', 'Thread', 'Binder', 'IPC']
description = "深入理解 Android 进程与线程模型：Binder IPC 原理与 Activity 启动流程。"
slug = "android-process-and-threads"
+++

## 核心问题

**点击图标后，Activity 是如何启动的？**

理解这个问题，就理解了 Android 进程间通信的核心。

---

## 知识脉络

### 第一层：进程 vs 线程

| 维度 | 进程 | 线程 |
|------|------|------|
| 资源 | 独立地址空间 | 共享地址空间 |
| 通信 | IPC | 共享内存 |
| 开销 | 高 | 低 |
| 隔离 | 强 | 弱 |

#### Android 进程特点

- 基于 Linux 进程
- 每个应用默认一个进程（可配置多进程）
- 进程优先级决定存活可能性

---

### 第二层：Binder IPC

#### 为什么选择 Binder

| 维度 | Binder | 管道/Socket |
|------|--------|-------------|
| 拷贝次数 | 1 次 | 2 次 |
| 安全性 | UID/PID 校验 | 需自行实现 |
| 编程模型 | 面向对象 RPC | 字节流 |

#### 通信流程

```
Client                    Binder Driver                   Server
   │                           │                            │
   │─── transact() ───────────>│                            │
   │                           │──── onTransact() ─────────>│
   │                           │                            │ (执行)
   │                           │<─── reply ─────────────────│
   │<─── return ──────────────│                            │
```

#### 一次拷贝的奥秘

**mmap** 将内核空间的一块内存映射到用户空间：

1. Client 通过 `copy_from_user` 将数据拷贝到 mmap 区域
2. Server 直接从 mmap 读取（无需再拷贝）

---

### 第三层：Activity 启动流程

#### 完整链路

```
Launcher 点击图标
    ↓ (Binder)
ActivityManagerService.startActivity()
    ↓ (检查进程是否存在)
    ├── 存在 → 直接调度 Activity 生命周期
    └── 不存在 → 请求 Zygote fork 新进程
                    ↓ (Socket)
               Zygote.fork()
                    ↓
               子进程初始化
                    ↓
               ActivityThread.main()
                    ↓
               ├── Looper.prepareMainLooper()
               ├── ActivityThread.attach()
               └── Looper.loop()
                    ↓
               Application.onCreate()
                    ↓
               Activity.onCreate() → onStart() → onResume()
                    ↓
               首帧绘制完成
```

#### Zygote：进程孵化器

- 系统启动时预加载常用类和资源
- 新进程通过 `fork()` 从 Zygote 复制，无需重新加载

```
Zygote 进程
├── System Server
├── App Process #1
├── App Process #2
└── ...
```

---

### 第四层：线程模型

#### 主线程职责

- UI 渲染
- 事件分发
- Activity 生命周期
- 消息处理

#### 线程池

| 类型 | 用途 |
|------|------|
| Binder 线程池 | 处理 IPC 请求（默认 16 个） |
| AsyncTask 线程池 | 已废弃，用协程替代 |
| OkHttp 连接池 | 网络请求 |

#### 线程数建议

| 任务类型 | 公式 |
|----------|------|
| CPU 密集型 | N + 1（N = CPU 核心数） |
| IO 密集型 | 2N 或更多 |

---

## 面试高频点

### Q1: Binder 一次拷贝发生在哪里？

**mmap** 将内核空间的一块内存映射到用户空间：

1. Client 通过 `copy_from_user` 将数据拷贝到 mmap 区域
2. Server 直接从 mmap 读取（无需再拷贝）

### Q2: Application.onCreate 和 Activity.onCreate 谁先？

**Application.onCreate 先执行**。

```
进程创建 → Application.attach() → Application.onCreate() → Activity.onCreate()
```

### Q3: 多进程模式如何开启？

```xml
<activity
    android:name=".RemoteActivity"
    android:process=":remote" />  <!-- 私有进程 -->

<activity
    android:name=".PublicActivity"
    android:process="com.example.public" />  <!-- 全局进程 -->
```

**注意**：多进程会导致 Application 多次创建。

### Q4: Binder 线程池如何工作？

1. Client 发起 transact
2. Binder Driver 将请求放入 Server 的待处理队列
3. Server 的 Binder 线程从队列取出请求
4. 执行 onTransact
5. 结果返回给 Client

---

## 实战案例

### 进程间通信

```kotlin
// AIDL 接口
interface IRemoteService {
    fun getData(): String
    fun setData(data: String)
}

// 服务端
class RemoteService : Service() {
    private val binder = object : IRemoteService.Stub() {
        override fun getData() = "Hello"
        override fun setData(data: String) { /* ... */ }
    }

    override fun onBind(intent: Intent) = binder
}

// 客户端
val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, service: IBinder) {
        val remoteService = IRemoteService.Stub.asInterface(service)
        val data = remoteService.data
    }
}
bindService(intent, connection, Context.BIND_AUTO_CREATE)
```

---

## 知识关联

- [消息机制](message-system.md)：线程间通信
- [性能优化](performance-optimization.md)：线程调度优化
