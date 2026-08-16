+++
date = '2025-10-25T16:01:56+08:00'
draft = false
title = 'Compose Navigation 入门：路由、NavHost 与模块化导航'
categories = ['android']
tags = ['Compose', 'Navigation', 'Jetpack']
description = "整理 Compose Navigation 的核心模型：NavController、NavHost、Route、嵌套导航图、类型安全路由和模块化导航组织。"
slug = "compose-navigation"
+++

Compose Navigation 的重点不是“怎么跳页面”，而是如何把页面地址、返回栈、参数和模块边界组织清楚。页面少时可以直接写在一个 `NavHost` 里，页面多时就需要模块化导航。

## 核心结论

1. `NavController` 负责执行导航和维护返回栈。
2. `NavHost` 承载导航图，把 route 映射到 Composable。
3. route 是页面地址，建议统一封装，不要散落字符串。
4. feature 模块可以通过扩展函数向主导航图注册自己的页面。
5. 复杂页面参数要谨慎传递，优先传 ID，再由目标页加载数据。

## 核心组件

| 组件 | 职责 |
| --- | --- |
| `NavController` | 导航控制器，负责 `navigate()`、`popBackStack()` 和返回栈 |
| `NavHost` | 导航容器，根据当前 route 显示目标 Composable |
| `NavGraph` | 导航图，描述页面和页面之间的关系 |
| `Route` | 目标页面地址 |

基础结构：

```kotlin
@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController(),
) {
    NavHost(
        navController = navController,
        startDestination = "home",
    ) {
        composable("home") {
            HomeScreen(
                onOpenDetail = { id ->
                    navController.navigate("detail/$id")
                }
            )
        }

        composable("detail/{id}") { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id")
            DetailScreen(id = id)
        }
    }
}
```

## 路由封装

不要在项目里到处写字符串 route。更稳的方式是集中定义：

```kotlin
object HomeRoute {
    const val route = "home"
}

object DetailRoute {
    const val route = "detail/{id}"

    fun create(id: String): String = "detail/$id"
}
```

使用：

```kotlin
navController.navigate(DetailRoute.create(id))
```

如果项目使用 Navigation 的类型安全路由能力，也可以用序列化对象表达 route：

```kotlin
@Serializable
data object ForYouRoute
```

## 模块化导航

大型项目里，主导航图不应该知道每个 feature 内部的页面细节。可以让 feature 暴露一个注册函数：

```kotlin
fun NavGraphBuilder.forYouSection(
    onTopicClick: (String) -> Unit,
) {
    navigation(
        startDestination = "for-you/feed",
        route = "for-you",
    ) {
        composable("for-you/feed") {
            ForYouScreen(onTopicClick = onTopicClick)
        }
    }
}
```

主工程只负责装配：

```kotlin
NavHost(
    navController = navController,
    startDestination = "for-you",
) {
    forYouSection(
        onTopicClick = { id ->
            navController.navigate("topic/$id")
        }
    )
}
```

这样 feature 可以维护自己的子图，主导航只处理跨模块跳转。

## 参数传递原则

推荐：

1. route 里传轻量 ID；
2. 目标页面通过 ViewModel 根据 ID 加载数据；
3. 复杂对象放在共享数据层或持久化层；
4. 避免把大型 JSON 直接塞进 route。

原因：

1. route 本质是地址，不适合承载大对象；
2. 进程重建后，参数越简单越容易恢复；
3. 页面之间传复杂对象会增加耦合。

## 返回栈

常用操作：

```kotlin
navController.navigate("detail/$id")
navController.popBackStack()
```

底部 Tab 场景通常需要：

1. 保存每个 Tab 的状态；
2. 避免重复创建同一个目的地；
3. 回到根目的地时恢复状态。

示例思路：

```kotlin
navController.navigate(tab.route) {
    popUpTo(navController.graph.startDestinationId) {
        saveState = true
    }
    launchSingleTop = true
    restoreState = true
}
```

## 回看清单

1. `NavController` 管行为，`NavHost` 管展示，route 管地址。
2. route 不要散落字符串，最好集中封装。
3. feature 模块通过 `NavGraphBuilder` 扩展函数注册自己的导航图。
4. 页面参数优先传 ID，不传复杂对象。
5. 底部 Tab 要关注返回栈复用和状态恢复。
