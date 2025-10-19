+++
date = '2025-10-17T12:07:34+08:00'
draft = true
title = 'Window Insets指南'
categories = ['android-develop']

+++

#### 什么是Window Insets？

**Window Insets** = 系统**UI**占用的屏幕区域信息

想象你的应用是一张画布，但有些区域被系统UI“侵占”了：

* 顶部的**状态栏**(时间、电量、信号)
* 底部的**导航栏**(返回、Home、多任务)
* 刘海屏的**凹口**(notch)
* 折叠屏的**折痕**(hinge)
* 软键盘(**IME**)弹出时

**Window Insets**就是告诉你这些区域的位置和大小，让你决定如何处理

-------

#### 系统默认处理

```kotlin
// 默认情况（大多数应用）
setContentView(R.layout.activity_main)

// 系统自动做了这些：
// 1. 内容自动避开状态栏
// 2. 内容自动避开导航栏
// 3. 感觉不到 Insets 的存在
```

#### 什么时候必须关心Insets？

1. 全屏沉浸式体验
   * 内容延伸到状态栏/导航栏下方（如视频播放器）
   * 透明状态栏/导航栏
2. 自定义边距处理
   * FAB按钮要避开导航栏
   * 底部导航栏要贴合屏幕底部
   * 内容要避开刘海屏凹口
3. 键盘处理
   * 聊天界面，输入框跟随键盘上移
   * 登录表单，避免被键盘遮挡
4. 特殊设备适配
   * 折叠屏、刘海屏、挖孔屏

-----

#### Insets的类型

##### 1. System Bars Insets (系统栏)

```
┌─────────────────────┐
│   状态栏 (24dp)      │ ← Status Bar
├─────────────────────┤
│                     │
│                     │
│   你的内容区域        │
│                     │
│                     │
├─────────────────────┤
│   导航栏 (48dp)      │ ← Navigation Bar
└─────────────────────┘
```

##### 2. Display Cutout Insets (刘海/挖孔)

```
		┌──┐  刘海
┌───┘  └─────────┐
│                │
│   内容区域      │
│                │
└────────────────┘
```

##### 3. IME Insets(软键盘)

```
┌────────────────┐
│   内容区域      │
├────────────────┤
│   [输入框]      │
├────────────────┤
│   软键盘        │ ← IME (Input Method Editor)
└────────────────┘
```

##### 4. System Gestures Insets (手势区域)

```
┌────────────────┐
│ ← 边缘滑动手势  │ ← 左边缘
│                │
│                │
│  边缘滑动手势 → │ ← 右边缘
└────────────────┘
```

-----

#### 实战场景

##### 场景1: 默认情况（不需要处理Insets）

```kotlin
// activity_main.xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    
    <TextView
        android:text="Hello World"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content" />
</LinearLayout>

// MainActivity.kt
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // 系统自动处理，内容避开系统栏 ✅
    }
}
```

结果：

```
┌─────────────────┐
│ 状态栏 (自动避开) │
├─────────────────┤
│ Hello World     │ ← 内容从这里开始
│                 │
├─────────────────┤
│ 导航栏 (自动避开) │
└─────────────────┘
```

-----

##### 场景2: 全屏沉浸式（透明状态栏）

需求：状态栏透明，内容延伸到状态栏下方

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 1. 启用 Edge-to-Edge（内容延伸到边缘）
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        setContentView(R.layout.activity_main)
        
        // 2. 设置透明状态栏
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        
        // 3. 手动处理 Insets
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            
            // 给根布局添加 padding，避开系统栏
            view.updatePadding(
                top = systemBars.top,
                bottom = systemBars.bottom
            )
            
            insets
        }
    }
}
```

```xml
<!-- activity_main.xml -->
<LinearLayout
    android:id="@+id/root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/gradient_background">
    <!-- 内容会延伸到状态栏下方，但有 padding 避开 -->
    <TextView
        android:text="Hello World"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content" />
</LinearLayout>
```

结果：

```
┌─────────────────┐
│ [透明状态栏]     │ ← 背景色透过状态栏可见
│ Hello World     │ ← padding 避开了状态栏
│                 │
│                 │
└─────────────────┘
```

-----

##### 场景3: 底部按钮贴合导航栏

需求：FAB按钮要在导航栏上方，不被遮挡

```xml
<!-- activity_main.xml -->
<androidx.coordinatorlayout.widget.CoordinatorLayout
    android:id="@+id/root"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    
    <com.google.android.material.floatingactionbutton.FloatingActionButton
        android:id="@+id/fab"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="bottom|end"
        android:layout_margin="16dp" />
