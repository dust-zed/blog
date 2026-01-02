+++
date = '2025-10-24T03:52:15+08:00'
draft = false
title = 'Gradle构建组织方式Convention Plugins'
categories = ['android']
tags = ['Gradle', 'Build', 'Kotlin DSL', 'Convention Plugins']
description = "使用 Convention Plugins 组织 Gradle 构建逻辑，实现标准化、复用和类型安全的构建配置。"
slug = "gradle-convention-plugins"
image = ""

+++

## 核心思想

Convention Plugins是一种通过预配置的Gradle插件来**标准化和复用构建逻辑**的方法，核心理念是：

* 约定优于配置 （Convention over Configuration）
* **DRY**原则（Don't Repeat Yourself）
* 构建逻辑集中管理
* 类型安全的配置

## 典型项目结构

```
project/
├── build-logic/                    # 构建逻辑模块
│   ├── settings.gradle.kts
│   └── convention/                 # 约定插件模块
│       ├── build.gradle.kts
│       └── src/main/kotlin/
│           ├── AndroidApplicationConventionPlugin.kt
│           ├── AndroidLibraryConventionPlugin.kt
│           ├── AndroidFeatureConventionPlugin.kt
│           └── KotlinLibraryConventionPlugin.kt
├── settings.gradle.kts
├── app/
├── feature/
│   ├── feature-foryou/
│   └── feature-bookmarks/
└── core/
    ├── core-ui/
    └── core-data/
```

## 解决的问题

如果不使用Convention Plugins会怎么样，项目中有10个`feature`模块（比如`:feature:foryou`,`:feature:bookmarks`,`feature:settings`等）。在传统的做法中，每个模块的`build.gradle.kts`文件都会包含大量相似的配置：

```kotlin
// 在 :feature:foryou/build.gradle.kts 文件中
plugins {
    id("com.android.library")
    id("kotlin-android")
    id("dagger.hilt.android.plugin")
    // ...可能还有其他插件
}

android {
    // ...大量通用的安卓配置
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:ui"))
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:...")
    // ...可能还有10个以上所有feature模块都需要的通用依赖
}
```

现在，如果你需要为所有`feature`模块添加一个新的通用依赖库，或者修改一个通用的编译选项，你就必须手动去修改10个不同的`build.gradle.kts`文件。这不仅繁琐，而且极易出错，非常难以维护。

## 实现方式

### 1. 设置build-logic模块

**build-logic/settings.gradle.kts**

```kotlin
pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
    }
}

dependencyResolutionManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
    }
    versionCatalogs {
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "build-logic"
include(":convention")
```

**build-logic/convention/build.gradle.kts**

```kotlin
plugins {
    `kotlin-dsl`
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.kotlin.gradlePlugin)
    compileOnly(libs.ksp.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("androidApplicationCompose") {
            id = libs.plugins.nowinandroid.android.application.compose.get().pluginId
            implementationClass = "AndroidApplicationComposeConventionPlugin"
        }
        register("androidApplication") {
            id = libs.plugins.nowinandroid.android.application.asProvider().get().pluginId
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidLibraryCompose") {
            id = libs.plugins.nowinandroid.android.library.compose.get().pluginId
            implementationClass = "AndroidLibraryComposeConventionPlugin"
        }
        register("androidLibrary") {
            id = libs.plugins.nowinandroid.android.library.asProvider().get().pluginId
            implementationClass = "AndroidLibraryConventionPlugin"
        }
        register("androidFeature") {
            id = libs.plugins.nowinandroid.android.feature.get().pluginId
            implementationClass = "AndroidFeatureConventionPlugin"
        }
    }
}
```

### 2. 创建约定插件

**AndroidApplicationConventionPlugin.kt**

