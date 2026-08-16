+++
title = 'Kotlin 协程基础：挂起函数、作用域与 async/await'
date = '2025-06-30T19:02:22+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Kotlin', 'Coroutines', 'Async']
description = "整理 Kotlin 协程的基础使用模型：挂起函数、回调转协程、CoroutineScope、结构化并发、async/await 和 Android 生命周期绑定。"
slug = "kotlin-coroutines-basics"
+++

协程的目标不是“开一个更轻的线程”，而是用同步写法表达异步流程，并通过作用域管理任务生命周期。

## 核心结论

1. `suspend` 表示函数可以挂起，但挂起不等于阻塞线程。
2. `CoroutineScope` 决定协程的生命周期。
3. Android 中优先使用 `viewModelScope`、`lifecycleScope` 等有生命周期的 scope。
4. `launch` 适合执行任务，`async` 适合并发计算并返回结果。
5. 回调转协程时要处理取消，避免任务泄漏。

## 挂起函数

挂起函数可以在不阻塞线程的情况下等待异步结果。

```kotlin
suspend fun loadUser(id: String): User {
    return api.getUser(id)
}
```

调用方看起来是顺序代码：

```kotlin
viewModelScope.launch {
    val user = loadUser(id)
    _uiState.value = UiState.Success(user)
}
```

但底层遇到挂起点时，当前协程会让出线程，等结果回来后再恢复执行。

## 回调转协程

单次回调可以用 `suspendCancellableCoroutine`：

```kotlin
suspend fun awaitLocation(): Location =
    suspendCancellableCoroutine { continuation ->
        val callback = object : LocationCallback {
            override fun onLocation(location: Location) {
                continuation.resume(location)
                locationClient.removeCallback(this)
            }

            override fun onError(error: Throwable) {
                continuation.resumeWithException(error)
                locationClient.removeCallback(this)
            }
        }

        locationClient.request(callback)

        continuation.invokeOnCancellation {
            locationClient.removeCallback(callback)
        }
    }
```

关键点是取消处理：协程被取消时，也要取消底层回调或请求。

多次回调更适合用 `callbackFlow`。

## CoroutineScope

`CoroutineScope` 可以理解为协程的生命周期容器。

```text
CoroutineScope
  -> CoroutineContext
  -> Job
  -> Dispatcher
```

Android 常用 scope：

| Scope | 生命周期 |
| --- | --- |
| `viewModelScope` | ViewModel 清除时取消 |
| `lifecycleScope` | Lifecycle 销毁时取消 |
| `rememberCoroutineScope()` | Composable 离开组合时取消 |

不要随手使用 `GlobalScope`。它没有业务生命周期，很容易造成任务泄漏。

## launch 和 async

### launch

`launch` 用来启动一个不直接返回结果的任务。

```kotlin
viewModelScope.launch {
    repository.sync()
}
```

### async

`async` 用来并发执行并返回结果。

```kotlin
viewModelScope.launch {
    val userDeferred = async { repository.loadUser() }
    val configDeferred = async { repository.loadConfig() }

    val user = userDeferred.await()
    val config = configDeferred.await()
}
```

注意：`async` 启动后就会开始执行，`await()` 是等待结果，不是启动任务。

## 结构化并发

结构化并发要求子协程属于某个父 scope。父任务取消时，子任务也会被取消。

```kotlin
viewModelScope.launch {
    coroutineScope {
        launch { loadA() }
        launch { loadB() }
    }
}
```

这样可以避免“页面都没了，任务还在跑”的问题。

## Android 实践

1. ViewModel 中发起业务请求；
2. UI 层只收集状态；
3. 网络、数据库放到合适 Dispatcher；
4. 长任务关注取消；
5. 一次性事件不要混在持久 UI State 里。

```kotlin
class UserViewModel(
    private val repository: UserRepository,
) : ViewModel() {
    fun refresh() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            _uiState.value = runCatching {
                repository.loadUser()
            }.fold(
                onSuccess = { UiState.Success(it) },
                onFailure = { UiState.Error(it) },
            )
        }
    }
}
```

## 回看清单

1. `suspend` 是可挂起，不是阻塞。
2. scope 管生命周期，dispatcher 管线程调度。
3. `launch` 做任务，`async` 做并发结果。
4. 回调转协程必须处理取消。
5. Android 中不要让协程生命周期长于页面或 ViewModel。
