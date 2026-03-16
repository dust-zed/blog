+++
title = "UniFFI 跨平台开发"
date = "2026-03-13T10:00:00+08:00"
draft = false
description = "UniFFI 实现 Rust 与 Kotlin/Swift 的跨语言绑定，以 Rust 为核心构建跨平台应用。"
slug = "uniffi"
+++

UniFFI（Uniform FFI）是 Mozilla 开发的跨语言绑定工具，用于在 Rust 与 Kotlin/Swift/Python 之间生成 FFI 绑定代码。

本系列聚焦于 **KMP + Rust + UniFFI** 的实战开发：

- 以 Rust 为核心业务层
- 通过 UniFFI 自动生成 Kotlin/Swift 绑定
- 支持 Android、iOS、JVM Desktop 多平台

## 推荐阅读顺序

1. [KMP + Rust + UniFFI 环境搭建指南](/p/kmp-rust-uniffi-setup) - 从零开始搭建全自动化开发环境

## 相关内容

- [UniFFI 条件编译：零成本模型共享](/p/rust-ffi-conditional-compilation)
- [Android Rust 混合开发入门](/p/android-rust-integration-intro)
