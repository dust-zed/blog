+++
title = 'Android Rust混合开发入门'
date = '2025-10-15T11:55:59+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Rust', 'JNI', 'NDK']
description = "Android Rust 混合开发入门指南：JNI 原理、NDK 工作流程及 Rust 与 Java/Kotlin 交互基础。"
slug = "android-rust-integration-intro"
+++

## 什么是NDK?

**NDK = Native Development Kit(原生开发工具包)**

**一句话解释**

NDK 是 Android 提供的工具集,让你能用 **C/C++/Rust** 等原生语言开发 Android 应用的一部分

----

## Android应用的两种开发方式

```
┌─────────────────────────────────────────┐
│         Android 应用                     │
├─────────────────────────────────────────┤
│                                         │
│  方式 1: Java/Kotlin (Android SDK)      │
│  ┌──────────────────────────────────┐  │
│  │  Kotlin/Java 代码                │  │
│  │  ↓                               │  │
│  │  编译为 DEX 字节码               │  │
│  │  ↓                               │  │
│  │  在 Dalvik/ART 虚拟机运行        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  方式 2: C/C++/Rust (Android NDK)       │
│  ┌──────────────────────────────────┐  │
│  │  C/C++/Rust 代码                 │  │
│  │  ↓                               │  │
│  │  编译为 .so 文件 (机器码)        │  │
│  │  ↓                               │  │
│  │  直接在 CPU 上运行 (无虚拟机)    │  │
│  └──────────────────────────────────┘  │
│                                         │
│  两者通过 JNI 桥接                      │
└─────────────────────────────────────────┘
```

## 为什么需要NDK？

### 对比理解

纯 **Java/Kotlin(SDK):**

```
优点:
✅ 开发简单
✅ 跨设备兼容好
✅ 调试方便

缺点:
❌ 性能有限 (虚拟机开销)
❌ 某些功能无法实现
❌ 无法复用 C/C++ 库
```

**NDK(C/C++/Rust)**

```
优点:
✅ 性能极高 (接近机器码)
✅ 可以复用现有 C/C++ 库
✅ 直接访问硬件
✅ 跨平台代码复用

缺点:
❌ 开发复杂
❌ 调试困难
❌ 需要为不同 CPU 编译
```

----

## NDK工作原理

### 完整流程

```
第 1 步: 写 Rust 代码
┌────────────────────────┐
│ // Rust 代码           │
│ pub fn add(a: i32, b: i32) -> i32 {
│     a + b              │
│ }                      │
└────────────────────────┘
         ↓
第 2 步: NDK 编译
┌────────────────────────┐
│ NDK 工具链编译          │
│ - 交叉编译              │
│ - 针对 ARM/x86 CPU     │
└────────────────────────┘
         ↓
第 3 步: 生成 .so 文件
┌────────────────────────┐
│ librust_lib.so          │
│ (机器码,可直接运行)     │
└────────────────────────┘
         ↓
第 4 步: Android 加载
┌────────────────────────┐
│ System.loadLibrary("rust_lib")
│                        │
│ external fun add(a: Int, b: Int): Int
└────────────────────────┘
         ↓
第 5 步: JNI 调用
┌────────────────────────┐
│ Kotlin → JNI → Rust    │
│ val result = add(5, 3) │
│ // result = 8          │
└────────────────────────┘
```

-----

## NDK包含什么？

### NDK工具集

```
$ANDROID_NDK_HOME/
├── build/              # 构建脚本
├── toolchains/         # 编译器工具链
│   ├── aarch64-linux-android/  # ARM64 编译器
│   ├── arm-linux-androideabi/  # ARM32 编译器
│   ├── x86/                    # x86 编译器
│   └── x86_64/                 # x86_64 编译器
├── platforms/          # Android API 级别的头文件
├── sources/           # 示例代码
└── sysroot/           # 系统库
```

### 编译器

```
NDK 提供了针对不同 CPU 架构的编译器:

ARM64 (arm64-v8a):     现代手机 (主流)
ARM32 (armeabi-v7a):   老手机
x86:                   模拟器
x86_64:                模拟器
```

-----

## .so文件是什么？

### 理解.so文件

```
.so = Shared Object (共享对象)
类似于:
- Windows 的 .dll 文件
- macOS 的 .dylib 文件

作用:
- 包含编译后的机器码
- 可以被多个程序共享使用
```

