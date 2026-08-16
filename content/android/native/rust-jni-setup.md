+++
title = 'Rust JNI 环境配置：Android NDK、cargo-ndk 与 ABI'
date = '2025-10-15T13:45:38+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Rust', 'JNI', 'Environment Setup']
description = "整理 Android Rust/JNI 开发环境配置：Rust target、cargo-ndk、Android NDK、环境变量、ABI 和基础验证命令。"
slug = "rust-jni-setup"
+++

Android 调用 Rust 的第一步不是写 JNI，而是把交叉编译环境配稳定。这里重点整理 Rust target、NDK、cargo-ndk 和 ABI 的关系。

## 核心结论

1. Android 上运行的是 `.so` 动态库，不是普通桌面可执行文件。
2. Rust 需要安装 Android 对应 target。
3. NDK 提供 Android 平台的交叉编译工具链。
4. `cargo-ndk` 可以简化 ABI、platform、输出目录等配置。
5. 先验证能产出 `.so`，再接 Kotlin/JNI。

## 环境检查

```bash
rustc --version
cargo --version
```

确认 Android SDK 和 NDK 已安装。通常可以在 Android Studio 里检查：

```text
Settings / Preferences
  -> Android SDK
  -> SDK Tools
  -> NDK
```

## 安装 Rust Android target

常见 target：

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add x86_64-linux-android
```

对应关系：

| Android ABI | Rust target |
| --- | --- |
| `arm64-v8a` | `aarch64-linux-android` |
| `armeabi-v7a` | `armv7-linux-androideabi` |
| `x86_64` | `x86_64-linux-android` |

实际发布通常优先保证 `arm64-v8a`。

## 安装 cargo-ndk

```bash
cargo install cargo-ndk
```

验证：

```bash
cargo ndk --version
```

## 配置 NDK 路径

常见环境变量：

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/<version>"
```

检查：

```bash
ls "$ANDROID_NDK_HOME"
```

应该能看到 `toolchains`、`platforms` 或相关 NDK 目录。

## 编译 Rust 动态库

`Cargo.toml`：

```toml
[lib]
crate-type = ["cdylib"]
```

编译：

```bash
cargo ndk \
  -t arm64-v8a \
  -o ../android/app/src/main/jniLibs \
  build --release
```

输出结构通常是：

```text
app/src/main/jniLibs/
└── arm64-v8a/
    └── librust_core.so
```

## Kotlin 侧加载

```kotlin
object NativeBridge {
    init {
        System.loadLibrary("rust_core")
    }
}
```

注意：`System.loadLibrary("rust_core")` 不写 `lib` 前缀，也不写 `.so` 后缀。

## 回看清单

1. ABI、Rust target、`.so` 输出目录必须对应。
2. NDK 是交叉编译工具链，cargo-ndk 是简化工具。
3. `crate-type = ["cdylib"]` 是生成 Android `.so` 的关键。
4. Kotlin 加载库名时去掉 `lib` 和 `.so`。
5. 先跑通单 ABI，再扩展多 ABI 和 Gradle 自动化。
