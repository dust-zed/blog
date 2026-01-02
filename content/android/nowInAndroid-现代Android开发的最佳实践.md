+++
date = '2025-11-09T10:45:37+08:00'
draft = true
title = 'NowInAndroid 现代Android开发的最佳实践'
categories = ['android-develop']

+++

`nowinandroid`项目不仅仅是学习Compose的一个绝佳范本，它几乎涵盖了现代Android开发的所有最佳实践。除了Compose，还有其他方面值得投入学习。

### 1. 响应式编程与架构(Reactive Architecture)

这是整个App的灵魂，也是比Compose本身更核心、更通用的能力。

* Kotlin `Flow`的深度运用：
  * UI状态流(`StateFlow`):学习`ForYouViewModel`是如何将多个数据源(`Repository`)转换、合并成一个单一、稳定的`UiState`流暴露给UI的。
  * 操作符(`combine`, `map`,`flatMapLastest`): 
  * 将回调转换为Flow(`callbackFlow`)
* 单向数据流(**UDF**)
  * 仔细体会 “状态向下流动，事件向上传递”这一原则。UI永远只负责展示`ViewModel`给它的状态，以及将用户的操作作为事件通知给`ViewModel`。这让数据流变得清晰、可预测、易于调试。

### 2. 模块化与依赖管理 (Modularization & Dependencies)

这决定了项目的可扩展性、编译速度和团队协作效率。

* 分层模块化：
  * 理解`:app`,`:feature:*`,`core:*`这三层结构的设计思想。为什么`:core:model`处于最底层？为什么`:feature`模块之间不能相互依赖？为什么`:app`模块要尽可能“薄”？
* **Gradle**约定插件(`build-logic`):
  * 这是大型项目的标配。学习`HiltConventionPlugin.kt`,`AndroidFeatureConventionPlugin.kt`等文件，理解它是如何将重复的Gradle配置（比如应用Hilt插件、添加通用依赖）集中管理，从而让每个模块的`build.gradle.kts`变得极其简洁。
* 版本目录(`libs.versions.toml`)
  * 学习它是如何集中管理所有依赖库的版本，并配合`projects`类型安全访问器，让依赖声明变得既安全又清晰。

### 3. 依赖注入（Hilt）

Hilt是现代Android开发的必备技能。

* 核心注解：理解`@HiltViewModel`，`@Inject`,`@Module`，`@Module`,`@Provides`,`@Binds`的作用和区别。
* 组件作用域（`@InstallIn`）: 为什么有些模块安装在`SingletonComponent`,有些在`ActivityComponent`？这直接关系到对象的生命周期。

### 4. 数据层(`:core:data`)

学习如何构建一个健壮、可测试的数据层。

* 仓库模式 (`Repository Pattern`): 理解 `Repository` 是如何作为数据来源的唯一真实来源 (`Single Source of Truth`)，以及它如何屏蔽 `ViewModel` 对数据来源（网络还是本地）的感知。
* 离线优先策略 (`OfflineFirst..`.): `OfflineFirstNewsRepository `是一个完美的教学案例，展示了如何协同数据库 (`Room)` 和网络 (`Retrofit`)，在保证快速响应的同时，在后台同步最新数据。
