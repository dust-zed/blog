+++
title = 'Native'
description = 'Android Native 集成笔记：NDK、JNI、Rust、cargo-ndk、UniFFI、FFI 边界和跨平台核心逻辑。'
+++

这个分类记录 Android Native 与 Rust 混合开发。整理重点不是“为了使用 Rust 而使用 Rust”，而是思考哪些逻辑适合沉到跨平台核心层，哪些逻辑应该留在 Kotlin/Android 平台层。

## 推荐阅读顺序

1. **Android Rust 混合开发入门**：先理解 NDK、JNI、`.so`、ABI 和交叉编译的基本概念。
2. **Rust JNI 配置**：补齐本地环境、cargo-ndk 和 NDK 路径配置。
3. **UniFFI 实战手册**：理解如何用接口定义生成 Kotlin 绑定，减少手写 JNI 的成本。
4. **Clean Architecture + Rust 实战**：从架构角度思考 Kotlin UI 与 Rust Core 的职责边界。

## 整理原则

Native 笔记优先关注边界：

1. 类型如何跨语言传递；
2. 错误如何表达；
3. 生命周期和线程由谁负责；
4. Rust Core 是否真的降低了复杂度，而不是制造新的集成成本。
