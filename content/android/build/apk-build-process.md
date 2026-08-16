+++
title = 'Android APK 打包流程：从源码到可安装文件'
date = '2025-06-28T12:15:42+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Build Process', 'APK', 'AAPT2']
description = "梳理 Android APK/AAB 的构建链路：资源编译、Kotlin/Java 编译、D8/R8、Manifest 合并、签名、zipalign 与最终产物。"
slug = "apk-build-process"
+++

Android 打包流程的本质，是把源码、资源、Manifest、依赖和原生库转换成系统可以安装和加载的产物。日常点击 “Run” 很简单，但理解构建链路能帮助定位资源冲突、依赖问题、签名问题和包体积问题。

## 核心结论

1. 资源先经过 AAPT2 编译和链接，生成 `R`、`resources.arsc` 和二进制资源。
2. Kotlin/Java 源码先编译成 JVM 字节码，再由 D8/R8 转成 Dex。
3. Manifest 会合并主工程、依赖库和变体配置。
4. Release 包需要签名和 zipalign，签名保证来源可信，zipalign 优化运行时读取。
5. AAB 是上传给应用商店的发布格式，最终安装到设备上的仍是按设备拆分后的 APK。

## 总体流程

```text
Kotlin / Java 源码
  -> kotlinc / javac
  -> .class
  -> D8 / R8
  -> classes.dex

res / AndroidManifest.xml
  -> AAPT2 compile
  -> .flat
  -> AAPT2 link
  -> resources.arsc / R / 合并后 Manifest

assets / jniLibs / resources / dex
  -> 打包
  -> zipalign
  -> apksigner
  -> APK
```

## 资源编译：AAPT2

AAPT2 分成两个阶段：

1. **compile**

   把 `res/` 下的资源单独编译成 `.flat` 中间文件。

2. **link**

   合并所有资源，生成 `resources.arsc`、`R` 类、最终资源表和处理后的 Manifest。

这种分阶段设计的好处是支持增量编译。修改一个资源文件时，不一定要重新处理整个资源目录。

## 代码编译：Kotlin/Java 到 Dex

代码链路可以分成两段：

```text
Kotlin / Java
  -> .class
  -> .dex
```

其中：

1. `kotlinc` / `javac` 负责生成 JVM 字节码；
2. D8 负责把 `.class` 转成 Dex；
3. R8 在 Release 构建中负责裁剪、优化、混淆，并最终产出 Dex。

可以粗略理解为：

```text
D8 = 字节码到 Dex
R8 = D8 + shrink + optimize + obfuscate
```

## Manifest 合并

最终 APK 中只有一个 `AndroidManifest.xml`，但它来自多个来源：

1. app 主 Manifest；
2. product flavor / build type 配置；
3. library module 的 Manifest；
4. 第三方 SDK 的 Manifest。

Manifest 合并常见问题：

1. 权限重复或冲突；
2. `provider authorities` 冲突；
3. `minSdk` / `targetSdk` 约束冲突；
4. 组件属性被依赖库注入。

排查入口：

```text
build/intermediates/merged_manifest/
```

## 打包内容

一个 APK 通常包含：

```text
AndroidManifest.xml
classes.dex
resources.arsc
res/
assets/
lib/<abi>/*.so
META-INF/
```

其中：

1. `classes.dex` 是运行在 ART 上的字节码；
2. `resources.arsc` 是资源索引表；
3. `lib/<abi>` 存放 Native 库；
4. `assets` 原样打包；
5. `META-INF` 和签名相关。

## 签名与 zipalign

### zipalign

`zipalign` 会调整 APK 中未压缩资源的对齐方式，让系统可以更高效地通过内存映射读取资源。

核心价值：

1. 减少运行时额外拷贝；
2. 优化资源读取；
3. 是 Release APK 的标准步骤。

### 签名

签名用于证明 APK 来源，并保护包内容不被篡改。

常见签名方案：

1. V1：基于 JAR 签名，兼容老系统；
2. V2：对整个 APK 签名；
3. V3：支持密钥轮换；
4. V4：服务于增量安装。

## APK 和 AAB

| 格式 | 用途 |
| --- | --- |
| APK | 设备可直接安装 |
| AAB | 上传到 Google Play，由商店按设备生成拆分 APK |

AAB 的优势是可以按设备拆分：

1. ABI；
2. 屏幕密度；
3. 语言；
4. 动态功能模块。

因此 AAB 能降低用户实际下载体积，但本地调试和部分渠道发布仍会直接使用 APK。

## 回看清单

1. AAPT2 处理资源，D8/R8 处理 Dex。
2. Manifest 是多来源合并的结果，冲突要看合并产物。
3. Release 包要关注 R8、签名和 zipalign。
4. APK 是安装格式，AAB 是应用商店分发格式。
5. 构建问题要先判断出在资源、代码、Manifest、签名还是打包阶段。
