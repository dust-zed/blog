+++
title = 'Jetpack Compose'
description = 'Jetpack Compose 学习笔记：声明式 UI、状态、重组、导航、Modifier 与渲染性能。'
+++

这个分类记录 Jetpack Compose 的学习笔记。Compose 的关键不是“换一种写 UI 的语法”，而是理解声明式 UI、状态驱动、重组和 Modifier 链式模型。

## 推荐阅读顺序

1. **Compose 入门**：建立声明式 UI、State、remember 和重组的基础模型。
2. **Jetpack Compose 渲染揭秘**：理解 Modifier 顺序、布局阶段、绘制阶段和 graphicsLayer 的性能影响。
3. **Compose Navigation 入门**：整理路由、导航图和模块化导航的基本组织方式。

## 整理原则

Compose 笔记优先回答：

1. 状态在哪里产生，在哪里消费；
2. 哪些变化会触发重组；
3. Modifier 顺序为什么影响布局、点击和绘制；
4. 性能问题应该从重组、布局还是绘制阶段定位。
