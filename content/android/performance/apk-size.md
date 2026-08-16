+++
title = 'Android 包体积优化：从 APK 分析到 R8、资源和 ABI'
date = '2025-06-15T23:19:59+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'APK Optimization', 'R8']
description = "整理 Android 包体积优化的排查顺序：先分析 APK 构成，再分别处理代码、资源、原生库、Assets 和动态交付。"
slug = "apk-size-optimization"
+++

包体积优化不能只靠“开混淆”。正确路径是先知道体积花在哪里，再按代码、资源、原生库、Assets、动态模块逐项处理。

## 核心结论

1. 先用工具看 APK/AAB 构成，再决定优化方向。
2. R8 的主要价值是裁剪、优化和混淆，其中裁剪对体积影响最大。
3. 资源优化重点是删除无用资源、压缩图片和控制多套资源。
4. 原生库要重点检查 ABI、重复 `.so` 和调试符号。
5. 大功能可以考虑 Play Feature Delivery 或按需下载，不要全部塞进首包。

## 分析入口

常用工具：

1. Android Studio `Build > Analyze APK`
2. Android Studio App Size Analyzer
3. Gradle 构建输出和依赖报告
4. `bundletool` 分析 AAB 生成的设备 APK

先看四类占比：

```text
classes.dex      -> Java/Kotlin 字节码
res/resources    -> Android 资源
lib/*.so         -> Native 库
assets           -> 原始资产文件
```

## 代码体积

R8 可以完成三件事：

1. **Shrinking**：删除未使用类、方法和字段；
2. **Optimization**：内联、常量传播、简化控制流；
3. **Obfuscation**：缩短名称，提高逆向成本。

配置入口通常是：

```kotlin
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

注意点：

1. 不要盲目 `-keep` 整个包；
2. 反射、序列化、JNI、路由框架需要明确 keep 边界；
3. 先看 R8 输出，再判断哪些规则过宽；
4. Debug 包不要拿来评估最终体积。

## 资源体积

资源优化重点：

1. 开启 `shrinkResources`；
2. 删除未使用资源；
3. 图片优先使用 WebP 或 VectorDrawable；
4. 控制多语言、多密度、多主题资源；
5. 避免把临时大图、设计稿、日志文件放进 `assets`。

排查命令：

```bash
./gradlew lintRelease
```

图片策略：

| 类型 | 建议 |
| --- | --- |
| 简单图标 | VectorDrawable |
| 照片类图片 | WebP |
| 透明图片 | WebP lossless 或 PNG |
| 大型离线素材 | 按需下载或独立资源包 |

## Native 库体积

原生库常见体积来源：

1. 多 ABI 同时打包；
2. `.so` 中包含调试符号；
3. 第三方 SDK 带入重复库；
4. Rust/C++ 静态链接带来额外体积。

可以按目标市场控制 ABI：

```kotlin
android {
    defaultConfig {
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }
}
```

如果使用 AAB，Google Play 会按设备拆分 ABI，首包压力会小很多。

## Assets 和动态能力

`assets` 不会像普通资源那样参与细粒度优化，放进去的文件通常会原样进入包体。

适合放在 `assets` 的内容：

1. 小型配置文件；
2. 必须随包内置的模型或规则；
3. 首次启动必须可用的轻量数据。

不适合：

1. 大视频；
2. 大型模型；
3. 可在线更新的内容；
4. 调试文件和临时数据。

## 回看清单

1. 体积优化先分析构成，不要凭感觉删。
2. R8 的体积收益主要来自裁剪，不是混淆本身。
3. `shrinkResources` 要和 R8 一起开启才更有效。
4. Native 体积重点看 ABI 和符号。
5. 大资源优先考虑按需下载或动态交付。
