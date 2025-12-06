+++
date = '2025-12-06T14:38:51+08:00'
draft = true
title = 'Android Rust开发计划'
+++

### 环境配置

1. Rustup & cargo
2. Targets: `aarch64-linux-android`是必须的
3. NDK：连接 Java 世界和 Native 世界的基石
4. cargo-ndk：我们的黏合剂，它让 Rust 编译时能自动找到 NDK。

### 检查清单

```shell
# 1. Java
java -version
# 2. Rust
rustc --version
# 3. Android Targets
rustup target list --installed | grep android
# 4. cargo-ndk
cargo ndk --version
# 5. NDK (检查目录是否存在)
ls -d ~/Library/Android/sdk/ndk/*
```

### 初始化Rust项目

#### 第一步：初始化Rust项目

在 Android 项目根目录下，我们将创建一个名为 rust 的标准 Rust 项目。请在终端执行：

```
# 1. 进入项目根目录 (indieplay-android)
# 2. 创建 Rust 库项目
cargo init --lib --name indieplay_core rust
```

#### 第二步：配置 Cargo.toml

我们需要告诉 Rust 编译器： 1.我们要编译成动态库 (`cdylib`) 以便被 Android 加载。 2.我们需要 `jjni`crate 来辅助写 JNI 代码。请打开 `rust/Cargo.toml`，修改为以下内容：

```toml
[package]
name = "indieplay_core"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"] # 关键：生成 .so 文件

[dependencies]
jni = "0.21" # Rust 与 Java 交互的标准库
```

#### 第三步： 编写"Hello JNI"

打开`rust/src/lib.rs`，写入以下代码。这段代码定义了可以被Java调用的函数`hello()`

```rust
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::jstring;

#[no_mangle] // 禁止函数名混淆，确保 Java 能按名字找到它
pub extern "system" fn Java_com_android_yousuan_indieplay_IndiePlayApp_hello(
    let mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let output = env.new_string("Hello from Rust!").expect("Couldn't create java string!");
    output.into_raw()
}
```

**注意**：函数名 `Java_com_android_yousuan_indieplay_IndiePlayApp_hello`

 必须严格遵循 **Java_包名_类名_方法名的格式**。这里也就是对应`com.android.yousuan.indieplay.IndiePlayApp` *类里的* hello方法。

**Tips**: `Rust Analyzer`可能没有正确识别到`Cargo.toml`文件，需要在项目根目录下创建/修改`.vscode/settings.json`,告诉插件Rust项目在哪里:

```json
{
    "rust-analyzer.linkedProjects": [
        "rust/Cargo.toml"
    ]
}
```

#### Kotlin侧对接

```kotlin
package com.android.yousuan.indieplay

import android.app.Application

class IndiePlayApp : Application() {

    companion object {
        init {
            // 这里加载的名字必须和 Cargo.toml 里的 name 对应（去掉 lib 前缀）
            System.loadLibrary("indieplay_core")
        }
    }

    // 声明这个方法是外部（Rust）实现的
    external fun hello(): String

    override fun onCreate() {
        super.onCreate()
        // 您可以在这里打印一下日志验证
        // Log.d("IndiePlay", "Rust says: ${hello()}")
    }
}
```

