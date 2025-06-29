+++
date = '2025-06-29T15:26:57+08:00'
draft = false
title = 'gradle相关知识'
categories = ['android-develop']

+++

### 一、插件(Plugins) vs 库(Libraries)
| **特征**     | 插件 (Plugins)         | 库 (Libraries)           |
| ------------ | ---------------------- | ------------------------ |
| **本质**     | 构建逻辑扩展工具       | 运行时依赖的代码组件     |
| **作用**     | 添加任务/配置/目录结构 | 提供可调用的具体代码实现 |
| **声明位置** | `plugins {}` 块        | `dependencies {}` 块     |
| **影响范围** | 构建过程               | 运行时或编译时           |
| **典型示例** | `java`，`android`      | `gson`, `junit`          |

#### 1. 插件详解
**核心作用**：  
- 添加新任务（如 `compileJava`, `assemble`）
- 定义默认目录结构（如 `src/main/java`）
- 引入预置配置（如 `implementation` 依赖配置）

**使用场景**：  
```groovy
plugins {
    id 'com.android.application' // Android APP插件
    id 'org.jetbrains.kotlin.android' // Kotlin支持
}
```

#### 2. 库详解
**关键特征**：  
- 通过坐标声明：`group:name:version`（如 `com.google.guava:guava:32.0-jre`）
- **传递依赖**：库可能自带其他依赖（如 Retrofit 自动引入 OkHttp）

**使用场景**：
```groovy
dependencies {
    implementation 'androidx.core:core-ktx:1.12.0' // 主代码依赖
    testImplementation 'junit:junit:4.13.2'        // 测试代码专用
}
```

---

### 二、依赖配置详解
#### 1. `implementation`（最常用）
**特点**:
- 依赖**不传递**给其他模块
- 加快构建（减少重编译）
- 适用于绝大多数字依赖

```groovy
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
```

#### 2. `api`（谨慎使用）
**特点**:
- 依赖**传递**给其他模块
- 用于 SDK 开发需暴露依赖的场景
- 会增加构建时间

```groovy
api 'com.google.dagger:dagger:2.48' // 其他模块需使用Dagger
```

#### 3. `classpath`
**特点**:
- 仅用于项目级构建脚本(`build.gradle`)
- 为 Gradle 自身引入插件包，然后在模块级plugins块中声明使用
- **不参与**模块代码编译

```groovy
// 项目级 build.gradle
buildscript {
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
    }
}
```

#### 4. `alias`（版本目录）
**特点**：
- 在 `gradle/libs.versions.toml` 中集中管理依赖
- 解决版本号硬编码问题
- **需 AGP 7.4+** 支持

```toml
# libs.versions.toml
[versions]
androidxCore = "1.12.0"

[libraries]
android-core = { 
    group = "androidx.core", 
    name = "core-ktx", 
    version.ref = "androidxCore" 
}
```

```groovy
dependencies {
    implementation(libs.android.core) // 通过别名引用
}
```