</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)
        
        val fab = findViewById<FloatingActionButton>(R.id.fab)
        
        ViewCompat.setOnApplyWindowInsetsListener(fab) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            
            // FAB 的 bottom margin 要加上导航栏高度
            val layoutParams = view.layoutParams as ViewGroup.MarginLayoutParams
            layoutParams.bottomMargin = 16.dp + systemBars.bottom
            view.layoutParams = layoutParams
            
            insets
        }
    }
}
```

结果：

```
┌─────────────────┐
│                 │
│                 │
│                 │
│            [FAB]│ ← 自动避开导航栏
├─────────────────┤
│   导航栏         │
└─────────────────┘
```

-----

##### 场景4: 聊天界面跟随键盘

需求：输入框跟随键盘上移，不被遮挡

```xml
<!-- activity_chat.xml -->
<androidx.constraintlayout.widget.ConstraintLayout
    android:id="@+id/root"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/messages"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toTopOf="@id/input_layout" />
    
    <LinearLayout
        android:id="@+id/input_layout"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@color/surface"
        app:layout_constraintBottom_toBottomOf="parent">
        
        <EditText
            android:id="@+id/input"
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_height="wrap_content"
            android:hint="输入消息..." />
        
        <ImageButton
            android:id="@+id/send"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:src="@drawable/ic_send" />
    </LinearLayout>
</androidx.constraintlayout.widget.ConstraintLayout>
```

```kotlin
class ChatActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 关键：让窗口不自动调整大小
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        setContentView(R.layout.activity_chat)
        
        val inputLayout = findViewById<LinearLayout>(R.id.input_layout)
        
        // 监听 IME（键盘）Insets
        ViewCompat.setOnApplyWindowInsetsListener(inputLayout) { view, insets ->
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            
            // 输入框跟随键盘上移
            view.updatePadding(bottom = imeInsets.bottom.coerceAtLeast(systemBars.bottom))
            
            insets
        }
    }
}
```

结果（键盘弹出时）：

```
┌─────────────────┐
│ 消息列表         │
│ 自动滚动         │
├─────────────────┤
│ [输入框] [发送]  │ ← 跟随键盘上移
├─────────────────┤
│   软键盘         │
└─────────────────┘
```

-----

#### Compose中的Insets

Compose提供了更简单的API：

```kotlin
// build.gradle.kts
implementation("androidx.compose.foundation:foundation:1.7.5")

// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 启用 Edge-to-Edge
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        setContent {
            MyAppTheme {
                ChatScreen()
            }
        }
    }
}

@Composable
fun ChatScreen() {
    Scaffold(
        // 自动处理 Insets
        contentWindowInsets = WindowInsets.systemBars
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues) // 自动避开系统栏
        ) {
            MessageList(modifier = Modifier.weight(1f))
            
            InputBar(
                modifier = Modifier
                    // 自动跟随键盘
                    .imePadding()
            )
        }
    }
}

@Composable
fun InputBar(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(8.dp)
    ) {
        TextField(
            value = "",
            onValueChange = {},
            modifier = Modifier.weight(1f)
        )
        IconButton(onClick = {}) {
            Icon(Icons.Default.Send, contentDescription = "发送")
        }
    }
}
```

##### Compose Insets 常用Modifier

```kotlin
// 1. 避开系统栏
Modifier.systemBarsPadding()

// 2. 只避开状态栏
Modifier.statusBarsPadding()

// 3. 只避开导航栏
Modifier.navigationBarsPadding()

// 4. 跟随键盘
Modifier.imePadding()

// 5. 避开刘海屏
Modifier.displayCutoutPadding()

// 6. 组合使用
Modifier
    .statusBarsPadding()
    .navigationBarsPadding()
    .imePadding()
```

----

#### 常见问题

##### 1. 为什么我的内容被状态栏遮挡了？

```kotlin
// ❌ 错误：启用了 Edge-to-Edge 但没处理 Insets
WindowCompat.setDecorFitsSystemWindows(window, false)
// 内容会延伸到状态栏下方，但没有 padding

// ✅ 正确：必须手动添加 padding
ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
    val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
    v.updatePadding(top = systemBars.top)
    insets
}
```

##### 2. 为什么键盘弹出后界面没反应？

```kotlin
// ❌ 错误：没有监听 IME Insets
// 或者 AndroidManifest.xml 中设置了：
android:windowSoftInputMode="adjustResize"  // 这个已过时

// ✅ 正确：
WindowCompat.setDecorFitsSystemWindows(window, false)
ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
    val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
    v.updatePadding(bottom = ime.bottom)
    insets
}
```

##### 3. 我需要在每个View上设置Insets Listener吗？

```kotlin
// ❌ 不需要！Insets 会自动分发给子 View

// ✅ 通常只在根布局设置一次
ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, insets ->
    // 处理 Insets
    insets  // 返回 insets，让子 View 也能收到
}
```

-----

#### 设备适配示例

##### 刘海屏适配

```kotlin
// 获取刘海区域
val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())

// 头部 Banner 避开刘海
headerView.updatePadding(
    left = cutout.left,
    top = cutout.top,
    right = cutout.right
)
```

##### 折叠屏适配

```kotlin
// 获取铰链区域（需要 Jetpack WindowManager）
implementation("androidx.window:window:1.3.0")

WindowInfoTracker.getOrCreate(this)
    .windowLayoutInfo(this)
    .collect { layoutInfo ->
        layoutInfo.displayFeatures.forEach { feature ->
            if (feature is FoldingFeature) {
                // 处理折叠屏逻辑
            }
        }
    }
```

----

##### 关键API速查

```kotlin
// 启用 Edge-to-Edge
WindowCompat.setDecorFitsSystemWindows(window, false)

// 监听 Insets
ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
    val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
    val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
    // 处理...
    insets
}

// Compose
Modifier.systemBarsPadding()
Modifier.imePadding()
```

