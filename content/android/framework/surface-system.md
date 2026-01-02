+++
date = '2025-10-19T13:50:30+08:00'
draft = false
title = 'Surface体系指南'
categories = ['android']
tags = ['Surface', 'Graphics', 'View System']
description = "深入理解 Android Surface 体系：从 Material Design 设计概念到底层 SurfaceFlinger 渲染原理，以及 SurfaceView/TextureView 的区别。"
slug = "surface-system"
image = ""

+++

## 什么是surface？

### 通俗理解

**Surface** = 一块用于绘制内容的“画布”

Android有多层含义的 Surface 概念，容易混淆：

1. 底层图形系统的**Surface**（本质）
2. **Material Design**的**Surface** （设计概念）
3. **Compose**的**Surface**组件（UI组件）
4. **SurfaceView**和**TextureView**（特殊视图）

-----

### 层次架构

```
应用层
  ↓
Material Surface (设计概念：背景、卡片、对话框)
  ↓
UI 组件 (Compose Surface / View / SurfaceView)
  ↓
Android View System / Compose Runtime
  ↓
底层 Surface (实际的渲染目标)
  ↓
SurfaceFlinger (系统合成器)
  ↓
屏幕显示
```

--------

## 1. Material Design 中的Surface

### 什么是Surface（设计概念）？

在Material Design中，**Surface**是承载内容的容器:

```
┌─────────────────────────────┐
│ 应用背景 (Background)        │
│  ┌─────────────────────┐   │
│  │ Surface (卡片)       │   │ ← 有阴影、圆角
│  │  [内容]              │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ Surface (对话框)     │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

-----

## 2. Compose中的Surface组件

### Surface的作用

Compose的`Surface`是一个容器组件，提供：

* 背景色
* 形状（圆角、切角）
* 边框
* 阴影/高度
* 点击效果

### 基础用法

```kotlin
import androidx.compose.material3.Surface
import androidx.compose.material3.MaterialTheme

@Composable
fun BasicSurface() {
    // 最简单的 Surface
    Surface {
        Text("Hello World")
    }
    
    // 自定义属性
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        color = MaterialTheme.colorScheme.primaryContainer,     // 背景色
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer, // 内容色
        tonalElevation = 2.dp,                                  // 高度（影响颜色深浅）
        shadowElevation = 4.dp,                                 // 阴影高度
        shape = RoundedCornerShape(12.dp),                      // 形状
        border = BorderStroke(1.dp, Color.Gray)                 // 边框
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("标题", style = MaterialTheme.typography.titleLarge)
            Text("内容", style = MaterialTheme.typography.bodyMedium)
        }
    }
}
```

### Surface vs Box vs Card

```kotlin
// Box：纯布局容器，无样式
Box(
    modifier = Modifier
        .background(Color.White)  // 手动设置背景
        .padding(16.dp)
) {
    Text("Content")
}

// Surface：有背景、形状、高度的容器
Surface(
    color = MaterialTheme.colorScheme.surface,
    tonalElevation = 2.dp,
    shape = RoundedCornerShape(8.dp)
) {
    Text("Content")
}

// Card：预配置的 Surface（自带 padding、圆角、阴影）
Card(
    modifier = Modifier.fillMaxWidth()
) {
    Text("Content", modifier = Modifier.padding(16.dp))
}
```

#### 选择建议

* 需要自定义形状/阴影 → `Surface`
* 卡片样式 → `Card`（本质是预设好的Surface）
* 纯布局 → `Box`

### 实战：卡片列表

```kotlin
@Composable
fun ProductCard(product: Product) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp,
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 产品图片
            Surface(
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.size(80.dp)
            ) {
                AsyncImage(
                    model = product.imageUrl,
                    contentDescription = null
                )
            }
            
            // 产品信息
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "$${product.price}",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
```

-----

## 3. 传统View中的Surface

### MaterialCardView(常用)

```xml
<!-- res/layout/item_card.xml -->
<com.google.android.material.card.MaterialCardView
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    app:cardBackgroundColor="?attr/colorSurface"
    app:cardElevation="4dp"
    app:cardCornerRadius="12dp"
    app:strokeColor="?attr/colorOutline"
    app:strokeWidth="1dp">
    
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="16dp">
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="标题"
            android:textColor="?attr/colorOnSurface"
            android:textAppearance="?attr/textAppearanceTitleMedium" />
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:text="内容"
            android:textColor="?attr/colorOnSurfaceVariant"
            android:textAppearance="?attr/textAppearanceBodyMedium" />
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

