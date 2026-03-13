+++
title = "KMP + Rust + UniFFI 环境搭建指南"
date = "2026-03-13T10:00:00+08:00"
draft = false
description = "从零搭建 KMP + Rust + UniFFI 全自动化开发环境，使用 UniFFI 0.31 过程宏实现跨平台绑定。"
slug = "kmp-rust-uniffi-setup"
categories = ["rust"]
tags = ["Rust", "UniFFI", "KMP", "FFI", "CrossPlatform"]
image = ""
+++

## 适用场景

- 以 Rust 为核心业务层的跨平台应用
- 需要同时支持 Android、iOS、JVM Desktop
- 追求全自动化构建流程（Gradle 集成 cargo）

## 核心结论

1. **UniFFI 0.31 过程宏方式**：无需维护 `.udl` 文件，通过 Rust 属性宏自动生成绑定代码，开发体验更流畅。
2. **全自动化流程**：Gradle 构建时自动调用 `cargo build`，自动复制 `.so`/`.dylib`/`.dll` 到正确位置。
3. **单 shared 模块架构**：KMP 项目结构简洁，Rust 编译产物直接放入 shared 模块的 jniLibs 目录。

## 不适用边界

- 纯前端应用（无复杂计算或音视频处理需求）
- 对 FFI 调用延迟极其敏感的场景（每次调用有纳秒级开销）
- 团队完全不具备 Rust 能力（维护成本高）

---

## 1. 技术架构概览

```
┌─────────────────────────────────────────────────────┐
│                   KMP Shared                         │
│  ┌─────────────────────────────────────────────┐    │
│  │           Kotlin/Swift 业务层                │    │
│  │     (调用生成的 UniFFI 绑定代码)              │    │
│  └─────────────────────────────────────────────┘    │
│                       ↓                             │
│  ┌─────────────────────────────────────────────┐    │
│  │           UniFFI 生成的绑定层                │    │
│  │   • Kotlin 数据类 & 接口                     │    │
│  │   • FFI 函数声明                            │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                        ↓ FFI (JNI / C FFI)
┌─────────────────────────────────────────────────────┐
│                   Rust Core                         │
│  ┌─────────────────────────────────────────────┐    │
│  │           uniffi::export 宏                  │    │
│  │   • 编译时生成 C FFI 入口                    │    │
│  │   • 生成元数据（供 Kotlin 生成）             │    │
│  └─────────────────────────────────────────────┘    │
│                       ↓                             │
│  ┌─────────────────────────────────────────────┐    │
│  │           核心业务逻辑                       │    │
│  │   • 音视频处理（wgpu/ffmpeg-next）          │    │
│  │   • 网络通信（tokio/async）                 │    │
│  │   • 数据处理、算法                          │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### UniFFI 0.31 过程宏的优势

| 特性 | 传统 `.udl` 方式 | 过程宏方式（0.31+） |
|------|------------------|---------------------|
| 语法定义 | 单独维护 `.udl` 文件 | Rust 属性宏 `#[uniffi::export]` |
| 同步成本 | 需要手动同步 `.udl` 与 Rust 代码 | 自动同步，无额外文件 |
| IDE 支持 | `.udl` 无语法高亮 | 完整 Rust IDE 支持 |
| 学习曲线 | 需要学习 UDL 语法 | 只需学习几个属性宏 |
| 类型安全 | 编译时检查 | 编译时检查 |

---

## 2. 环境搭建

### 2.1 前置条件检查

```bash
# Rust 工具链
rustc --version   # >= 1.70
cargo --version
cargo install cargo-ndk

# 添加目标平台
rustup target add aarch64-linux-android    # Android ARM64
rustup target add aarch64-apple-ios        # iOS ARM64
rustup target add x86_64-apple-darwin      # macOS Desktop（用于生成绑定）

# Kotlin / Gradle
java --version    # >= 17
gradle --version  # >= 8.0

# Android NDK（通过 Android Studio SDK Manager 安装）
# 或设置环境变量
export ANDROID_NDK_HOME=$HOME/Android/Sdk/ndk/26.0.10792818
```

### 2.2 Step 1: Rust 项目配置

创建 Rust 核心库：

```bash
mkdir rust-core && cd rust-core
cargo init --lib
```

编辑 `Cargo.toml`：