### .so文件示例

```bash
# 查看 .so 文件
ls android/app/src/main/jniLibs/arm64-v8a/
# librust_lib.so  ← 这就是编译后的 Rust 代码

# 查看文件信息
file librust_lib.so
# librust_lib.so: ELF 64-bit LSB shared object, ARM aarch64, ...

# 查看导出的函数
nm -D librust_lib.so | grep Java
# Java_com_example_rustdemo_RustBridge_add
# Java_com_example_rustdemo_RustBridge_reverseString
```

----

## NDK开发流程

### 完整开发流程

```
1. 安装 NDK
   ↓
   Android Studio → SDK Manager → SDK Tools → NDK

2. 配置环境
   ↓
   export ANDROID_NDK_HOME=/path/to/ndk

3. 编写原生代码 (C/C++/Rust)
   ↓
   例如: add.c, image.cpp, search.rs

4. 使用 NDK 编译
   ↓
   ndk-build  (C/C++)
   cargo-ndk  (Rust)

5. 生成 .so 文件
   ↓
   libmylib.so

6. 放入 jniLibs 目录
   ↓
   app/src/main/jniLibs/arm64-v8a/libmylib.so

7. Kotlin 加载和调用
   ↓
   System.loadLibrary("mylib")
   external fun add(a: Int, b: Int): Int
```

----

## NDK核心概念

### JNI(Java Native Interface)

**JNI**是桥梁:

```
┌──────────────┐         ┌──────────────┐
│   Kotlin     │   JNI   │   Rust       │
│   (虚拟机)    │ ◄─────► │   (原生码)    │
└──────────────┘         └──────────────┘

数据传递:
Kotlin Int      ↔  Rust i32
Kotlin String   ↔  Rust String
Kotlin IntArray ↔  Rust &[i32]
```

### 交叉编译

什么是交叉编译?

```
你在 x86_64 电脑上开发
   ↓
但手机是 ARM64 架构
   ↓
需要"交叉编译": 在 x86_64 上编译出 ARM64 代码
   ↓
NDK 提供了交叉编译工具链
```

### ABI(Application Binary Interface)

不同**CPU**需要不同的**.so**文件:

```
arm64-v8a/libmylib.so    → ARM64 手机
armeabi-v7a/libmylib.so  → ARM32 手机
x86/libmylib.so          → x86 模拟器
x86_64/libmylib.so       → x86_64 模拟器
```

----

## 什么时候用NDK?

### 应该用NDK的场景

```
1. 性能关键代码
   - 图像/视频处理
   - 音频处理
   - 大量数学计算
   - 加密/解密

2. 复用现有代码
   - 已有 C/C++ 库
   - 跨平台代码 (iOS/Android 共享)

3. 保护核心算法
   - 防止反编译
   - 商业逻辑保护

4. 访问底层功能
   - 硬件控制
   - 系统调用
```

### 不应该用NDK的场景

```
1. 简单业务逻辑
   - 按钮点击
   - 数据展示
   - 网络请求

2. 快速开发
   - 原型验证
   - MVP 阶段

3. 团队不熟悉 C/C++/Rust
   - 维护成本高
   - Bug 难以调试
```

-----

## NDK开发工具

### 必备工具

```
1. Android NDK
   - 下载: Android Studio SDK Manager

2. CMake (C/C++) 或 cargo-ndk (Rust)
   - cargo install cargo-ndk

3. LLDB (调试器)
   - Android Studio 内置
```

### 辅助工具

```
# 查看 .so 文件信息
readelf -h libmylib.so

# 查看导出的函数
nm -D libmylib.so

# 反汇编 (调试用)
objdump -d libmylib.so
```

----

## 总结

### NDK是什么？

```
NDK = 让你用 C/C++/Rust 开发 Android 的工具包

作用:
1. 提供交叉编译工具链
2. 编译出 .so 机器码文件
3. 通过 JNI 与 Kotlin 交互
4. 获得原生性能

适用场景:
- 高性能计算
- 复用 C/C++ 库
- 跨平台开发
```

### 关键概念

```
NDK:   工具包
JNI:   桥梁 (Kotlin ↔ 原生代码)
.so:   编译后的机器码
ABI:   不同 CPU 架构

流程:
Rust 代码 → NDK 编译 → .so 文件 → JNI 调用 → Kotlin 使用
```

