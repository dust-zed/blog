+++
title = 'Android 内存管理：泄漏、缓存与排查工具'
date = '2025-06-15T13:05:49+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'Memory Management', 'LeakCanary']
description = "整理 Android 内存管理的常见问题：生命周期泄漏、大对象缓存、系统资源释放、onTrimMemory 响应和 LeakCanary/MAT 排查路径。"
slug = "memory-management-practices"
+++

Android 内存问题通常分两类：一类是对象本来应该被释放却仍被引用，也就是内存泄漏；另一类是对象没有泄漏，但占用过大或释放不及时，导致频繁 GC、卡顿甚至 OOM。

## 核心结论

1. 泄漏本质是生命周期较长的对象持有了生命周期较短的对象。
2. `Activity`、`Fragment`、`View`、`Context` 是最常见的泄漏对象。
3. `Bitmap`、大集合、缓存和 Native 资源要主动控制大小和释放时机。
4. `onTrimMemory()` 是系统给应用释放资源的信号，不应该忽略。
5. 排查时先用 LeakCanary 找引用链，再用 Profiler/MAT 分析大对象和堆占用。

## 常见泄漏来源

### Context 泄漏

不要让单例、静态变量、长生命周期任务持有 `Activity Context`。

```kotlin
object ImageLoader {
    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
    }
}
```

### Handler 和回调泄漏

如果延迟任务持有 View 或 Activity，页面销毁后任务仍在队列中，就可能导致泄漏。

处理方式：

1. 在 `onDestroy()` / `onDestroyView()` 移除回调；
2. 避免匿名内部类长期持有页面；
3. 协程场景使用生命周期绑定的 scope。

```kotlin
override fun onDestroyView() {
    handler.removeCallbacksAndMessages(null)
    super.onDestroyView()
}
```

### 注册未反注册

常见对象：

1. `BroadcastReceiver`
2. 监听器
3. EventBus / Flow collector
4. Sensor callback
5. Location callback

原则：在哪里注册，就要有清晰的反注册位置。

## 大对象和缓存

### Bitmap

Bitmap 是 Android 内存问题高发点。

建议：

1. 使用 Glide/Coil 这类成熟图片库；
2. 按目标尺寸加载，不加载原图；
3. 避免在列表中持有大量 Bitmap；
4. 大图预览要关注采样率和生命周期。

### 缓存

缓存不是越大越好。缓存应该有上限、淘汰策略和内存压力响应。

常用策略：

1. 内存缓存用 `LruCache`；
2. 磁盘缓存用成熟库或明确目录；
3. 收到 `onTrimMemory()` 时主动降级或清理；
4. 不把页面对象放进全局缓存。

## onTrimMemory

`onTrimMemory(level)` 表示系统希望应用释放一部分内存。

常见处理：

```kotlin
override fun onTrimMemory(level: Int) {
    super.onTrimMemory(level)
    if (level >= TRIM_MEMORY_RUNNING_LOW) {
        imageCache.trimToSize(imageCache.size() / 2)
    }
}
```

需要关注的信号：

| level | 含义 | 建议 |
| --- | --- | --- |
| `TRIM_MEMORY_UI_HIDDEN` | UI 不可见 | 释放 UI 相关缓存 |
| `TRIM_MEMORY_RUNNING_LOW` | 运行中内存偏低 | 降低缓存 |
| `TRIM_MEMORY_RUNNING_CRITICAL` | 内存非常紧张 | 尽可能释放非必要资源 |

## 排查工具

### LeakCanary

适合自动发现 Activity、Fragment、ViewModel 等对象泄漏。

```kotlin
debugImplementation("com.squareup.leakcanary:leakcanary-android:2.x")
```

重点看：

1. 泄漏对象是什么；
2. GC Root 到泄漏对象的引用链；
3. 哪个长生命周期对象持有了它。

### Android Studio Profiler

适合观察：

1. 堆内存变化；
2. GC 频率；
3. 对象分配热点；
4. Heap Dump。

### MAT

适合分析复杂堆快照：

1. Dominator Tree 看谁占用最大；
2. Path to GC Roots 看为什么无法释放；
3. Histogram 看对象数量是否异常。

## 回看清单

1. 生命周期长的对象不要持有生命周期短的对象。
2. 页面销毁时清理 Handler、监听器、Receiver 和异步任务。
3. 大图和缓存必须有大小上限。
4. 系统内存压力回调要释放非必要资源。
5. 泄漏看引用链，OOM 看对象占用和分配趋势。