```toml
[package]
name = "rust_core"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "staticlib"]
name = "rust_core"

[dependencies]
uniffi = { version = "0.31", features = ["tokio", "cli"] }
thiserror = "1.0"

[[bin]]
name = "uniffi-bindgen"
path = "src/bin/uniffi-bindgen.rs"
```

**关键配置说明**：

- `crate-type = ["cdylib", "staticlib"]`：生成动态库（Android/iOS/Linux）和静态库（备用）
- `features = ["tokio"]`：支持 async 函数导出
- `[[bin]]`: 生成绑定器的本地化宿主配置，它是一个 cli 程序，需要 uniffi 的`features=["cli"]`

### 2.3 Step 2: 过程宏定义

创建 `src/lib.rs`：

```rust
#[uniffi::export]
pub fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to Rust.", name)
}

#[uniffi::export]
pub fn add(a: i64, b: i64) -> i64 {
    a + b
}

// 导出自定义类型
#[derive(uniffi::Record)]
pub struct Person {
    pub name: String,
    pub age: u32,
}

#[uniffi::export]
pub fn create_person(name: String, age: u32) -> Person {
    Person { name, age }
}

// 导出枚举
#[derive(uniffi::Enum)]
pub enum Status {
    Idle,
    Running { progress: f64 },
    Completed { result: String },
}

// 导出带方法的对象
#[derive(uniffi::Object)]
pub struct Counter {
    count: std::sync::atomic::AtomicI64,
}

#[uniffi::export]
impl Counter {
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self {
            count: std::sync::atomic::AtomicI64::new(0),
        }
    }

    pub fn increment(&self) -> i64 {
        self.count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1
    }

    pub fn get(&self) -> i64 {
        self.count.load(std::sync::atomic::Ordering::SeqCst)
    }
}

// 异步函数支持（需要指定 async_runtime）
#[uniffi::export(async_runtime = "tokio")]
pub async fn fetch_data(url: String) -> Result<String, RustError> {
    // 实际项目中使用 reqwest 等 HTTP 客户端
    Ok(format!("Fetched from: {}", url))
}

// 错误类型
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum RustError {
    #[error("Network error: {message}")]
    Network { message: String },
    #[error("Invalid input: {message}")]
    InvalidInput { message: String },
}

uniffi::setup_scaffolding!();
```

**过程宏类型速查**：

| 宏 | 用途 | 示例 |
|----|------|------|
| `#[uniffi::export]` | 导出函数、方法 | `pub fn greet()` |
| `#[derive(uniffi::Record)]` | 导出数据类 | `struct Person` |
| `#[derive(uniffi::Enum)]` | 导出枚举 | `enum Status` |
| `#[derive(uniffi::Object)]` | 导出有状态对象 | `struct Counter` |
| `#[derive(uniffi::Error)]` | 导出错误类型 | `enum RustError` |
| `#[uniffi::constructor]` | 标记构造函数 | `pub fn new()` |
| `uniffi::setup_scaffolding!()` | 生成 FFI 入口 | 文件末尾调用一次 |

### 2.4 Step 3: 生成 Kotlin 绑定

创建 `uniffi.toml`（可选，用于自定义配置）：

```toml
[bindings.kotlin]
package_name = "org.forge.kmp.uniffi.rust"
cdylib_name = "rust_core"
```

手动生成 Kotlin 代码（调试用）：

```bash
# 生成 Kotlin 绑定
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/librust_core.dylib \
    --language kotlin \
    --out-dir ./bindings

# 生成 Swift 绑定
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/librust_core.dylib \
    --language swift \
    --out-dir ./bindings
```

### 2.5 Step 4: KMP 项目结构

创建 KMP 项目（使用 Kotlin Multiplatform Wizard）：

```
my-app/
├── composeApp/          # 主舞台：Compose 共享 UI 应用（com.android.application）
├── rustBridge/          # 桥接层：也是 KMP 模块
│   ├── build.gradle.kts
│   └── src/
│       ├── commonMain/kotlin/       # 公共业务代码
│       ├── androidMain/kotlin/      # Android 特定代码 (接纳 UniFFI 生成的代码)
│       ├── jvmMain/kotlin/          # JVM Desktop 特定代码
│       └── androidMain/jniLibs/     # Rust 编译产物 (.so) 存放地
└── rust-core/           # 核心层：纯 Rust Cargo 项目
    ├── Cargo.toml
    ├── uniffi.toml      # uniffi 自定义配置
    └── src/
        ├── lib.rs
        └── bin/uniffi-bindgen.rs    # 本地化生成的入口
```

