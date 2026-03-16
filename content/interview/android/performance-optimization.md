+++
title = 'Android 性能优化'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'Optimization', 'Startup', 'Memory']
description = "Android 性能优化全景：启动、内存、渲染、包体积的系统化优化方法。"
slug = "android-performance-optimization"
+++

## 核心问题

**如何系统化地进行性能优化？**

性能优化不是碎片化的技巧堆砌，而是**度量 → 定位 → 优化 → 验证**的闭环。

---

## 知识脉络

### 第一层：启动优化

#### 启动类型

| 类型 | 场景 | 耗时 |
|------|------|------|
| 冷启动 | 进程不存在 | 最慢 |
| 温启动 | 进程在，Activity 销毁 | 中等 |
| 热启动 | 进程和 Activity 都在 | 最快 |

#### 优化策略

**Application 阶段**：

```kotlin
// 1. 延迟初始化
class App : Application() {
    override fun onCreate() {
        // 只初始化必须的
        super.onCreate()
        // 其他在后台线程
        Thread { initNonEssential() }.start()
    }
}

// 2. App Startup 库
class MyInitializer : Initializer<Unit> {
    override fun create(context: Context) {
        // 异步初始化
    }
}
```

**UI 阶段**：

- 首屏精简
- ViewStub 延迟加载
- 避免主线程 IO

#### 测量

```bash
adb shell am start -W com.example/.MainActivity
```

---

### 第二层：内存优化

#### 指标

- PSS（实际占用）
- Java Heap
- Native Memory

#### Bitmap 优化

```kotlin
// 采样加载
val options = BitmapFactory.Options().apply {
    inSampleSize = 4
}
val bitmap = BitmapFactory.decodeFile(path, options)

// 复用内存
options.inBitmap = reusedBitmap
```

#### 内存泄漏检测

```gradle
debugImplementation 'com.squareup.leakcanary:leakcanary-android:2.12'
```

---

### 第三层：渲染优化

#### 掉帧监控

```kotlin
Choreographer.getInstance().postFrameCallback { frameTimeNanos ->
    val jitter = frameTimeNanos - lastFrameTime
    if (jitter > 16_666_666) {
        Log.w("Frame", "Dropped ${jitter / 16_666_666} frames")
    }
}
```

#### 过度绘制

开发者选项 → GPU 过度绘制：

| 颜色 | 次数 | 状态 |
|------|------|------|
| 无 | 0 | 正常 |
| 蓝 | 1 | 可接受 |
| 绿 | 2 | 警告 |
| 粉 | 3 | 需优化 |
| 红 | 4+ | 严重 |

#### 布局优化

- ConstraintLayout 扁平化
- ViewStub 按需加载
- merge 减少层级

---

### 第四层：包体积优化

#### 体积构成

| 类型 | 占比 | 优化 |
|------|------|------|
| DEX | 40% | R8 混淆 |
| 资源 | 30% | WebP、移除 |
| Native | 20% | 只保留必要 ABI |
| Assets | 10% | 动态下发 |

#### 配置

```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
        }
    }
    defaultConfig {
        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a'
        }
    }
}
```

---

## 面试高频点

### Q1: ANR 排查？

1. `/data/anr/traces.txt` 查看堆栈
2. StrictMode 检测主线程 IO
3. 重点关注：网络、数据库、文件操作

### Q2: 内存抖动？

频繁 GC 导致卡顿。

**表现**：Memory Profiler 中锯齿状波动。

**解决**：避免循环内创建对象、对象复用。

### Q3: Systrace 使用？

```bash
python $ANDROID_SDK/platform-tools/systrace/systrace.py \
    --app=com.example \
    -o trace.html \
    sched freq idle am wm gfx view
```

关注点：主线程 Block、CPU 频率、帧耗时。

---

## 优化工具箱

| 工具 | 用途 |
|------|------|
| CPU Profiler | 方法耗时 |
| Memory Profiler | 内存分析 |
| Network Profiler | 网络请求 |
| Systrace | 系统级 trace |
| Layout Inspector | 布局层级 |
| StrictMode | 主线程 IO 检测 |
| LeakCanary | 内存泄漏 |

---

## 知识关联

- [渲染系统](rendering-system.md)：渲染优化深度
- [内存管理](memory-management.md)：内存泄漏原理
- [消息机制](message-system.md)：卡顿与消息处理
