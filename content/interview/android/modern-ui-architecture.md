+++
title = '现代 UI 架构'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Compose', 'MVI', 'Architecture', 'State']
description = "深入理解现代 Android UI 架构：Compose 原理、MVI 模式与状态管理最佳实践。"
slug = "android-modern-ui-architecture"
+++

## 核心问题

**Compose 是如何实现"声明式 UI"的？**

理解这个问题，就理解了现代 Android UI 架构的核心。

---

## 知识脉络

### 第一层：命令式 vs 声明式

#### 命令式（传统 View）

```kotlin
// 描述"怎么做"
textView.text = "Hello"
textView.visibility = if (loading) View.GONE else View.VISIBLE
button.setOnClickListener { textView.text = "Clicked" }
```

问题：状态分散，难以追踪变化来源。

#### 声明式（Compose）

```kotlin
// 描述"是什么"
@Composable
fun Greeting(loading: Boolean, onClick: () -> Unit) {
    Column {
        if (!loading) Text("Hello")
        Button(onClick = onClick) { Text("Click") }
    }
}
```

**UI = f(State)**：给定相同状态，UI 必定相同。

---

### 第二层：Compose 核心原理

#### 重组 (Recomposition)

当状态变化时，Compose 重新执行 Composable 函数。

**智能跳过**：如果参数是 Stable 且未变，跳过重组。

```kotlin
@Composable
fun Item(name: String) {
    // name 未变时跳过
    Text(name)
}

@Stable
data class User(val id: Int, val name: String)
```

#### Composition / Layout / Drawing

```
Composition → Layout → Drawing
    ↓           ↓         ↓
 生成树     测量布局    渲染
```

---

### 第三层：MVI 架构

#### 核心概念

```
Intent (用户动作) → Reducer (状态处理) → State (新状态) → View (UI 更新)
                        ↑
                    单向数据流
```

#### 示例

```kotlin
// State
data class UiState(
    val items: List<Item>,
    val loading: Boolean,
    val error: String?
)

// Intent
sealed interface Intent {
    data object Load : Intent()
    data class Delete(val id: Int) : Intent()
}

// ViewModel
class MyViewModel : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state = _state.asStateFlow()

    fun handleIntent(intent: Intent) {
        when (intent) {
            is Intent.Load -> load()
            is Intent.Delete -> delete(intent.id)
        }
    }
}
```

#### 一次性事件处理

```kotlin
// 使用 Channel 处理 Effect
private val _effect = Channel<Effect>()
val effect = _effect.receiveAsFlow()

// UI 收集
LaunchedEffect(Unit) {
    viewModel.effect.collect { effect ->
        when (effect) {
            is Effect.ShowToast -> { }
            is Effect.Navigate -> { }
        }
    }
}
```

---

## 面试高频点

### Q1: Compose 重组性能如何优化？

```kotlin
// 1. 使用 remember 缓存计算结果
val filtered = remember(items) { items.filter { it.active } }

// 2. 使用 derivedStateOf 避免重复计算
val filtered by remember { derivedStateOf { items.filter { it.active } } }

// 3. 使用 key 标识列表项
LazyColumn {
    items(items, key = { it.id }) { item ->
        Item(item)
    }
}
```

### Q2: List 参数为什么会导致重组？

List 接口可能是 MutableList，被 Compose 视为 Unstable。

解决：使用 `@Immutable` 包装或转 `toList()`。

### Q3: MVI vs MVVM？

| 维度 | MVVM | MVI |
|------|------|-----|
| 状态 | 分散（多个 LiveData） | 集中（单一 State） |
| 可测试 | 较好 | 更好 |
| 复杂度 | 低 | 高 |
| 适用 | 简单页面 | 复杂状态 |

---

## 知识关联

- [异步编程](async-programming.md)：StateFlow/SharedFlow 原理
- [渲染系统](rendering-system.md)：Compose 渲染原理
