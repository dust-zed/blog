+++
title = "从 MVVM 到 MVI：架构的「意图驱动」演进"
date = 2026-01-02T21:00:00+08:00
draft = false
categories = ["Android", "Architecture"]
tags = ["MVI", "Clean Architecture", "Kotlin Flow", "Unidirectional Data Flow"]
description = "深度解析在云游戏客户端开发中，如何从 MVVM 迁移到 MVI 架构，以及「消费者驱动」设计哲学带来的开发范式转变。"
+++

在云游戏客户端的开发初期，我们采用了经典的 **MVVM (Model-View-ViewModel)** 架构。然而，随着业务复杂度的指数级上升——虚拟手柄状态、WebRTC 信令状态、视频流媒体状态、网络质量监控等多数据源的交织，MVVM 逐渐显露出疲态。

State 分散在多个 `LiveData/StateFlow` 中，View 层充斥着各种状态的监听和组合逻辑，"状态"变得难以追踪和预测。这促使我们向 **MVI (Model-View-Intent)** 架构迈出了关键的一步。

## 1. 核心概念：心智模型的重构

MVI 并不仅仅是一个新的架构缩写，它本质上是一种**心智模型 (Mental Model)** 的重构。我们将 UI 交互抽象为一种 **"请求-响应" (Request-Response)** 机制。

### Intent ≈ Request (意图即请求)

在 MVVM 中，View 直接调用 ViewModel 的方法（例如 `vm.playGame()`）。而在 MVI 中，我们将这些操作封装为 **Intent** 数据结构。View 不再发号施令，而是**表达意图**。

```kotlin
// 定义用户意图
sealed class GameIntent {
    data object Start : GameIntent()
    data object Pause : GameIntent()
    data class ChangeQuality(val quality: VideoQuality) : GameIntent()
    data class TouchEvent(val x: Float, val y: Float) : GameIntent()
}

// ViewModel 处理意图
fun dispatch(intent: GameIntent) {
    when (intent) {
        is GameIntent.Start -> handleStart()
        is GameIntent.ChangeQuality -> updateStreamQuality(intent.quality)
        // ...
    }
}
```

### State ≈ Response (状态即响应)

ViewModel 经过处理后，不是分散地更新变量，而是发射一个新的、不可变的 **State** 对象。这就像服务器返回了一个完整的 HTML/JSON 响应。

```kotlin
// 定义单一状态源 (Single Source of Truth)
data class GameUiState(
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val streamQuality: VideoQuality = VideoQuality.H720P,
    val debugInfo: String = "",
    val error: Throwable? = null
)
```

这种 `Intent -> ViewModel -> State` 的单向数据流 (Unidirectional Data Flow)，使得数据的流向清晰可追溯，极大地降低了调试难度。

## 2. SideEffect：处理那些"一次性"的烦恼

在 Android 开发中，一个经典的问题是：**"屏幕旋转后，Toast 重复弹出"**。
这是因为 Toast 消息往往被包含在 State 中，View 重建后重新订阅 State，再次收到了包含旧错误信息的 State。

MVI 引入了 **SideEffect (副作用)** 概念来解决这个问题。SideEffect 专门用于处理**一次性事件**，如弹 Toast、页面导航、播放音效等。

我们通常使用 Channel 来实现 SideEffect，因为 Channel 具有"热流"且"消费后即消失"的特性。

```kotlin
sealed class GameSideEffect {
    data class ShowToast(val message: String) : GameSideEffect()
    data object NavigateToHome : GameSideEffect()
}

// ViewModel
private val _effect = Channel<GameSideEffect>(Channel.BUFFERED)
val effect = _effect.receiveAsFlow()

// 发送副作用
viewModelScope.launch {
    _effect.send(GameSideEffect.ShowToast("连接断开"))
}

// UI 层消费
LaunchedEffect(Unit) {
    viewModel.effect.collect { effect ->
        when (effect) {
            is GameSideEffect.ShowToast -> Toast.makeText(context, effect.message, ...).show()
        }
    }
}
```

这彻底解决了 MVVM 中 LiveData 倒灌 ("Sticky Event") 的老大难问题。

## 3. 消费者驱动设计 (Consumer-Driven Design)

在重构过程中，我深刻体会到了 **Consumer-Driven Design** 的威力。这是一种**反直觉**的开发哲学。

### 错误姿势：从底向上
传统的开发往往是：
1.  先看底层 SDK 提供了什么 API。
2.  写 Repository 封装 SDK。
3.  写 ViewModel 调用 Repository。
4.  写 UI 适配 ViewModel。

这种方式导致 UI 层总是受制于底层的实现细节，代码充满了胶水逻辑。

### 正确姿势：从顶向下
Consumer-Driven 主张：
1.  **先写业务层 (Activity/ViewModel)**：假装有一个完美的底层引擎接口。
2.  **设计最爽的调用方式**：根据 UI 的交互需求，定义出最自然、最符合业务语义的 `Intent` 和 `State`。
3.  **倒逼底层实现**：再去写 Repository 和 Engine 层，去实现这个"完美的接口"。

例如，在云游戏场景中，我们需要一个"切换码率"的功能。
我先在 ViewModel 中写下：
```kotlin
engine.setBitrate(5000) // 假设接口是这样，简单明了
```
然后再去底层实现这个 `setBitrate`。如果发现底层 SDK 需要复杂的协商流程（暂停流 -> 发送重协商信令 -> 等待响应 -> 恢复流），我就在 Repository 层把这些脏活累活封装掉，**绝不让这些实现细节泄露到 ViewModel 层**。

这种"假装编程"的方法，确保了上层代码的纯净和高可读性，让架构真正服务于业务，而不是服务于底层库。

## 总结

从 MVVM 到 MVI，不仅是架构的升级，更是思维方式的转变。
*   **Intent** 让我们关注"用户想做什么"，而不是"如何操作对象"。
*   **State** 让我们关注"当前是什么样子"，而不是"哪些变量变了"。
*   **Consumer-Driven** 让我们关注"业务需要什么"，而不是"底层提供了什么"。

这套组合拳，成为了驾驭云游戏这种高复杂度客户端应用的坚实基石。