注意：需要在composeApp的`build.gradle.kts` 添加这段代码，解决 .so 文件最终打进apk里

```
sourceSets {
    getByName("main") {
        // 参数是相对于 composeApp 模块的相对路径
        jniLibs.srcDir("../rustBridge/src/androidMain/jniLibs")
    }
}
```

### 2.6 Step 5: Gradle 全自动化集成

在 `rustBridge/build.gradle.kts` 中添加 Rust 构建任务：

```kotlin
import org.gradle.internal.os.OperatingSystem
import java.util.Properties

plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library") // gradle 9.0 KMP 专用架构
}

/* ==========================================================================
 * 1. 路径与环境变量初始化
 * ========================================================================== */
val rustProjectDir: File = rootProject.file("rust-core")
val rustTargetDir: File = rustProjectDir.resolve("target")

// 【混合路由策略】
val buildDir = layout.buildDirectory.get().asFile
// 1. Kotlin 接口代码和 JVM 本地资源放入 build 目录（保持 src 纯净）
val generatedKotlinDir = File(buildDir, "generated/rust/uniffi/kotlin")
val generatedJvmResourcesDir = File(buildDir, "generated/rust/resources")

// 2. Android 的 JNI 库放回 src 目录，顺应 gradle 9.0 默认嗅探机制
// ⚠️ 极其重要：必须在 .gitignore 中忽略此目录！(src/androidMain/jniLibs/)
val jniLibsDir = projectDir.resolve("src/androidMain/jniLibs")

val localPropertiesFile: File = rootProject.file("local.properties")
val localProperties = Properties()
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { stream ->
        localProperties.load(stream)
    }
}

val cargoPath: String = localProperties.getProperty("cargo.path")
    ?: error("cargo.path not set (use local.properties or -Pcargo.path=...)")
val ndkHome: String = localProperties.getProperty("ndk.dir")
    ?: error("ndk.dir not set (use local.properties or -Pndk.dir=...)")

/* ==========================================================================
 * 2. KMP 与 Android 基础配置
 * ========================================================================== */
kotlin {
    // Android 平台 (gradle 9.0 极简配置，不写 sourceSets 避免 DSL 报错)
    androidLibrary {
        namespace = "org.forge.kmp.uniffi.rust"
        compileSdk = 36
        minSdk = 34
    }

    jvm()
    iosX64()
    iosArm64()

    sourceSets {
        val commonMain by getting

        val androidMain by getting {
            // 【降维打击】把生成的代码直接挂载给 Android 叶子节点
            kotlin.srcDir(generatedKotlinDir)
            dependencies {
                implementation(libs.jna.get().toString()) {
                    artifact {
                        type = "aar"
                    }
                }
            }
        }

        val jvmMain by getting {
            // 【降维打击】把生成的代码也直接挂载给 Desktop 叶子节点
            kotlin.srcDir(generatedKotlinDir)
            resources.srcDir(generatedJvmResourcesDir)
            dependencies {
                implementation(libs.jna)
            }
        }

        val nativeMain by creating {
            dependsOn(commonMain)
        }
        iosArm64Main.get().dependsOn(nativeMain)
        iosX64Main.get().dependsOn(nativeMain)
    }
}

/* ==========================================================================
 * 3. 宿主机 (Mac/Linux/Win) 目标环境判断
 * ========================================================================== */
fun hostTarget(): String = when {
    OperatingSystem.current().isMacOsX -> {
        val arch = System.getProperty("os.arch").lowercase()
        if (arch.contains("aarch64") || arch.contains("arm64")) {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        }
    }
    OperatingSystem.current().isLinux -> "x86_64-unknown-linux-gnu"
    OperatingSystem.current().isWindows -> "x86_64-pc-windows-msvc"
    else -> error("Unsupported OS")
}

fun hostLibName(): String = when {
    OperatingSystem.current().isMacOsX -> "librust_core.dylib"
    OperatingSystem.current().isLinux -> "librust_core.so"
    OperatingSystem.current().isWindows -> "rust_core.dll"
    else -> error("Unsupported OS")
}

// 极简 ABI 定义，配合 cargo-ndk 使用
data class RustAndroidTarget(val androidAbi: String)
val androidTargets = listOf(
    RustAndroidTarget("arm64-v8a")
    // 未来按需解开：RustAndroidTarget("armeabi-v7a"), RustAndroidTarget("x86_64")
)

/* ==========================================================================
 * 4. 自定义 Gradle 任务 (Cargo, cargo-ndk, UniFFI Bindgen)
 * ========================================================================== */

// 4.1 编译宿主机架构 (用于桌面端运行和提取 Bindgen 接口)
tasks.register<Exec>("buildRustHost") {
    group = "rust"
    description = "Build Rust host library for bindgen & desktop"

    inputs.dir(rustProjectDir.resolve("src"))
    inputs.file(rustProjectDir.resolve("Cargo.toml"))
    outputs.dir(rustTargetDir)

    workingDir = rustProjectDir
    executable = cargoPath
    args("build", "--release", "--target", hostTarget())
}

// 4.2 复制宿主机动态库到桌面端资源目录
tasks.register<Copy>("copyRustHostResources") {
    group = "rust"
    dependsOn("buildRustHost")

    from(rustTargetDir.resolve("${hostTarget()}/release/${hostLibName()}"))
    into(generatedJvmResourcesDir)
}

// 4.3 生成 Kotlin 接口代码
tasks.register<Exec>("generateKotlinBindings") {
    group = "rust"
    dependsOn("buildRustHost")

    inputs.file(rustProjectDir.resolve("uniffi.toml"))
    inputs.file(rustTargetDir.resolve("${hostTarget()}/release/${hostLibName()}"))
    outputs.dir(generatedKotlinDir)

    workingDir = rustProjectDir
    executable = cargoPath
    args(
        "run", "--bin", "uniffi-bindgen", "--",
        "generate",
        "--library", "${rustTargetDir.absolutePath}/${hostTarget()}/release/${hostLibName()}",
        "--language", "kotlin",
        "--config", "uniffi.toml",
        "--out-dir", generatedKotlinDir.absolutePath
    )
}

// 4.4 极简无忧的 Android NDK 编译流程 (基于 cargo-ndk)
androidTargets.forEach { target ->
    val buildTaskName = "buildRustAndroid_${target.androidAbi}"

    tasks.register<Exec>(buildTaskName) {
        group = "rust"
        description = "Build Rust for ${target.androidAbi} using cargo-ndk"

        inputs.dir(rustProjectDir.resolve("src"))
        inputs.file(rustProjectDir.resolve("Cargo.toml"))
        outputs.dir(jniLibsDir.resolve(target.androidAbi))

        workingDir = rustProjectDir
        executable = cargoPath

        // 借助 cargo-ndk，省去所有路径拼接和 Copy 任务
        args(
            "ndk",
            "-t", target.androidAbi,
            "-o", jniLibsDir.absolutePath,
            "build",
            "--release"
        )
        environment("ANDROID_NDK_HOME", ndkHome)
    }
}

// 4.5 聚合任务
tasks.register("buildRustAndroid") {
    group = "rust"
    description = "Build all Android ABIs via cargo-ndk"
    dependsOn(androidTargets.map { "buildRustAndroid_${it.androidAbi}" })
}

/* ==========================================================================
 * 5. 生命周期自动化挂载与 Clean 强迫症清理
 * ========================================================================== */

// 不管是点 AS 的绿三角、Make Project 还是命令行编译
// 直接拦截所有带 compile 或 preBuild 字眼的早期核心任务
tasks.configureEach {
    val tName = name
    // 如果任务是编译、打包、资源处理、预构建的任何一种
    if (tName.startsWith("compile") ||
        tName.startsWith("preBuild") ||
        tName.startsWith("merge") ||
        tName.startsWith("package") ||
        tName.startsWith("process")
    ) {
        // Kotlin 必须先有代码才能编
        dependsOn("generateKotlinBindings")
        // 如果是跟 Android 或者 JNI 相关的任务流，必定先生出 .so 文件
        if (tName.contains("Android") || tName.contains("JniLib") || tName.contains("Debug") || tName.contains("Release")) {
            dependsOn("buildRustAndroid")
        }

        // 如果是 Desktop
        if (tName.contains("Jvm") || tName.contains("Desktop")) {
            dependsOn("copyRustHostResources")
        }
    }
}

// 【强迫症清理】执行 ./gradlew clean 时，把放在 src 下的生成的 jniLibs 一起删干净
tasks.named<Delete>("clean") {
    delete(jniLibsDir)
}
```

