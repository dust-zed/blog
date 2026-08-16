+++
title = 'Android 项目组织结构：从单模块到可维护工程'
date = '2025-10-17T09:28:07+08:00'
draft = false
categories = ['android']
tags = ['Project Structure', 'Architecture', 'Best Practices']
description = "整理 Android 项目结构的组织原则：根目录、app 模块、core/feature 分层、Version Catalog、插件声明和依赖按需引入。"
slug = "project-structure"
+++

项目结构的目标不是显得“标准”，而是让代码边界清晰、依赖方向稳定、构建配置可维护。小项目可以简单，大项目则需要明确模块职责和构建约定。

## 核心结论

1. 单模块项目先保持简单，不要一开始就过度拆分。
2. 多模块项目通常按 `app`、`feature`、`core` 分层。
3. 依赖应该从上层指向下层，避免 feature 之间互相依赖。
4. 版本和插件声明集中管理，业务模块保持轻量。
5. 库按需求引入，不存在所有项目都“必需”的 UI/架构套件。

## 单模块结构

适合学习项目、小工具或业务复杂度较低的应用。

```text
project/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/example/app/
│       └── res/
├── gradle/
│   └── libs.versions.toml
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

单模块的重点是目录清楚：

```text
ui/
domain/
data/
common/
```

即使不拆 Gradle 模块，也可以先在包结构里建立边界。

## 多模块结构

当业务变多、编译变慢、多人协作明显增加时，可以考虑多模块。

```text
project/
├── app/
├── feature/
│   ├── home/
│   ├── detail/
│   └── settings/
├── core/
│   ├── model/
│   ├── data/
│   ├── network/
│   ├── database/
│   └── ui/
├── build-logic/
├── gradle/libs.versions.toml
└── settings.gradle.kts
```

职责建议：

| 模块 | 职责 |
| --- | --- |
| `app` | 应用入口、全局导航、依赖装配 |
| `feature:*` | 具体业务功能 |
| `core:model` | 基础领域模型 |
| `core:data` | Repository 和数据协调 |
| `core:network` | 网络请求和 DTO |
| `core:database` | 本地数据库和 DAO |
| `core:ui` | 公共 UI 组件 |
| `build-logic` | 构建约定插件 |

## 依赖方向

推荐方向：

```text
app
  -> feature
  -> core
```

避免：

```text
feature:home -> feature:detail
feature:detail -> feature:home
```

如果两个 feature 需要共享模型、工具或 UI，优先下沉到 `core`。

## 依赖按需引入

常见选择：

1. Kotlin 扩展：`androidx.core:core-ktx`
2. 传统 View：Material Components、ConstraintLayout、AppCompat
3. Compose：Compose BOM、Material3、Activity Compose
4. 生命周期：ViewModel、Lifecycle Runtime
5. 异步：Kotlin Coroutines
6. 数据库：Room
7. 网络：Retrofit/OkHttp/Ktor
8. 依赖注入：Hilt/Koin

原则：

> 先根据项目架构和 UI 技术栈选择依赖，不要把模板里的库全部搬进来。

## Version Catalog

`gradle/libs.versions.toml` 负责集中管理依赖版本：

```toml
[versions]
agp = "8.7.3"
kotlin = "2.1.0"
composeBom = "2024.12.01"

[libraries]
androidx-core-ktx = {
    module = "androidx.core:core-ktx",
    version = "1.15.0"
}
androidx-compose-bom = {
    module = "androidx.compose:compose-bom",
    version.ref = "composeBom"
}

[plugins]
android-application = {
    id = "com.android.application",
    version.ref = "agp"
}
kotlin-android = {
    id = "org.jetbrains.kotlin.android",
    version.ref = "kotlin"
}
```

模块中使用：

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

dependencies {
    implementation(libs.androidx.core.ktx)
}
```

## 为什么根项目常用 apply false

根项目通常只声明插件版本，不直接应用 Android 插件：

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
}
```

原因：

1. 根项目不是 Android App，不应该应用 Android Application 插件；
2. 子模块可以复用统一插件版本；
3. 插件声明集中，模块使用时更清晰。

可以把根项目理解为插件货架：根项目负责把插件放好，具体模块按需取用。

## 回看清单

1. 小项目先简单，复杂度上来后再拆模块。
2. 多模块重点是依赖方向，不是模块数量。
3. feature 不互相依赖，共享能力下沉 core。
4. Version Catalog 管版本，Convention Plugins 管构建约定。
5. 依赖按需引入，不要让模板决定架构。
