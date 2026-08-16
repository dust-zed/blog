+++
title = 'Build'
description = 'Android 构建笔记：Gradle、Convention Plugins、APK 打包流程、版本目录与多模块构建组织。'
+++

这个分类整理 Android 构建工具和工程基础设施。目标是把“项目能跑起来”进一步整理成“项目能长期维护”。

## 推荐阅读顺序

1. **Gradle 相关知识**：理解插件、库、依赖配置、Version Catalog 等基础概念。
2. **Gradle 构建组织方式 Convention Plugins**：学习如何把重复构建逻辑收敛到可复用插件中。
3. **Android 打包 APK 流程**：补上从源码、资源、DEX、签名到 APK 的构建链路认知。

## 整理原则

构建笔记优先关注：

1. 配置项解决什么问题；
2. 它对多模块项目有什么影响；
3. 哪些配置适合放到公共构建逻辑；
4. 出错时如何定位是 Gradle、AGP、Kotlin、依赖还是签名/打包流程的问题。