### 2.7 Step 6: 在 Kotlin 中使用

Android/iOS/JVM 通用代码（`shared/src/commonMain/kotlin/Platform.kt`）：

```kotlin
package com.example.shared

// UniFFI 生成的代码在 androidMain 中
// 通过 expect/actual 机制暴露给 commonMain

expect object RustBridge {
    fun greet(name: String): String
    fun add(left: ULong, right: ULong): ULong
}
```

Android 实现（`shared/src/androidMain/kotlin/Platform.kt`）：

```kotlin
package com.example.shared

import com.example.rust.* // UniFFI 生成的包

actual object RustCore {
    actual fun greet(name: String): String = greet(name)
    actual fun add(a: Long, b: Long): Long = add(a, b)

    // 使用自定义类型
    fun createPerson(name: String, age: Long): Person {
        return createPerson(name, age.toUInt())
    }

    // 使用 Counter 对象
    fun createCounter(): Counter = Counter()
}
```

---

## 3. 原理说明

### 3.1 过程宏工作原理

UniFFI 过程宏在**编译时**完成以下工作：

```
┌─────────────────────────────────────────────────────────┐
│  Rust 源码 (src/lib.rs)                                  │
│                                                          │
│  #[uniffi::export]                                       │
│  pub fn greet(name: String) -> String { ... }           │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  过程宏展开（编译时）                                     │
│                                                          │
│  1. 解析函数签名，记录类型信息                            │
│  2. 生成 C FFI 入口函数：                                 │
│     pub extern "C" fn uniffi_greet(...) -> ...          │
│  3. 生成元数据（embedded in binary）                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  编译产物 (librust_core.so / .dylib / .dll)              │
│                                                          │
│  包含：                                                  │
│  • C FFI 函数（uniffi_* 前缀）                          │
│  • 元数据 blob（类型信息、函数签名）                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  uniffi-bindgen generate（构建时）                       │
│                                                          │
│  1. 读取编译产物中的元数据                               │
│  2. 生成 Kotlin/Swift 绑定代码                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**关键点**：元数据被嵌入到编译产物中，`uniffi-bindgen` 从二进制文件中提取信息，无需 `.udl` 文件。

### 3.2 Kotlin 代码生成机制

生成的 Kotlin 代码结构：

```kotlin
// 包声明（由 uniffi.toml 配置）
package com.example.rust

