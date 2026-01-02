+++
title = '包体积优化'
date = '2025-06-15T23:19:59+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'APK Optimization', 'R8']
description = "Android 包体积优化指南：代码混淆 (R8), 资源优化, 库优化及 APK 分析工具。"
slug = "apk-size-optimization"
+++

## 一、APK结构分析工具

1. Android Studio内置工具
   * 使用 Build > Analyze APK
   * 查看各模块占比(代码/资源/原生库/Assets)
2. 命令行工具

```bash
./gradlew :app:assembleRelease --scan
```

## 二、代码优化

1. 启用代码混淆与优化
2. 移除未使用代码
   * 使用android studio的lint分析未使用代码
   * 添加R8配置文件删除无引用代码
3. 方法数优化
   * 启用Multidex前优化
   * 使用D8编译器的dex优化

## 三、资源优化

1. 资源压缩与清理
2. 移除未使用资源

```bash
# 检测未使用资源
./gradlew lintRelease

# 自动移除
./gradlew removeUnusedResources
```

3. 矢量图代替位图
4. Webp格式转换

## 四、库优化

1. 仅保留必要ABI
2. 轻量库代替

## 五、高级优化技术

1. 资源混淆
2. 资源分包加载
3. 按需加载功能模块

## 六 、 Assets优化

1. 压缩assets资源：存储时压缩，使用时解压

## 七、知识补充

1. D8、R8和代码混淆的关系
   * D8负责字节码到Dex的精确转换
   * R8 = D8 + 裁剪 + 优化 + 混淆
   * 混淆是R8的战术武器：仅负责名称混淆（对体积影响小，对安全性关键）
   * **开启R8 ≈ D8编译 + 三重优化(裁剪/优化/混淆)**
