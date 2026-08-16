+++
date = '2025-10-25T19:52:44+08:00'
draft = false
title = 'Jetpack Compose 入门：声明式 UI、State 与重组'
categories = ['android']
tags = ['Compose', 'Jetpack', 'UI']
description = "整理 Jetpack Compose 的基础心智模型：声明式 UI、组合、重组、State、remember、状态提升和智能跳过。"
slug = "compose-basics"
+++

Compose 不是把 XML 换成 Kotlin，而是把 UI 从“命令式更新 View”换成“状态驱动界面”。理解 State 和重组之后，Compose 的很多 API 才会变得顺。

## 核心结论

1. Composable 函数描述某个状态下 UI 应该长什么样。
2. State 变化会触发读取它的 Composable 重组。
3. `remember` 负责在重组之间保存对象。
4. 状态应该尽量上提，让无状态 Composable 更容易复用和测试。
5. 重组不是重建整个屏幕，Compose 会尽量跳过输入未变化的部分。

## 声明式 UI

传统 View 更像这样：

```kotlin
textView.text = user.name
button.isEnabled = user.isValid
```

Compose 更像这样：

```kotlin
@Composable
fun UserCard(user: User) {
    Text(text = user.name)
    Button(enabled = user.isValid, onClick = {}) {
        Text("Submit")
    }
}
```

你不再手动寻找某个 View 并修改它，而是声明：在当前状态下，UI 应该是什么样。

## 组合与重组

**组合**是第一次执行 Composable，生成 UI 树。

**重组**是状态变化后，Compose 再次执行受影响的 Composable，让 UI 和新状态保持一致。

关键点：

1. 重组可能频繁发生；
2. Composable 应该保持轻量；
3. 不要在 Composable 函数体里直接执行不可控副作用；
4. 可以被重复调用的代码才适合放在 Composable 里。

## State 和 remember

State 的作用是通知 Compose：值变了，需要更新 UI。

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }

    Button(onClick = { count++ }) {
        Text("count = $count")
    }
}
```

这里有两个角色：

1. `remember`：让 `count` 在多次重组之间保留下来；
2. `mutableStateOf`：让 `count` 变化时触发重组。

如果没有 `remember`，每次重组都会重新创建状态。

## 状态提升

当一个 Composable 同时负责保存状态和展示 UI 时，它会比较难复用。

更推荐拆成：

```kotlin
@Composable
fun CounterScreen() {
    var count by remember { mutableStateOf(0) }
    CounterContent(
        count = count,
        onIncrease = { count++ }
    )
}

@Composable
fun CounterContent(
    count: Int,
    onIncrease: () -> Unit,
) {
    Button(onClick = onIncrease) {
        Text("count = $count")
    }
}
```

`CounterScreen` 管状态，`CounterContent` 只负责展示和发事件。

## 重组触发

重组常见来源：

1. Composable 读取的 `State` 发生变化；
2. 父 Composable 重组，并传入了新参数；
3. `Flow/LiveData` 被转换成 Compose State 后发出新值。

典型链路：

```text
ViewModel StateFlow 发出新值
  -> collectAsStateWithLifecycle()
  -> Compose State 更新
  -> 读取该 State 的 Composable 重组
  -> 子 Composable 根据参数变化决定是否重组
```

## 智能跳过

Compose 会尝试跳过输入没有变化的 Composable。

更容易被跳过的参数：

1. 基本类型；
2. `String`；
3. 稳定的函数引用；
4. `@Stable` / `@Immutable` 类型；
5. Compose 内置稳定类型。

需要避免：

1. 每次重组都创建新的复杂对象；
2. 在参数里传不稳定集合；
3. 把过大的状态对象直接传到很深层级。

## 回看清单

1. Compose 用状态描述 UI，而不是手动更新 View。
2. `remember` 保存对象，`State` 触发重组。
3. 状态尽量上提，UI 组件尽量无状态。
4. 副作用用 `LaunchedEffect`、`DisposableEffect` 等 API 管理。
5. 性能问题先判断是重组、布局还是绘制阶段。