### 对话框（DialogFragment）

```kotlin
class MyDialogFragment : DialogFragment() {
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        return MaterialAlertDialogBuilder(requireContext())
            .setTitle("标题")
            .setMessage("消息内容")
            .setPositiveButton("确定") { _, _ -> }
            .setNegativeButton("取消") { _, _ -> }
            .create()
    }
}
// 对话框自动使用 ?attr/colorSurface 作为背景
```

-----

## 4. 底层Surface（SurfaceView / TextureView）

### 什么时候用

* **View**
  * 普通UI
  * 性能一般
  * 主线程绘制
* **SurfaceView**
  * 视频播放、相机预览
  * 性能高
  * 独立Surface，后台线程绘制
* **TextureView**
  * 需要动画/变换的视频
  * 性能中等
  * 可以做动画，但性能较低

### SurfaceView示例

```kotlin
class VideoPlayerActivity : AppCompatActivity() {
    private lateinit var surfaceView: SurfaceView
    private var mediaPlayer: MediaPlayer? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        surfaceView = SurfaceView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        setContentView(surfaceView)
        
        // 监听 Surface 创建
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                // Surface 准备好了，开始播放
                mediaPlayer = MediaPlayer().apply {
                    setDataSource("https://example.com/video.mp4")
                    setDisplay(holder)
                    prepareAsync()
                    setOnPreparedListener { start() }
                }
            }
            
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                // Surface 大小改变
            }
            
            override fun surfaceDestroyed(holder: SurfaceHolder) {
                // Surface 销毁，释放资源
                mediaPlayer?.release()
                mediaPlayer = null
            }
        })
    }
}
```

### SurfaceView vs TextureView

```kotlin
// SurfaceView：性能最好，但不能做动画
val surfaceView = SurfaceView(context)
// ✅ 适合：视频播放、相机预览、游戏
// ❌ 不适合：需要透明度、旋转、缩放动画

// TextureView：可以做动画，但性能较低
val textureView = TextureView(context)
textureView.alpha = 0.5f              // ✅ 可以设置透明度
textureView.rotation = 45f            // ✅ 可以旋转
// ✅ 适合：需要动画效果的视频
// ❌ 不适合：追求极致性能的场景
```

### Compose中使用SurfaceView

```kotlin
@Composable
fun VideoPlayer(videoUrl: String) {
    AndroidView(
        factory = { context ->
            SurfaceView(context).apply {
                holder.addCallback(object : SurfaceHolder.Callback {
                    override fun surfaceCreated(holder: SurfaceHolder) {
                        // 初始化视频播放器
                    }
                    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
                    override fun surfaceDestroyed(holder: SurfaceHolder) {
                        // 清理资源
                    }
                })
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}
```

-------

## 5. 底层Surface工作原理

**Surface**的本质

```
应用进程                     系统进程
   ↓                           ↓
Canvas.draw()              SurfaceFlinger
   ↓                           ↓
 Surface ←─────共享内存───────→ Surface
   ↓                           ↓
写入像素数据                  读取像素数据
                               ↓
                          合成到屏幕
```

```
Surface = {
    SharedBuffer (共享内存)
    + 元数据 (宽度、高度、格式、Z-order)
}
```

关键点：

1. 每个Window有一个Surface
2. SurfaceView会创建独立的Surface（不在主Window上）
3. SurfaceFlinger负责合成所有Surface
4. Surface通过共享内存传递数据，避免拷贝

### 为什么SurfaceView性能高？

```kotlin
普通 View：
主线程绘制 → 等待 VSync → 显示
  ↑ 阻塞主线程

SurfaceView：
后台线程绘制 → 直接提交给 SurfaceFlinger → 显示
主线程继续处理 UI
```

* **SurfaceFlinger**: 系统合成器，合成所有应用的画面
* **Surface**：共享内存，应用写入，系统读取
* **Window**：窗口抽象，管理Surface和输入事件
* **Canvas**：绘制API，提供画图方法

----

