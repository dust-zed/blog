+++
title = '协程知识点'
date = '2025-06-30T19:02:22+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Kotlin', 'Coroutines', 'Async']
description = "Kotlin 协程基础知识点：将回调转换为挂起函数、协程作用域 (CoroutineScope) 以及 async/await 的行为解析。"
slug = "kotlin-coroutines-basics"
+++

## 将回调转换为协程

**背景**：很多库（尤其是Java/Android遗留库）使用基于回调（Callback）的API处理异步操作（如网络请求，数据库操作）。这在代码中会导致回调地狱。我们需要一种方法将这种回调风格的API转换成`挂起函数(suspend fun)`，使其可以在协程中像**顺序代码**一样使用。

**核心函数：**

1. **`suspendCoroutine`(简单转换，无内置取消支持)**

```kotlin
suspend fun <T> convertCallbackToSuspendingFunc(): T = suspendCoroutine {
  continuation ->
  //1. 启动异步操作
  val callback = object : Callback<T> {
    override fun onSuccess(result: T) {
      //2. 成功时恢复协程，传递结果
      continuation.resume(result)
    }
    override fun onFailure(error: Throwable) {
      //3. 失败时恢复协程，传递异常
      continuation.resumeWithException(error)
    }
  }
  someAsyncOperation(callback)
}
```

* continuation: 表示当前被挂起的协程。它提供了恢复协程的方法：resume(value)和resumeWithException(exception)。
* 缺点：如果调用这个suspend fun 的协程被取消。someAsyncOperation不会自动终止。这可能导致资源浪费或意外结果。只适用于异步操作本身非常快或你不关心取消的情况。

2. **`suspendCancellableCoroutine`(支持取消)**

```kotlin
suspend fun <T> convertCallbackToSuspendingFuncSafely(): T = suspendCancellableCoroutine { cancellableContinuation ->
    // 1. 启动异步操作
    val callback = object : Callback<T> {
        override fun onSuccess(result: T) {
            cancellableContinuation.resume(result)
        }
        override fun onFailure(error: Throwable) {
            cancellableContinuation.resumeWithException(error)
        }
    }
    someAsyncOperation(callback)

    // 2. ⭐ 关键步骤：注册取消监听器 ⭐
    cancellableContinuation.invokeOnCancellation {
        // 当协程被取消时，尝试取消底层的异步操作
        // 通常调用库提供的取消方法，例如：cancelOperation(callback)
        cancelOperation(callback)
    }
}
```

- 当调用这个`suspend fun`的协程被取消时：
  1. 协程的取消状态会传播到这个 `CancellableContinuation`。
  2. 触发 `invokeOnCancellation {}` 块。
  3. 在块内，你调用库的取消方法去清理资源并停止操作。
- 这是**将回调 API 集成到协程世界的最佳实践**。

## 协程作用域

### 1、什么是协程作用域（CoroutineScope）

* `CoroutineScope`不是协程本身，而是一个**定义新协程运行环境**的接口
* 它为在其内部启动的所有子协程提供了一个统一的`CoroutineContext`基础
* 它将所有在其内部启动的协程**组织在一个结构中**，以便进行**生命周期管理**

**核心构成：**

CoroutineScope接口只有一个属性：

```kotlin
interface CoroutineScope {
  val coroutineContext: CotoutineContext
}
```

这个`coroutineContext`是启动在该作用域内的**所有子协程的默认上下文**。

**协程作用域的核心优点**

1. **生命周期的自动管理(取消)**
   * 避免内存泄漏
   * 简化资源清理
2. **安全性与清晰性**
   * 取消传播：作用域的取消会自动且可靠地传播到所有子协程，无需开发者手动级联取消
   * 异常处理控制：作用域定义了异常传播的策略（通过其关联的`Job`是普通`Job`还是`SupervisorJob`）。`SupervisorJob`允许子协程独立失败而不影响其他兄弟协程和父作用域（常用于UI组件中单独的后台任务）。
   * 代码组织清晰：将任务划分到不同的作用域中，体现了任务的逻辑和生命周期归属。
3. **上下文继承与共享**
   * 在作用域内启动的协程默认继承作用域的coroutineContext
   * 可以指定不同的CoroutineContext元素来覆盖上下文
4. **协同等待(job.join(), coroutineScope {})**
   * 你可以通过作用域的关联 `Job` (调用 `scope.coroutineContext[Job]!!.join()` 或更简单地使用 `coroutineScope {}` 构建器) 来**等待作用域内所有子协程全部完成**。这保证了任务内部的并发操作在外部看来是原子性的（即父协程等待所有子协程完成后自己才完成）。
   * `coroutineScope {}` 构建器本身也会创建一个新的子作用域，并等待其内部所有子协程完成

----

## async的行为

### 1. async的立即启动特性

* async不是等待await才执行：当使用async { ... } 创建协程时，其中的代码会立即开始执行，而不是等待调用`await()`。即使不调用await()，协程体也会在后台启动。
* 并发执行：多个async协程默认并行执行（取决于调度器和上下文）。例如：

```kotlin
val deferred1 = async { task1() } // 立即开始执行
val deferred2 = async { task2() } // 立即开始执行（可能与 task1 同时运行）
```

### 2. await()的作用

* 同步等待结果：await()是一个挂起点：
  * 如果协程已完成：直接返回结果
  * 如果协程未完成：挂起当前协程，等待结果但不阻止其他协程执行
* 顺序控制：await()可强制等待顺序：

```kotlin
val result1 = deferred1.await() // 等待 task1 完成
val result2 = deferred2.await() // 再等待 task2 完成
```

## Q&A

1. 父协程的挂起会影响子协程的运行吗？
   * **通常不会影响子协程的运行**，父协程与子协程是独立的任务单元，只要子协程未完成且未被取消，他们会继续由调度器分配线程执行。取消是取消，挂起时让出当前线程

2. 父作用域会等待所有子协程完成后才继续执行？
   * 是的，所有父协程（父作用域）会自动等待所有子协程完成。`join()`和`wait()`**控制执行顺序**和**确保在特定节点有结果**

3. 为什么I/O操作支持挂起，而CPU密集操作需要`withContext`手动挂起。

   * I/O操作需要**等待外部资源**（文件/网络/数据库响应）就绪，进而CPU就会空闲，空闲下来了，协程就决定**主动释放线程 - 挂起**，让其他任务去使用线程。

   * CPU密集操作**持续消耗CPU计算资源**，CPU不会空闲