// FFI 函数声明（JNA）
import com.sun.jna.Library
import com.sun.jna.Native

internal interface RustCoreLib : Library {
    companion object {
        val INSTANCE: RustCoreLib = Native.load("rust_core", RustCoreLib::class.java)
    }

    // FFI 函数
    fun uniffi_greet(name: RustBuffer.ByValue): RustBuffer.ByValue
    fun uniffi_add(a: Long, b: Long): Long
}

// 对外暴露的包装函数
fun greet(name: String): String {
    val rustName = FfiConverterString.lower(name)
    val rustResult = RustCoreLib.INSTANCE.uniffi_greet(rustName)
    return FfiConverterString.lift(rustResult)
}

// 数据类（对应 #[derive(uniffi::Record)]）
data class Person(
    val name: String,
    val age: UInt
)

// 枚举（对应 #[derive(uniffi::Enum)]）
sealed class Status {
    object Idle : Status()
    data class Running(val progress: Double) : Status()
    data class Completed(val result: String) : Status()
}

// 对象（对应 #[derive(uniffi::Object)]）
class Counter internal constructor(handle: Long) {
    internal val handle: Long = handle

    companion object {
        internal val DESTROYER = RustCallStatusHandler()
    }

    fun increment(): Long {
        return RustCoreLib.INSTANCE.uniffi_counter_increment(handle)
    }

    fun get(): Long {
        return RustCoreLib.INSTANCE.uniffi_counter_get(handle)
    }
}

