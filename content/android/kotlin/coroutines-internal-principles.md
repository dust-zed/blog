+++
title = 'Kotlin 协程原理：Continuation、状态机与挂起恢复'
date = '2025-06-30T15:13:25+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Kotlin', 'Coroutines', 'Internal']
description = "整理 Kotlin 协程底层原理：挂起函数如何被编译成状态机，Continuation 如何保存现场，调度器如何恢复执行。"
slug = "coroutines-internal-principles"
+++

协程看起来像同步代码，但底层依然有明确的转换规则。编译器会把挂起函数改写成状态机，并通过 `Continuation` 保存“下一步要从哪里继续执行”。

## 核心结论

1. `suspend` 函数会被编译器改写，额外接收一个 `Continuation`。
2. 挂起点会把函数拆成多个状态。
3. 局部变量会被保存到状态机对象里，恢复时继续使用。
4. 挂起不会阻塞线程，只是当前协程把执行权交出去。
5. 恢复执行本质是调用 `Continuation.resumeWith()`。

## CPS 变换

挂起函数：

```kotlin
suspend fun load(): User {
    val token = getToken()
    return getUser(token)
}
```

可以粗略理解成编译器改写为：

```kotlin
fun load(continuation: Continuation<User>): Any?
```

这种把“后续要执行的逻辑”显式传入函数的方式，叫 CPS：Continuation Passing Style。

## Continuation

`Continuation` 可以理解为“恢复执行的入口”。

核心方法：

```kotlin
interface Continuation<in T> {
    val context: CoroutineContext
    fun resumeWith(result: Result<T>)
}
```

它保存两类信息：

1. 协程上下文，例如 Dispatcher、Job；
2. 恢复执行所需的状态机。

## 状态机

假设有两个挂起点：

```kotlin
suspend fun fetch() {
    val a = requestA()
    val b = requestB(a)
    render(b)
}
```

编译器会把它拆成类似状态：

```text
state 0: 调用 requestA()
state 1: requestA 返回后，调用 requestB(a)
state 2: requestB 返回后，调用 render(b)
```

伪代码：

```kotlin
when (label) {
    0 -> {
        label = 1
        val result = requestA(this)
        if (result == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
    }
    1 -> {
        val a = result
        label = 2
        val result = requestB(a, this)
        if (result == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
    }
    2 -> {
        val b = result
        render(b)
    }
}
```

真实代码更复杂，但核心就是：用 `label` 记录执行到哪一步。

## 挂起不阻塞线程

挂起时发生的是：

```text
当前协程保存状态
  -> 返回 COROUTINE_SUSPENDED
  -> 当前线程可以去执行其他任务
  -> 异步结果回来
  -> resumeWith()
  -> 从对应状态继续执行
```

所以挂起不是让线程睡眠，而是协程暂停，线程释放。

## CoroutineContext

`CoroutineContext` 是协程运行环境的集合。

常见元素：

1. `Job`：控制生命周期和取消；
2. `CoroutineDispatcher`：决定在哪个线程或线程池执行；
3. `CoroutineName`：调试用名称；
4. `CoroutineExceptionHandler`：异常处理。

调度器决定恢复时在哪执行：

```kotlin
withContext(Dispatchers.IO) {
    readFile()
}
```

这里不是把线程“切过去”，而是把后续执行调度到 IO dispatcher。

## 结构化并发的底层意义

结构化并发把协程组织成父子关系：

```text
Parent Job
├── Child Job A
└── Child Job B
```

好处：

1. 父任务取消时，子任务一起取消；
2. 子任务失败可以向父任务传播；
3. 生命周期边界清楚；
4. 不容易留下后台孤儿任务。

## 回看清单

1. 协程底层是状态机 + Continuation。
2. `suspend` 函数会被编译器改写，不是普通函数直接暂停。
3. 挂起保存现场，恢复调用 `resumeWith()`。
4. 线程没有被挂起，协程让出执行权。
5. Dispatcher 决定恢复在哪执行，Job 决定生命周期。
