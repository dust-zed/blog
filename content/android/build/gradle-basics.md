+++
title = 'Android Gradle 基础：插件、依赖和版本目录'
date = '2025-06-29T15:26:57+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Gradle', 'Build Tool']
description = "整理 Android Gradle 的基础概念：插件与库的区别、implementation/api/classpath 的边界，以及 Version Catalog 的作用。"
slug = "gradle-basics"
+++

Gradle 配置最容易混乱的地方，是把“构建时用的东西”和“运行时用的东西”混在一起。理解插件、依赖配置和版本目录之后，很多报错会变得容易定位。

## 核心结论

1. **插件改变构建过程**，例如 Android 插件会添加编译、打包、签名等任务。
2. **库参与代码编译或运行**，例如 Retrofit、Room、JUnit。
3. `implementation` 默认优先使用，`api` 只在需要暴露依赖给下游模块时使用。
4. `classpath` 是旧式 buildscript 插件依赖，和业务代码依赖不是一回事。
5. Version Catalog 负责集中管理版本，适合多模块项目。

## 插件和库的区别

| 维度 | 插件 | 库 |
| --- | --- | --- |
| 本质 | 构建逻辑扩展 | 可被代码调用的依赖 |
| 作用 | 添加任务、扩展 DSL、改变构建流程 | 提供 API、运行时代码或测试能力 |
| 声明位置 | `plugins {}` | `dependencies {}` |
| 影响阶段 | 配置期和构建期 | 编译期、运行期或测试期 |
| 示例 | `com.android.application`、`org.jetbrains.kotlin.android` | Retrofit、Gson、JUnit |

插件示例：

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
```

依赖示例：

```kotlin
dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    testImplementation("junit:junit:4.13.2")
}
```

## implementation

`implementation` 是最常用的依赖配置。

特点：

1. 当前模块可以使用该依赖；
2. 下游模块不会直接看到该依赖；
3. 有利于减少不必要的重编译；
4. 适合绝大多数业务依赖。

```kotlin
dependencies {
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
}
```

如果 `feature-a` 依赖 `core-network`，而 `core-network` 使用 `implementation` 引入 Retrofit，那么 `feature-a` 不应该直接使用 Retrofit 类型。

## api

`api` 会把依赖暴露给下游模块。

适合场景：

1. 当前模块的公开接口里出现了该依赖的类型；
2. SDK 或公共基础库需要让使用方感知这个依赖；
3. 你明确希望依赖传递。

```kotlin
dependencies {
    api("com.google.dagger:dagger:2.48")
}
```

使用原则：

> 能用 `implementation` 就不要用 `api`，只有当公开 API 真的需要暴露依赖类型时再使用 `api`。

## classpath

`classpath` 常见于旧式 Gradle 配置：

```kotlin
buildscript {
    dependencies {
        classpath("com.android.tools.build:gradle:8.1.0")
    }
}
```

它的作用是让 Gradle 构建脚本能加载插件。它不参与 App 业务代码编译，也不会进入 APK。

现代项目更推荐使用 `plugins {}` 和 `pluginManagement` 管理插件版本。

## Version Catalog

Version Catalog 通常位于：

```text
gradle/libs.versions.toml
```

它解决的问题是：多模块项目里依赖版本分散、重复、难统一。

示例：

```toml
[versions]
androidxCore = "1.12.0"

[libraries]
androidx-core-ktx = {
    group = "androidx.core",
    name = "core-ktx",
    version.ref = "androidxCore"
}

[plugins]
android-application = {
    id = "com.android.application",
    version = "8.1.0"
}
```

使用方式：

```kotlin
dependencies {
    implementation(libs.androidx.core.ktx)
}
```

## 排错思路

遇到 Gradle 依赖问题时，先问几个问题：

1. 报错发生在配置期、编译期、运行期还是测试期？
2. 这个东西是插件还是库？
3. 当前模块是否真的需要直接访问该依赖？
4. 是否因为用了 `implementation`，下游模块访问不到类型？
5. 是否因为用了过宽的 `api`，导致构建变慢和依赖污染？

## 回看清单

1. 插件扩展构建流程，库提供代码能力。
2. `implementation` 隐藏依赖，`api` 暴露依赖。
3. `classpath` 是给 Gradle 构建脚本加载插件用的。
4. Version Catalog 解决多模块依赖版本集中管理。
5. 构建问题先判断发生阶段，再看依赖边界。