```kotlin
class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.application")
            apply(plugin = "org.jetbrains.kotlin.android")
            apply(plugin = "nowinandroid.android.lint")
            apply(plugin = "com.dropbox.dependency-guard")

            extensions.configure<ApplicationExtension> {
                configureKotlinAndroid(this)
                defaultConfig.targetSdk = 35
                @Suppress("UnstableApiUsage")
                testOptions.animationsDisabled = true
                configureGradleManagedDevices(this)
            }
            extensions.configure<ApplicationAndroidComponentsExtension> {
                configurePrintApksTask(this)
                configureBadgingTasks(extensions.getByType<ApplicationExtension>(), this)
            }
        }
    }
}
```

**AndroidApplicationComposeConventionPlugin.kt**

```kotlin
class AndroidApplicationComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.application")
            apply(plugin = "org.jetbrains.kotlin.plugin.compose")

            val extension = extensions.getByType<ApplicationExtension>()
            configureAndroidCompose(extension)
        }
    }

}
```

**AndroidLibraryComposeConventionPlugin.kt**

```kotlin
class AndroidLibraryComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.library")
            apply(plugin = "org.jetbrains.kotlin.plugin.compose")

            val extension = extensions.getByType<LibraryExtension>()
            configureAndroidCompose(extension)
        }
    }

}
```

**AndroidLibraryConventionPlugin.kt**

```kotlin
class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.library")
            apply(plugin = "org.jetbrains.kotlin.android")
            apply(plugin = "nowinandroid.android.lint")

            extensions.configure<LibraryExtension> {
                configureKotlinAndroid(this)
                testOptions.targetSdk = 35
                lint.targetSdk = 35
                defaultConfig.testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
                testOptions.animationsDisabled = true
                configureFlavors(this)
                configureGradleManagedDevices(this)
                // The resource prefix is derived from the module name,
                // so resources inside ":core:module1" must be prefixed with "core_module1_"
                resourcePrefix =
                    path.split("""\W""".toRegex()).drop(1).distinct().joinToString(separator = "_")
                        .lowercase() + "_"
            }
            extensions.configure<LibraryAndroidComponentsExtension> {
                configurePrintApksTask(this)
                disableUnnecessaryAndroidTests(target)
            }
            dependencies {
                "androidTestImplementation"(libs.findLibrary("kotlin.test").get())
                "testImplementation"(libs.findLibrary("kotlin.test").get())

                "implementation"(libs.findLibrary("androidx.tracing.ktx").get())
            }
        }
    }
}
```

**AndroidFeatureConvention.kt**

```kotlin
class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "nowinandroid.android.library")
            apply(plugin = "nowinandroid.hilt")
            apply(plugin = "org.jetbrains.kotlin.plugin.serialization")

            extensions.configure<LibraryExtension> {
                testOptions.animationsDisabled = true
                configureGradleManagedDevices(this)
            }

            dependencies {
                "implementation"(project(":core:ui"))
                "implementation"(project(":core:designsystem"))

                "implementation"(libs.findLibrary("androidx.hilt.navigation.compose").get())
                "implementation"(libs.findLibrary("androidx.lifecycle.runtimeCompose").get())
                "implementation"(libs.findLibrary("androidx.lifecycle.viewModelCompose").get())
                "implementation"(libs.findLibrary("androidx.navigation.compose").get())
                "implementation"(libs.findLibrary("androidx.tracing.ktx").get())
                "implementation"(libs.findLibrary("kotlinx.serialization.json").get())

                "testImplementation"(libs.findLibrary("androidx.navigation.testing").get())
                "androidTestImplementation"(
                    libs.findLibrary("androidx.lifecycle.runtimeTesting").get(),
                )
            }
        }
    }
}
```

### 3. 核心方法：`apply`

当你将这个插件引用到一个模块时（例如，在`:feature:foryou`中应用它），Gradle就会执行这个插件类中的`apply`方法。逐行分析这个方法做了什么：

