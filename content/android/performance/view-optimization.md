+++
title = 'Android View 性能优化：从测量、绘制到过度绘制'
date = '2025-06-13T23:55:35+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'View']
description = "整理 Android View 性能优化的核心路径：布局测量、绘制指令、GPU 过度绘制、硬件层和常用排查工具。"
slug = "view-performance-optimization"
+++

View 性能问题通常不是单点问题，而是发生在一帧渲染链路中的某个阶段：测量太重、布局太深、绘制指令太多、GPU 重复填充，或者动画过程中反复触发布局。

这篇笔记的目标是把优化动作放回渲染链路里理解，而不是只记一堆零散技巧。

## 核心结论

1. **布局阶段看层级和测量次数**：减少嵌套，避免无意义的二次测量。
2. **绘制阶段看 `onDraw()` 成本**：不要在绘制路径里分配对象、做 I/O 或触发布局。
3. **GPU 阶段看过度绘制和混合**：减少被完全覆盖的背景和大面积半透明。
4. **动画阶段看是否触发重新布局**：优先使用 `translationX/Y`、`alpha`、`scale` 等属性动画。
5. **硬件层只作为优化选项**：具体原理和使用边界放到《Android 硬件加速》里单独整理。

## 一帧里的性能检查点

```text
输入事件 / 状态变化
  -> measure
  -> layout
  -> draw / record DisplayList
  -> GPU rasterize
  -> SurfaceFlinger 合成
  -> 显示
```

优化时先判断卡顿发生在哪一段：

| 阶段 | 常见问题 | 典型优化 |
| --- | --- | --- |
| measure | 布局层级深、权重布局二次测量 | 减少嵌套，使用 `ConstraintLayout`，缓存测量结果 |
| layout | 频繁 `requestLayout()` | 避免在动画中改变布局参数 |
| draw | `onDraw()` 分配对象或复杂计算 | 复用 `Paint/Path/Rect`，提前计算 |
| GPU | 过度绘制、半透明混合 | 移除无效背景，控制透明层 |
| 合成 | 大量离屏图层 | 谨慎使用硬件层和裁剪 |

## 布局优化

布局优化关注 `measure` 和 `layout` 两个阶段。

常见策略：

1. **减少布局嵌套**

   深层嵌套会增加遍历和测量成本。简单页面可以用 `ConstraintLayout` 合并层级，但不要为了“扁平”制造过度复杂的约束。

2. **避免 `LinearLayout` 权重滥用**

   `layout_weight` 可能导致额外测量。列表项、复杂卡片或高频刷新区域要谨慎使用。

3. **使用 `<merge>` 和 `ViewStub`**

   `<merge>` 适合消除无意义的根容器，`ViewStub` 适合延迟加载低频出现的内容。

4. **自定义 ViewGroup 缓存测量结果**

   如果子 View 尺寸和约束稳定，可以缓存中间计算，避免每次 `onMeasure()` 重复推导。

## 绘制优化

`onDraw()` 会在一帧内被频繁调用，必须保持轻量。

不要在 `onDraw()` 中做这些事：

1. 创建 `Paint`、`Path`、`Bitmap`、`Rect` 等对象；
2. 读取文件、解析数据、访问网络；
3. 做复杂业务计算；
4. 调用 `invalidate()` 或 `requestLayout()` 形成循环；
5. 绘制屏幕外或被遮挡的内容。

推荐做法：

```kotlin
class ChartView(context: Context) : View(context) {
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val contentRect = RectF()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        contentRect.set(0f, 0f, w.toFloat(), h.toFloat())
    }

    override fun onDraw(canvas: Canvas) {
        if (canvas.quickReject(contentRect, Canvas.EdgeType.AA)) return
        canvas.drawLine(0f, height / 2f, width.toFloat(), height / 2f, linePaint)
    }
}
```

## 过度绘制优化

过度绘制指同一个像素在一帧内被重复绘制多次。它会增加 GPU 填充压力，尤其在列表、复杂卡片和半透明蒙层中很常见。

排查入口：

```text
开发者选项 -> 调试 GPU 过度绘制
```

优化动作：

1. 移除 Activity 根布局、主题、容器里的重复背景；
2. 删除被完全覆盖的中间层背景；
3. 避免大面积半透明 View；
4. 自定义绘制时使用 `clipRect()` 限制绘制区域；
5. 对屏幕外区域使用 `quickReject()` 提前跳过。

## 硬件层提示

硬件层属于绘制与合成阶段的优化手段，适合短时间属性动画，但不适合长期、大面积启用。这里不展开原理，具体的 CPU/GPU 分工、DisplayList 和硬件层边界，统一放在《Android 硬件加速：CPU、GPU 与硬件层》中整理。

## 常用工具

1. **Profile GPU Rendering**：观察每帧耗时，判断是否超过 16.6ms。
2. **Layout Inspector**：查看布局层级、约束和 View 树。
3. **Debug GPU Overdraw**：定位重复绘制。
4. **Perfetto / System Trace**：分析主线程、RenderThread 和系统调度。
5. **Memory Profiler**：排查绘制过程中的异常分配。

## 回看清单

1. 卡顿先定位阶段，不要一上来就改代码。
2. 布局优化看层级、测量次数和 `requestLayout()` 触发频率。
3. 绘制优化看 `onDraw()` 是否分配对象、做计算或绘制不可见区域。
4. GPU 优化看过度绘制、半透明和离屏图层。
5. 硬件层只作为候选优化项，具体使用边界回到硬件加速笔记判断。