// 工厂函数（对应 #[uniffi::constructor]）
fun Counter(): Counter {
    val handle = RustCoreLib.INSTANCE.uniffi_counter_new()
    return Counter(handle)
}
```

### 3.3 全自动 vs 半自动

| 方式 | 流程 | 优点 | 缺点 |
|------|------|------|------|
| **全自动** | Gradle → cargo build → 复制产物 → 生成绑定 | 一键构建，CI 友好 | 首次配置复杂 |
| **半自动** | 手动 cargo build → 脚本复制 → 手动生成绑定 | 灵活，适合调试 | 容易忘记步骤 |

推荐全自动方式，一次配置，长期受益。

---

## 4. 踩坑记录

### 4.1 版本兼容性问题

**问题**：UniFFI 版本与 Rust 版本不兼容

```
error: failed to select a version for `uniffi`.
```

**解决**：

```toml
# 确保所有 uniffi 依赖版本一致
[dependencies]
uniffi = { version = "0.31", features = ["tokio"] }

[build-dependencies]
uniffi = { version = "0.31", features = ["build"] }

[dev-dependencies]
uniffi = { version = "0.31", features = ["bindgen-tests"] }
```

### 4.2 Android NDK 链接器配置

**问题**：

```
error: linking with `cc` failed: exit code: 1
```

**解决**：确保 NDK 环境变量正确设置

```bash
# macOS / Linux
export ANDROID_NDK_HOME=$HOME/Android/Sdk/ndk/26.0.10792818

# 或在 Gradle 中硬编码（不推荐）
val ndkHome = "/path/to/ndk"
```

### 4.3 iOS 模拟器架构

**问题**：M1/M2 Mac 上 iOS 模拟器找不到库

**解决**：添加 `aarch64-apple-ios-sim` 目标

```bash
rustup target add aarch64-apple-ios-sim
```

### 4.4 Kotlin 类型映射

**Rust → Kotlin 类型映射**：

| Rust | Kotlin |
|------|--------|
| `i32` | `Int` |
| `i64` | `Long` |
| `u32` | `UInt` |
| `u64` | `ULong` |
| `f32` | `Float` |
| `f64` | `Double` |
| `bool` | `Boolean` |
| `String` | `String` |
| `Vec<T>` | `List<T>` |
| `HashMap<K, V>` | `Map<K, V>` |
| `Option<T>` | `T?` |
| `Result<T, E>` | `T` (throws E) |

**注意**：Kotlin 的无符号类型（`UInt`, `ULong`）在某些场景下需要显式转换。

### 4.5 异步函数限制

**问题**：异步函数在 iOS 上调用崩溃

**解决**：

1. 确保 UniFFI 开启 `tokio` feature
2. 在 Rust 端使用 `#[uniffi::export]` 的 async 函数会返回 `Future`
3. Kotlin 端需要使用协程调用

```kotlin
// Kotlin 调用异步函数
scope.launch {
    val result = withContext(Dispatchers.IO) {
        fetchData("https://example.com")
    }
    println(result)
}
```

### 4.6 增量编译问题

**问题**：修改 Rust 代码后，Gradle 没有重新构建

**解决**：确保 Gradle 任务正确声明输入输出

```kotlin
tasks.register("buildRustAndroid") {
    inputs.dir("${rustProjectDir}/src")  // 输入
    inputs.file("${rustProjectDir}/Cargo.toml")
    outputs.dir(jniLibsDir)  // 输出

    doLast { /* ... */ }
}
```

---

## 5. 总结

### 核心流程回顾

```
1. 配置 Rust 项目（Cargo.toml + 过程宏）
         ↓
2. Gradle 触发 cargo build（多目标平台）
         ↓
3. uniffi-bindgen 生成 Kotlin 绑定
         ↓
4. 编译产物复制到 jniLibs / resources
         ↓
5. Kotlin 代码调用 Rust 函数
```

### 最佳实践

1. **版本锁定**：所有 `uniffi` 依赖版本必须一致
2. **全自动化**：Gradle 集成 cargo，避免手动操作
3. **CI 配置**：在 CI 中缓存 Rust 编译产物
4. **错误处理**：使用 `thiserror` + `#[derive(uniffi::Error)]` 统一错误类型
5. **文档生成**：在 Rust 代码中添加文档注释，生成的 Kotlin 代码会保留

### 延伸阅读

- [UniFFI 官方文档](https://mozilla.github.io/uniffi-rs/)
- [UniFFI 条件编译：零成本模型共享](/p/rust-ffi-conditional-compilation)
- [Android Rust 混合开发入门](/p/android-rust-integration-intro)

---

## 更新记录

- 2026-03-13：初版发布，基于 UniFFI 0.31 过程宏方式