```kotlin
// 在 AndroidFeatureConventionPlugin.kt 中

class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) { // 'target' 就是应用这个插件的模块, 比如 :feature:foryou
        with(target) {
            // --- 动作一：应用其他更基础的约定插件 ---
            // 这行代码在说：“一个 `feature` 模块，首先它是一个 `library` 模块，
            // 并且它也需要 Hilt 依赖注入和序列化功能。”
            // 这体现了插件的组合能力。
            apply(plugin = "nowinandroid.android.library")
            apply(plugin = "nowinandroid.hilt")
            apply(plugin = "org.jetbrains.kotlin.plugin.serialization")

            // --- 动作二：配置通用的 Android 属性 ---
            // 这里统一为所有 feature 模块配置 'android' 代码块。
            // 比如，统一关闭测试中的动画，统一配置测试设备。
            extensions.configure<LibraryExtension> {
                testOptions.animationsDisabled = true
                configureGradleManagedDevices(this)
            }

            // --- 动作三：添加所有 feature 模块都需要的通用依赖 ---
            // 这是最强大的部分。它声明了“每一个” feature 模块都会自动获得这些依赖。
            // 无需在各自的 build.gradle.kts 中重复添加。
            dependencies {
                "implementation"(project(":core:ui"))
                "implementation"(project(":core:designsystem"))

                "implementation"(libs.findLibrary("androidx.hilt.navigation.compose").get())
                "implementation"(libs.findLibrary("androidx.lifecycle.viewModelCompose").get())
                // ... 以及其他所有通用依赖
            }
        }
    }
}
```

### 4. 共享配置函数

**KotlinAndroid.kt**

```kotlin
import com.android.build.api.dsl.CommonExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

internal fun Project.configureKotlinAndroid(
    commonExtension: CommonExtension<*, *, *, *, *, *>,
) {
    commonExtension.apply {
        compileSdk = 34

        defaultConfig {
            minSdk = 24
        }

        compileOptions {
            sourceCompatibility = JavaVersion.VERSION_17
            targetCompatibility = JavaVersion.VERSION_17
        }
    }

    configureKotlin()
}

private fun Project.configureKotlin() {
    tasks.withType<KotlinCompile>().configureEach {
        kotlinOptions {
            jvmTarget = JavaVersion.VERSION_17.toString()
            
            freeCompilerArgs = freeCompilerArgs + listOf(
                "-opt-in=kotlin.RequiresOptIn",
                "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            )
        }
    }
}
```

### 5. 在根项目中引入

**settings.gradle.kts**

```kotlin
pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
```

### 6. 在模块中引入

**app/build.gradle.kts**

```kotlin
plugins {
    id("myapp.android.application")
    id("myapp.android.application.compose")
}

android {
    namespace = "com.example.myapp"
    
    // 只需配置特定于此模块的内容
    defaultConfig {
        applicationId = "com.example.myapp"
    }
}

dependencies {
    implementation(project(":feature:home"))
    implementation(project(":feature:profile"))
}
```

**feature/feature-home/build.gradle.kts**

```kotlin
plugins {
    id("myapp.android.feature")
}

android {
    namespace = "com.example.myapp.feature.home"
}

dependencies {
    // Feature 特定的依赖
}
```

## Convention Plugin的优势

1. **DRY (Don't Repeat Yourself)** 原则：消除了在几十个文件中复制粘贴的构建逻辑。
2. 单一事实来源 (**Single Source of Truth**)：如果需要更新一个所有` feature` 模块都在用的库版本（比如 Lifecycle），你只需要在 `AndroidFeatureConventionPlugin.kt` 这一个文件里修改即可。
3. 简洁与清晰：每个模块的构建脚本变得非常短，只包含对该模块独一无二的配置，可读性大大提高。
4. 类型安全与 IDE 支持：因为这些插件是用 Kotlin 编写的，你可以享受到 IDE 的自动补全、编译时类型检查和方便的导航跳转，这比传统的 Groovy 脚本要强大得多。

这些都是`now-in-android`所应用的，更详细的可以通过此项目学习
