+++
date = '2025-10-17T09:28:07+08:00'
draft = false
title = 'Android项目组织结构'
categories = ['android-develop']

+++

#### 项目结构说明

##### 完整目录结构

```
project/
├── gradle/
│   └── libs.versions.toml          # Version Catalog
├── app/
│   ├── build.gradle.kts
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── java/com/example/myapp/
│           │   └── MainActivity.kt
│           └── res/
├── build.gradle.kts                # 根目录
├── settings.gradle.kts
└── gradle.properties
```

##### 核心原则

**必需库(2个)**：

* `androidx.core:core-ktx` - Kotlin扩展
* `androidx.appcompat:appcompat` - 兼容性支持

**UI方案(二选一)**：

1. 传统View: Material + ConstraintLayout
2. **Jetpack Compose**: Compose BOM + Material3

可选扩展：

* 架构组件：ViewModel/LiveData (MVVM模式需要)
* 协程：异步操作 （网络操作、数据库操作需要）

##### 使用建议

1. 最小项目：只用 core-ktx + appcompat + 一种UI
2. 需要架构：添加lifecycle bundle
3. 需要网络/数据库：添加coroutines
4. 库 vs 插件
   * `android.application` / `kotlin.android` - 必需插件
   * `kotlin.compose` - 仅Compose项目需要的插件
   * 其他都是库依赖

##### 常见误区

不是必须的库

* Activity/Fragment库 （appcompat已包含）
* RecyclerView （除非确定要用列表）
* Navigation组件 （简单项目不需要）
* Room/Retrofit （有需求再加）

#### libs.versions.toml 例子

```toml
[versions]
# 核心版本
agp = "8.7.3"
kotlin = "2.1.0"
compileSdk = "35"
minSdk = "24"
targetSdk = "35"

# AndroidX 核心库（必需）
core-ktx = "1.15.0"
appcompat = "1.7.0"

# 可选：UI 库（根据需要选择）
material = "1.12.0"
# 注：Compose 和传统 View 二选一
compose-bom = "2024.12.01"
# 或者使用 ConstraintLayout（传统 View）
constraintlayout = "2.2.0"

# 可选：生命周期（如需 ViewModel/LiveData）
lifecycle = "2.8.7"

# 可选：协程（如需异步操作）
coroutines = "1.10.1"

[libraries]
# === 核心库（必需）===
androidx-core-ktx = { module = "androidx.core:core-ktx", version.ref = "core-ktx" }
androidx-appcompat = { module = "androidx.appcompat:appcompat", version.ref = "appcompat" }

# === UI 库（二选一或都不要）===
# 方案 A: Material Components（传统 View）
material = { module = "com.google.android.material:material", version.ref = "material" }
androidx-constraintlayout = { module = "androidx.constraintlayout:constraintlayout", version.ref = "constraintlayout" }

# 方案 B: Jetpack Compose（现代声明式 UI）
androidx-compose-bom = { module = "androidx.compose:compose-bom", version.ref = "compose-bom" }
androidx-compose-ui = { module = "androidx.compose.ui:ui" }
androidx-compose-material3 = { module = "androidx.compose.material3:material3" }
androidx-compose-ui-tooling-preview = { module = "androidx.compose.ui:ui-tooling-preview" }
androidx-activity-compose = { module = "androidx.activity:activity-compose", version = "1.9.3" }

# === 可选：架构组件 ===
# ViewModel（如需 MVVM 架构）
androidx-lifecycle-viewmodel-ktx = { module = "androidx.lifecycle:lifecycle-viewmodel-ktx", version.ref = "lifecycle" }
# LiveData（如需响应式数据，Compose 项目可不用）
androidx-lifecycle-livedata-ktx = { module = "androidx.lifecycle:lifecycle-livedata-ktx", version.ref = "lifecycle" }

# === 可选：协程（如需异步操作）===
kotlinx-coroutines-android = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
# 必需插件
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }

# 可选：Compose 编译器插件（仅 Compose 项目需要）
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }

# 可选：如需多模块或库模块
android-library = { id = "com.android.library", version.ref = "agp" }

[bundles]
# 可选：组合常用库
# 传统 View UI 套件
traditional-ui = ["androidx-core-ktx", "androidx-appcompat", "material", "androidx-constraintlayout"]

# Compose UI 套件
compose-ui = ["androidx-compose-ui", "androidx-compose-material3", "androidx-compose-ui-tooling-preview", "androidx-activity-compose"]

# MVVM 架构套件
lifecycle = ["androidx-lifecycle-viewmodel-ktx", "androidx-lifecycle-livedata-ktx"]
```

#### 疑问解答

##### 为什么项目级要用`apply false`？

在项目根目录的`build.gradle.kts`中使用`apply false`是为了：

1. 声明插件版本，但不应用到根项目
2. 让子模块可以复用这些插件定义

```kotlin
// ❌ 项目根目录如果不加 apply false
plugins {
    alias(libs.plugins.android.application)  // 会应用到根项目
}
// 问题：根项目不是 Android 应用，会报错！

// ✅ 正确做法
plugins {
    alias(libs.plugins.android.application) apply false  // 只声明，不应用
}
```

**类比理解**

把根项目想象成插件仓库：

* `apply false` = 把插件放在仓库货架上
* 子模块`alias()` = 从货架取用插件
* 货架管理员（根项目）不需要用这些工具（插件）
