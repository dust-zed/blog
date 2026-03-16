+++
title = 'Android 渲染系统'
date = '2025-06-13T09:30:56+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Rendering', 'View', 'Choreographer', 'VSync']
description = "深入理解 Android 渲染系统：从 View 树到屏幕像素的完整链路。"
slug = "android-rendering-system"
+++

## 核心问题

**一帧画面是如何从代码变成屏幕像素的？**

理解这个问题，就理解了 Android 渲染系统的核心。

---

## 知识脉络

### 第一层：View 树的测量、布局、绘制

#### View 树结构

每个 Activity 对应一个 `DecorView`，内部结构：

```
DecorView
  └── LinearLayout
        ├── FrameLayout (标题栏)
        └── FrameLayout (内容区域) ← setContentView() 添加的位置
```

#### MeasureSpec：父子的约定

MeasureSpec 封装了父容器对子 View 的测量要求：

| 模式 | 含义 | 来源 |
|------|------|------|
| EXACTLY | 精确大小 | 具体数值 / match_parent |
| AT_MOST | 最大限制 | wrap_content |
| UNSPECIFIED | 无限制 | ScrollView 等特殊情况 |

#### 三大流程

```
measure() → layout() → draw()
    ↓           ↓          ↓
 测量大小    确定位置    绘制内容
```

- **measure**：自顶向下递归，确定每个 View 的测量宽高
- **layout**：自顶向下递归，确定每个 View 的最终位置
- **draw**：按照 背景 → 内容 → 子 View → 装饰 的顺序绘制

---

### 第二层：从 invalidate() 到 VSync

#### 触发重绘的完整链路

```
View.invalidate()
    ↓
ViewRootImpl.scheduleTraversals()
    ↓
┌─────────────────────────────────┐
│ 1. 发送同步屏障（拦住普通消息）    │
│ 2. 向 Choreographer 注册回调     │
│ 3. 请求 VSync 信号               │
└─────────────────────────────────┘
    ↓
VSync 到达
    ↓
Choreographer.doFrame()
    ↓
performTraversals() → measure/layout/draw
```

#### Choreographer：编舞者

Choreographer 协调 UI、动画、输入的时序：

```java
doFrame() {
    doCallbacks(INPUT);            // 处理输入
    doCallbacks(ANIMATION);        // 执行动画
    doCallbacks(INSETS_ANIMATION); // 窗口动画
    doCallbacks(TRAVERSAL);        // measure/layout/draw
    doCallbacks(COMMIT);           // 提交
}
```

#### VSync：垂直同步信号

屏幕以 60Hz 刷新（每帧 16.6ms）。VSync 是"开始绘制下一帧"的信号。

- CPU+GPU 在 16.6ms 内完成 → 正常显示
- 超过 16.6ms → **掉帧**

---

### 第三层：Surface 与 GPU 渲染

#### Surface

每个窗口对应一个 Surface，是图形数据的容器：

```
View 树 → Canvas(Skia) → Surface(BufferQueue) → SurfaceFlinger → 屏幕
```

#### BufferQueue

| 缓冲数 | 特点 |
|--------|------|
| 单缓冲 | 会撕裂 |
| 双缓冲 | 基本流畅 |
| 三缓冲 | 更平滑，延迟略高 |

#### 硬件加速

- **软件渲染**：CPU 绘制 → Bitmap → 拷贝到显存
- **硬件加速**：CPU 生成指令 → GPU 直接执行

---

## 面试高频点

### Q1: requestLayout() 和 invalidate() 区别？

| 方法 | 触发流程 | 场景 |
|------|----------|------|
| `requestLayout()` | measure → layout | 尺寸/位置变化 |
| `invalidate()` | draw | 外观变化 |
| 两者都调 | 全流程 | 尺寸 + 外观都变 |

### Q2: View.post 为什么能获取准确宽高？

1. `performTraversals()` 开始时设置**同步屏障**
2. `post()` 的 Runnable 排在屏障之后
3. measure/layout 完成后移除屏障
4. Runnable 执行时宽高已确定

### Q3: getMeasuredWidth() 和 getWidth() 区别？

| 方法 | 含义 | 可用时机 |
|------|------|----------|
| `getMeasuredWidth()` | 测量阶段期望宽度 | onMeasure 后 |
| `getWidth()` | 布局阶段最终宽度 | onLayout 后 |

### Q4: 如何监控掉帧？

```kotlin
Choreographer.getInstance().postFrameCallback { frameTimeNanos ->
    val jitter = frameTimeNanos - lastFrameTime
    if (jitter > 16_666_666) {
        val dropped = jitter / 16_666_666
        Log.w("Frame", "Dropped $dropped frames")
    }
    lastFrameTime = frameTimeNanos
}
```

---

## 实战案例

### 列表滑动卡顿排查

**步骤**：
1. GPU 过度绘制：检查是否过度绘制
2. Systrace：定位卡顿阶段
3. 检查 `onBindViewHolder`：是否有耗时操作

**常见原因**：

| 原因 | 解决 |
|------|------|
| 布局层级深 | ConstraintLayout 扁平化 |
| onBindViewHolder 耗时 | 预加载、异步 |
| 图片过大 | 采样、Glide |
| 频繁创建对象 | 对象复用 |

### 自定义 View 优化

```kotlin
class CustomView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    // 1. 避免在 onDraw 中创建对象
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onDraw(canvas: Canvas) {
        // 2. 跳过不可见区域
        if (canvas.quickReject(drawRect)) return

        // 3. 限制绘制范围
        canvas.clipRect(drawRect)
        // 绘制...
    }
}
```

---

## 知识关联

- [消息机制](message-system.md)：同步屏障的实现原理
- [性能优化](performance-optimization.md)：渲染性能深度优化
- [现代 UI 架构](modern-ui-architecture.md)：Compose 的渲染原理
