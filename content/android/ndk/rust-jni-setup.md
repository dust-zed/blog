+++
title = 'Rust JNI 配置'
date = '2025-10-15T13:45:38+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Rust', 'JNI', 'Environment Setup']
description = "Rust JNI 开发环境配置指南：安装 Rust, cargo-ndk, NDK 及环境变量设置。"
slug = "rust-jni-setup"
+++

## 环境配置

### 1. 环境检查

```bash
# 检查 Rust 是否安装
rustc --version
# 应该看到: rustc 1.xx.x

# 检查 Cargo
cargo --version

# 检查 Android Studio 和 SDK
# 确保已安装 Android Studio
```

### 2. 安装必要工具

```bash
# 1. 安装 Android targets
rustup target add aarch64-linux-android    # ARM64
rustup target add armv7-linux-androideabi  # ARM32
rustup target add i686-linux-android       # x86
rustup target add x86_64-linux-android     # x86_64

# 2. 安装 cargo-ndk (重要!)
cargo install cargo-ndk

# 3. 验证安装
cargo ndk --version
```

### 配置NDK路径

**macOS/Linux**:

```bash
# 编辑 ~/.bashrc 或 ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
export ANDROID_HOME=$HOME/Android/Sdk          # Linux

export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
# 注意: 版本号可能不同,检查你的 ndk 目录

# 应用配置
source ~/.bashrc  # 或 source ~/.zshrc
```

**Windows**:

```powershell
# 设置环境变量
setx ANDROID_HOME "C:\Users\YourName\AppData\Local\Android\Sdk"
setx ANDROID_NDK_HOME "%ANDROID_HOME%\ndk\25.2.9519653"
```

### 验证NDK:

```bash
echo $ANDROID_NDK_HOME
# 应该显示路径,如: /Users/xxx/Library/Android/sdk/ndk/25.2.9519653

ls $ANDROID_NDK_HOME
# 应该看到: build, platforms, sources 等目录
```

