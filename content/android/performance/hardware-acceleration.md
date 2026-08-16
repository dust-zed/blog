+++
title = 'Android 硬件加速：CPU、GPU 与硬件层'
date = '2025-06-13T22:50:57+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Performance', 'Hardware Acceleration']
description = "整理 Android 硬件加速的核心模型：CPU 记录绘制指令，GPU 光栅化，硬件层用于短期缓存和动画优化。"
slug = "hardware-acceleration"
+++

硬件加速的核心不是“打开 GPU 就一定更快”，而是把绘制流程拆成两部分：CPU 负责记录绘制命令，GPU 负责把命令转换成像素。

## 核心结论

1. 硬件加速后，`onDraw()` 仍然会在主线程执行，但绘制命令会被记录成 DisplayList。
2. GPU 负责光栅化，把图形命令转换成最终像素。
3. 硬件层可以缓存 View 的绘制结果，适合短期属性动画。
4. 硬件层不是越多越好，大面积或长期启用会增加显存压力。

## 未启用硬件加速

简化流程：

```text
View 树遍历
  -> measure/layout
  -> CPU 执行 onDraw()
  -> CPU 光栅化
  -> 写入图形缓冲区
  -> 显示
```

此时 CPU 既要处理业务逻辑、布局计算，也要承担像素计算，复杂页面容易成为瓶颈。

## 启用硬件加速

简化流程：

```text
View 树遍历
  -> measure/layout
  -> CPU 执行 onDraw() 并记录 DisplayList
  -> RenderThread / GPU 消费绘制命令
  -> GPU 光栅化
  -> 写入 Buffer
  -> SurfaceFlinger 合成显示
```

这里的关键变化是：`Canvas` 的很多调用不再立即生成像素，而是记录成绘制指令。GPU 后续可以并行处理这些指令。

## DisplayList 的意义

DisplayList 可以理解为 View 绘制结果的命令列表：

```text
drawRect(...)
drawText(...)
drawBitmap(...)
clipPath(...)
```

如果 View 内容没有变化，系统可以复用已有 DisplayList，减少主线程重复记录绘制命令的成本。

但如果调用了 `invalidate()`，对应 View 的 DisplayList 仍然需要重新记录。

## 硬件层

硬件层会把 View 的绘制结果缓存成 GPU 纹理：

```text
View -> DisplayList -> GPU 光栅化 -> 离屏纹理
```

后续如果只是做平移、缩放、旋转、透明度变化，就可以直接复用纹理合成，不必重新绘制 View 内容。

适合场景：

1. 短时间属性动画；
2. 小面积复杂 View；
3. 内容不变，只做变换。

不适合场景：

1. 大面积列表；
2. 每帧内容都变化的自定义 View；
3. 长期启用的普通控件；
4. 内存紧张的页面。

## 使用方式

```kotlin
view.setLayerType(View.LAYER_TYPE_HARDWARE, null)

view.animate()
    .translationY(100f)
    .alpha(0f)
    .withEndAction {
        view.setLayerType(View.LAYER_TYPE_NONE, null)
    }
```

## 回看清单

1. 硬件加速不是跳过 `onDraw()`，而是改变绘制命令的执行方式。
2. CPU 负责记录命令，GPU 负责光栅化和合成。
3. DisplayList 可以减少重复记录绘制命令。
4. 硬件层适合短期动画缓存，不适合长期全局开启。
5. 判断是否需要硬件层，要看 View 内容是否稳定、面积是否可控、动画是否只做属性变换。
