+++
title = 'Framework'
description = 'Android Framework 学习笔记：消息机制、同步屏障、Choreographer、启动流程、事件分发、Surface、四大组件与窗口适配。'
+++

这个分类用来整理 Android Framework 的核心运行机制。重点是建立系统模型：线程如何被调度，消息如何流动，事件如何分发，窗口和渲染表面如何协作。

## 推荐阅读顺序

1. **Android Handler 消息机制**：先理解 Looper、MessageQueue、Handler 的职责边界。
2. **Handler 同步屏障与 Choreographer**：把消息机制和一帧渲染调度连起来。
3. **Choreographer 类解析**：理解一帧如何被 VSYNC 驱动和调度。
4. **Android App 启动流程**：从 Launcher、AMS、Zygote 到 ActivityThread 梳理启动链路。
5. **Android 事件分发机制详解**：理解触摸事件如何从 Activity 传递到 View。
6. **Android 四大组件**：整理应用组件的生命周期和系统交互方式。
7. **Surface 体系指南**：从设计层 Surface 到底层 SurfaceView/TextureView。
8. **Window Insets 指南**：理解沉浸式、系统栏、键盘和安全区域适配。
9. **Android 主题系统指南**：整理 Material 3、Dynamic Color、深色模式和主题层级。

## 整理原则

Framework 笔记尽量避免只背结论，而是把调用链、关键对象和线程边界讲清楚。能画流程时优先画流程，能总结心智模型时优先总结模型。
