+++
title = 'Kotlin 异步编程'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Kotlin', 'Coroutine', 'Flow', 'Async']
description = "深入理解 Kotlin 异步编程：协程原理、Flow 背压与结构化并发。"
slug = "android-async-programming"
+++

## 核心问题

**协程是如何实现"用同步代码写异步逻辑"的？**

理解这个问题，就理解了 Kotlin 协程的核心设计。

---

## 知识脉络

### 第一层：为什么需要协程

#### 回调地狱

```kotlin
// 传统回调方式
api.login(user) { result ->
    api.getUserInfo(result.id) { info ->
        api.getAvatar(info.avatarUrl) { bitmap ->
            runOnUiThread { view.setBitmap(bitmap) }
        }
    }
}
```

#### 协程方式

```kotlin
// 协程方式
lifecycleScope.launch {
    val result = api.login(user)
    val info = api.getUserInfo(result.id)
    val bitmap = api.getAvatar(info.avatarUrl)
    view.setBitmap(bitmap)  // 自动切回主线程
}
```

---

### 第二层：协程原理

#### CPS 转换

编译器将 `suspend` 函数转换为**状态机**：

```kotlin
// 源码
suspend fun loadData(): Data {
    val user = api.getUser()  // 挂起点 #1
    val posts = api.getPosts(user.id)  // 挂起点 #2
    return Data(user, posts)
}

// 编译后（简化）
fun loadData(cont: Continuation): Any? {
    val sm = cont as? LoadDataSM ?: LoadDataSM(cont)

    when (sm.label) {
        0 -> {
            sm.label = 1
            return api.getUser(sm)  // 挂起
        }
        1 -> {
            sm.user = sm.result
            sm.label = 2
            return api.getPosts(sm)
        }
        2 -> {
            return Data(sm.user, sm.result)
        }
    }
}
```

#### 挂起与恢复

```
挂起：保存状态(label + 局部变量) → 返回 COROUTINE_SUSPENDED → 释放线程
恢复：异步任务完成 → continuation.resumeWith() → 从断点继续执行
```

---

### 第三层：调度器

#### 类型

| 调度器 | 用途 | 线程数 |
|--------|------|--------|
| `Dispatchers.Main` | UI 操作 | 1 (主线程) |
| `Dispatchers.Default` | CPU 密集 | CPU 核心数 |
| `Dispatchers.IO` | IO 操作 | 可扩展 (64+) |
| `Dispatchers.Unconfined` | 不切换 | 调用者线程 |

#### 线程切换

```kotlin
withContext(Dispatchers.IO) {
    // 在 IO 线程执行
    val data = api.fetchData()
}
// 自动切回原线程
```

---

### 第四层：Flow

#### 冷流 vs 热流

| 类型 | 特点 | 示例 |
|------|------|------|
| 冷流 | 有订阅者才发射 | `flow { }` |
| 热流 | 无论有无订阅都发射 | `SharedFlow`, `StateFlow` |

#### 背压处理

当生产快于消费时：

| 操作符 | 策略 |
|--------|------|
| `buffer()` | 缓存 |
| `conflate()` | 丢弃旧值 |
| `collectLatest()` | 取消旧处理 |

```kotlin
flow {
    repeat(100) { emit(it) }
}
.buffer(10)  // 缓存 10 个
.conflate()  // 只保留最新
.collect { value ->
    delay(100)  // 消费慢
}
```

#### StateFlow vs SharedFlow

| 特性 | StateFlow | SharedFlow |
|------|-----------|------------|
| 初始值 | 必须 | 可选 |
| replay | 1 | 可配置 |
| 去重 | 自动 | 无 |

---

## 面试高频点

### Q1: Dispatchers.IO 和 Default 共享线程池？

是的。它们共享底层线程池，只是限制策略不同。

### Q2: 协程如何取消？

```kotlin
val job = launch {
    while (isActive) {  // 检查取消状态
        delay(1000)
    }
}

job.cancel()  // 取消
```

### Q3: superviseJob 的作用？

子协程失败不影响父协程和其他兄弟：

```kotlin
val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

scope.launch {
    // 子 1 失败不影响子 2
}
scope.launch {
    // 子 2
}
```

### Q4: 如何保证生命周期安全？

```kotlin
// Compose
val state by viewModel.state.collectAsStateWithLifecycle()

// Activity/Fragment
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.state.collect { }
    }
}
```

---

## 知识关联

- [消息机制](message-system.md)：协程在 Android 的底层实现
- [现代 UI 架构](modern-ui-architecture.md)：MVI 中的状态流
