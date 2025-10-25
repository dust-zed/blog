+++
date = '2025-10-25T16:01:56+08:00'
draft = true
title = 'Compose Navigation入门'
categories = ['android-develop']

+++

#### 1. 核心组件

Compose Navigation 主要有三个核心概念：

* `NavController`：导航控制器。它是整个导航的中枢，负责执行导航操纵(`navigate`)、管理返回栈（Back Stack）等。它通常在最高层级创建并向下传递。
* `NavGraph`：可以理解为一张“导航地图”。它定义了所有可以到达的目标（屏幕），以及它们之间的关系。在代码中，我们通过一个 `NavHost`Composable来承载这张地图。
* `Route`：每个目标的唯一地址。在传统的 Navigation 中，这通常是一个 Int 类型的 ID。但在 Compose Navigation 中，它是一个字符串，而在 "Now in Android" 这个项目中，它被进一步封装成了类型安全的对象。

#### 2. Navigation的常规

##### a. 定义路由

```kotlin
@Serializable
data object ForYouRoute // route to ForYou screen
```

##### b. 定义导航动作

```kotlin
fun NavController.navigateToForYou(navOptions: NavOptions) = navigate(route = ForYouRoute, navOptions)
```

##### c. 定义导航图的一部份

```kotlin
fun NavGraphBuilder.forYouSection(
    onTopicClick: (String) -> Unit,
    topicDestination: NavGraphBuilder.() -> Unit,
) {
    navigation<ForYouBaseRoute>(startDestination = ForYouRoute) {
        composable<ForYouRoute>(...) {
            ForYouScreen(onTopicClick)
        }
        topicDestination()
    }
}
```

这是模块化导航的精髓所在。这个函数的作用是“在总的导航地图上，画出属于 ForYou 功能的所有路线”。

* `NavGraphBuilder.forYouSection`: 它是一个对 `NavGraphBuilder` 的扩展函数。这意味着，在构建总的 NavGraph 时，可以直接调用这个函数来添加一整个功能模块的导航配置。主 `NavGraph` 无需关心 `ForYou` 模块内部有多少个页面。
* `navigation<...>(...)`: 这创建了一个嵌套的导航图 (**Nested Graph**)。它将所有与 "For You" 相关的页面（这里只有一个 `ForYouScreen`，但将来可能更多）组织在了一起，形成一个独立的子图。
* `composable<ForYouRoute>(...) { ForYouScreen(...) }`: 这是最核心的绑定。它告诉 `NavController`：“当导航到 `ForYouRoute` 这个地址时，请显示 `ForYouScreen` 这个 `Composable` 界面。”

##### 结构

```
NavHost (整个 App 的导航地图)
│
├── ... (其他模块的导航图)
│
└── navigation<ForYouBaseRoute> (子图的入口，ID 是 ForYouBaseRoute)
    │
    ├── startDestination = ForYouRoute (子图的默认页面)
    │   │
    │   └── composable<ForYouRoute> -> ForYouScreen (这就是默认页面)
    │
    └── topicDestination() (另一个页面/子图，被外部注入进来)
        │
        └── ...
```

