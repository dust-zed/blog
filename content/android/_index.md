+++
title = 'Android'
description = 'Android 学习笔记：应用架构、Framework 原理、UI/Compose、性能优化、Kotlin、构建、Native 集成与问题排查。'
+++

这里整理 Android 相关的学习笔记，目标不是写成零散教程，而是把自己在项目、源码阅读和问题排查中形成的理解沉淀下来。

我希望每篇文章都能回答三个问题：

1. 这个知识点解决什么问题？
2. 它背后的核心模型是什么？
3. 实际开发时应该如何判断和取舍？

## 阅读路径

### Framework

适合用来建立 Android 系统运行模型，包括消息机制、同步屏障、Choreographer、启动流程、事件分发、窗口适配、Surface、四大组件等。

建议先读：

1. Handler 消息机制
2. Handler、同步屏障与 Choreographer
3. Choreographer 类解析
4. Android App 启动流程
5. 事件分发机制
6. 四大组件

### 性能优化

围绕渲染、内存、包体积、RecyclerView 等常见性能问题整理。重点不是罗列优化项，而是理解性能问题发生在哪个阶段。

建议先读：

1. View 性能优化
2. RecyclerView 缓存机制
3. 内存管理最佳实践
4. 包体积优化

### 应用架构

记录项目组织、状态管理、数据存储和架构演进。重点关注“为什么这么组织代码”，而不是只给出模板。

建议先读：

1. Android 项目组织结构
2. 从 MVVM 到 MVI
3. Now in Android 实践
4. MMKV 与 SharedPreferences

### Jetpack Compose

整理 Compose 的基础模型、重组机制、导航和渲染性能。优先从状态、重组和 Modifier 的执行模型入手。

### Kotlin

主要记录 Kotlin 协程及其底层原理，包括挂起函数、Continuation、CoroutineScope、async/await 等。

### Build

整理 Gradle、Convention Plugins、APK 打包流程等构建链路知识，帮助把“能跑”变成“可维护”。

### Native

记录 Android 与 Rust 混合开发，包括 JNI、cargo-ndk、UniFFI、Clean Architecture 与跨平台核心逻辑沉淀。

### Troubleshooting

记录实际项目中的问题排查过程。每篇复盘都尽量保留：现象、定位路径、根因、修复方案和防复发经验。
