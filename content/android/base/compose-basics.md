+++
date = '2025-10-25T19:52:44+08:00'
draft = false
title = 'Compose入门'
categories = ['android']
tags = ['Compose', 'Jetpack', 'UI']
description = "Jetpack Compose 入门指南：核心概念、组合与重组、状态管理 (State & remember)。"
slug = "compose-basics"
image = ""

+++

## 大纲

1. **声明式UI**：只需要描述在特定状态下UI应该是什么样子，Compose框架会负责更新。
2. **组合与复用**：将UI拆分成小而专一的Composable函数，然后像搭积木一样组合它们。
3. **单向数据流**：状态从`ViewModel`向下流动到Composable，事件从Composable向上传递给`ViewModel`。
4. **副作用处理**：使用`LaunchedEffect`等API来安全地处理需要在Composable生命周期内执行的**非UI**操作。

## 核心概念

### 组合与重组

* **组合(Composition)**：这是Compose第一次构建UI的过程。当你调用一个Composable函数时，Compose框架会执行它，把它描述的UI元素（如`Text`,`Button`,`Box`等）添加到UI树中。这个过程只会发生一次。
* **重组(Recomposition)**：这是Compose更新UI的过程。当一个Composable函数所依赖的数据发生变化时，Compose不会重新构建整个屏幕，而是智能地、有选择性地再次调用这个Composable函数（以及其他依赖了相同数据的函数），用新的数据来更新UI树中对应的部分。这个过程可能发生多次，甚至非常频繁。

**核心思想**：你只需要用代码声明在某个数据状态下，你的UI应该长什么样。当数据变化时，Compose框架会自动帮你完成从旧UI到新UI的转换，不需要手动去查找并更新某个`TextView`或`ImageView`。

### 状态（State）

在Compose中，**State**就是任何会随时间变化并且会影响**UI**的值。

* `State<T>`和`MutableState<T>`

### remember

在多次重组之间保持Composable内部状态或对象的关键机制。没有它，每次重组都会导致局部变量被重置。

* `remember`的作用是让一个对象（任何对象）在多次重组之间活下来。
* `State`的作用是当它的值改变时，通知Compose进行重组。

remember和State是一对黄金搭档，共同解决了“UI内部状态”的问题：

1. 我需要一个变量来存储UI的状态(例如，一个计数器，一个复选框是否被选中)。
2. 这个变量必须能在多次重组中保持他的值不被重置 -> 所以用`remember`。
3. 当这个变量的值改变时，UI必须自动更新（即重组）-> 所以用`State`。

* `remember`是为了“记忆”：让变量/对象在重组中幸存。
* `State`是为了“通知”：让值的变化能触发重组。

## 重组触发机制

### 1. 基于State的订阅式重组（State-Read-based-Recomposition）

* **注册/订阅**：当一个Composable函数在执行过程中读取(Read)了一个`State`对象的值，Compose就会在这个函数和这个`State`对象之间建立一个隐藏的订阅关系。
* **变化通知**：当这个`State`对象的值被写入(write)一个新值时，它会像一个发布者一样，通知所有订阅了它的Composable: “我的值变了!”
* **精确重组**：收到通知的Composable会标记为“需要重组”，Compose会在下一帧高效地更新它们。

**优点**：非常精确和高效。只有直接读取了这个State的Composable才会被重组。

### 2. 基于“函数调用与参数变化”的重组（Function-Call-with-Parameter-Change Recomposition）

当一个父Composable发生重组时，它会重新执行其函数体内的代码。如果函数体内包含了对子Composable的调用（比如`Greeting(name)`），那么Compose就会执行一次“前置检查”：

1. 参数比较：Compose会比较这次调用`Greeting`时传入的参数(`name`)和上一次调用时传入的参数。
2. 决策：
   * 如果参数没有变化，Compose就会跳过(**Skip**)`Greeting`函数的执行，直接复用上次的结果。
   * 如果参数发生了变化，Compose就会执行`Greeting`函数，用新的参数来生成新的UI。这个执行过程，就是子Composable的重组。

```kotlin
// ... 在有状态的 ForYouScreen 中
// 机制 1 的开始：订阅 StateFlow，转换为 State
val feedState by viewModel.feedState.collectAsStateWithLifecycle()

// 机制 2 的开始：因为 feedState 变了，所以再次调用无状态的 ForYouScreen
ForYouScreen(
    feedState = feedState, // <--- 参数发生变化
    ...
)
```

1. `ViewModel` 中的 `StateFlow` 发出了一个新值。
2. `collectAsStateWithLifecycle()` 将其转换为一个 `State` 对象，并更新了这个 `State` 的值。(机制 1 触发)
3. 因为有状态的 `ForYouScreen` 读取了这个 `State`，所以它被安排重组。
4. 有状态的 `ForYouScreen` 重新执行，当它调用无状态的 `ForYouScreen` 时，传入的 `feedState` 参数是一个全新的值。(机制 2 触发)
5. 无状态的 `ForYouScreen` 检测到 `feedState` 参数变化，因此它也必须重组，并根据新的 `feedState` 更新其内部的 UI。

### 补充：智能重组(Smart Recomposition)

Compose能够跳过(**Skip**)那些输入参数没有变化的Composable函数的执行。

这套机制，我们通常称之为智能重组(**Smart Recomposition**)。它依赖两个基本原则：

1. 位置记忆：Compose不靠函数名，而是靠Composable在UI树中的“位置”来识别它。在重组时，它知道上次在同一个位置的是哪个函数。
2. 输入参数稳定性：在重组时，Compose会比较一个Composable上一次调用时的输入参数和这一次调用的输入参数。如果所有参数都没有变化，Compose就会完全跳过这个函数的执行，直接复用它上次生成的UI。

**什么是“稳定的”(Stable)参数**

Compose的这个Skip机制依赖于能够可靠地判断参数是否“相等”。对于以下类型的参数，Compose认为它们是稳定的：

* 基本类型：`Int`,`Float`,`Boolean`,`String`等。Compose可以轻易地通过`==`来判断它们是否相等。
* 函数类型：例如`()-> Unit`。只要他们不是在每次重组时都创建一个新的lambda实例，它们就是稳定的
* 被`@Stable`或`@Immutable`注解的类：`data class`默认是稳定的，因为它的`equals`是基于所有属性的。你可以使用这些注解告诉Compose你的类是稳定的。即使它不是`data class`。
* Compose的内置类型：如`Modifier`。

`Stable`参数意味着Compose可以安全的通过比较（通常是`equals`）来确定它是否发生了变化，从而决定是否Skip使用它的Composable重组。
