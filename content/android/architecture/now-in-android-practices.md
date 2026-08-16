+++
title = 'Now in Android：现代 Android 应用架构实践'
date = '2025-11-09T10:45:37+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Architecture', 'NowInAndroid', 'Best Practices']
description = "从 Now in Android 项目中整理现代 Android 架构实践：响应式数据流、模块化、Hilt、Repository、离线优先和构建约定。"
slug = "now-in-android-practices"
+++

Now in Android 不只是一个 Compose 示例，它更像是一份现代 Android 工程样板：UI、数据流、模块化、依赖注入、离线优先和 Gradle 构建组织都能在里面找到参考。

## 核心结论

1. UI 层只消费 `UiState`，用户操作通过事件向上发送。
2. 数据层通过 Repository 屏蔽网络、本地数据库和同步策略。
3. 模块化结构让 feature 与 core 边界清晰，避免功能模块互相依赖。
4. Hilt 负责对象装配，但架构稳定性来自清晰的接口边界。
5. `build-logic` 和 Version Catalog 是大型项目保持构建一致性的关键。

## 响应式架构

Now in Android 的核心心智模型是：

```text
Repository / UseCase
  -> Flow
  -> ViewModel
  -> UiState
  -> Compose UI
```

UI 不主动拉取数据，而是观察状态流。状态变化后，Compose 自动重组对应区域。

值得学习的点：

1. `StateFlow` 暴露稳定的 UI 状态；
2. `combine` 聚合多个数据源；
3. `map` 把领域模型转换为 UI 模型；
4. UI 只负责展示状态和发送事件；
5. 数据流方向稳定，调试路径清晰。

## 模块化结构

典型层次：

```text
:app
:feature:*
:core:*
```

职责划分：

1. `:app` 负责应用入口、导航容器和全局装配；
2. `:feature:*` 负责具体业务页面；
3. `:core:model` 提供基础模型；
4. `:core:data` 提供 Repository 实现；
5. `:core:database`、`:core:network` 分别处理本地和网络数据源。

关键原则：

> feature 模块不要相互依赖，公共能力下沉到 core。

这样可以避免功能之间形成横向耦合，也更利于并行开发和增量构建。

## 依赖注入

Hilt 的价值不是“省掉 new 对象”，而是把对象创建和依赖关系集中管理。

重点理解：

1. `@HiltViewModel`：让 ViewModel 进入 Hilt 图；
2. `@Inject`：声明构造函数依赖；
3. `@Module`：提供无法构造注入的对象；
4. `@Binds`：把接口绑定到实现；
5. `@Provides`：手动创建对象；
6. `@InstallIn`：声明对象所在组件和生命周期。

架构上更重要的是：ViewModel 依赖接口，而不是直接依赖具体数据源。

## 数据层和离线优先

Repository 是数据层的统一入口。它不只是简单转发网络请求，而是负责协调：

1. 本地数据库；
2. 网络接口；
3. 同步策略；
4. 缓存策略；
5. 数据模型转换。

离线优先的基本思路：

```text
UI 优先观察本地数据库
  -> 后台同步网络数据
  -> 写入数据库
  -> 数据库变化自动推动 UI 更新
```

这种结构的优点是：UI 响应快，弱网下仍有可用数据，数据来源也更稳定。

## 构建组织

Now in Android 里值得重点学习 `build-logic` 和 `libs.versions.toml`。

`build-logic` 解决重复 Gradle 配置：

1. Android application/library 公共配置；
2. Kotlin 编译配置；
3. Compose 配置；
4. Hilt 配置；
5. 测试配置。

Version Catalog 解决依赖版本集中管理，让多模块项目不用到处硬编码版本号。

## 回看清单

1. 现代 Android 架构重点是稳定数据流和清晰模块边界。
2. Compose 只是 UI 表达方式，真正的复杂度在状态和数据层。
3. Repository 应该屏蔽数据源细节。
4. feature 模块不要互相依赖。
5. 构建逻辑也需要架构设计，不能只堆在每个模块脚本里。
