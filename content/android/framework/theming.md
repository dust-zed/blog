+++
date = '2025-10-17T11:24:19+08:00'
draft = true
title = 'Android主题系统指南'
categories = ['android']
tags = ['Material Design', 'Theming', 'UI']
description = "Android 12+ Material Design 3 (Material You) 主题系统详解，Dynamic Color 动态取色原理与 Compose/View 主题适配指南。"
slug = "android-theming"
image = ""

+++

## Material Design3(Material You)

### 核心概念

Material Design3 (MD3)是Google在Android 12+引入的设计系统，核心特性：

* **Dynamic Color**：根据壁纸自动生成主题色
* 更圆润的组件： 更大的圆角半径
* 色彩角色系统：40+个语义化颜色槽位
* 个性化：让每个用户的应用看起来独一无二

### 版本要求

```kotlin
// Material 3
implementation("com.google.android.material:material:1.12.0")

// Compose Material 3
implementation("androidx.compose.material3:material3:1.3.1")
```

-------

## 主题系统架构

### 三层结构

```
Material Theme (Material 3)
    ↓
Application Theme (你的应用主题)
    ↓
Component Styles (组件样式)
```

### 色彩角色系统

Material 3 定义了5大色彩组：

#### 1. Primary（主色）

```xml
<!-- 最重要的品牌色，用于主要操作 -->
<attr name="colorPrimary" />          <!-- 主色 -->
<attr name="colorOnPrimary" />        <!-- 主色上的文字/图标 -->
<attr name="colorPrimaryContainer" /> <!-- 主色容器 -->
<attr name="colorOnPrimaryContainer" /> <!-- 容器上的内容 -->
```

#### 2. Secondary(次要色)

```xml
<!-- 次要操作，辅助主色 -->
<attr name="colorSecondary" />
<attr name="colorOnSecondary" />
<attr name="colorSecondaryContainer" />
<attr name="colorOnSecondaryContainer" />
```

#### 3. Tertiary(第三色)

```xml
<!-- 用于强调或对比 -->
<attr name="colorTertiary" />
<attr name="colorOnTertiary" />
<attr name="colorTertiaryContainer" />
<attr name="colorOnTertiaryContainer" />
```

#### 4. Error（错误色）

```xml
<!-- 错误状态 -->
<attr name="colorError" />
<attr name="colorOnError" />
<attr name="colorErrorContainer" />
<attr name="colorOnErrorContainer" />
```

#### 5. Surface & Background(表面和背景)

```xml
<!-- 背景和表面 -->
<attr name="colorSurface" />          <!-- 卡片、对话框背景 -->
<attr name="colorOnSurface" />        <!-- 表面上的文字 -->
<attr name="colorSurfaceVariant" />   <!-- 表面变体 -->
<attr name="colorOnSurfaceVariant" /> <!-- 次要文字 -->
<attr name="colorBackground" />       <!-- 应用背景 -->
<attr name="colorOnBackground" />     <!-- 背景上的内容 -->
```

#### 6. Outline & Other

```xml
<!-- 边框和其他 -->
<attr name="colorOutline" />          <!-- 分割线、边框 -->
<attr name="colorOutlineVariant" />   <!-- 更弱的边框 -->
<attr name="colorSurfaceTint" />      <!-- 表面着色（高度感） -->
```

--------

## Dynamic Color (动态配色)

所谓**Dynamic Color**：Android 12+系统会从用户壁纸提取颜色，生成整套主题色，实现”千人千面“。

### 实现方式

#### 方式一：使用系统提供的主题

```xml
<!-- res/values/themes.xml -->
<resources>
    <!-- Android 12+ 会自动应用 Dynamic Color -->
    <style name="Theme.MyApp" parent="Theme.Material3.DayNight">
        <!-- 可选：覆盖特定颜色 -->
        <item name="colorPrimary">@color/custom_primary</item>
    </style>
</resources>

<!-- res/values-v31/themes.xml (Android 12+ 专用) -->
<resources>
    <!-- 使用 DynamicColors 主题 -->
    <style name="Theme.MyApp" parent="Theme.Material3.DayNight.NoActionBar">
        <!-- 系统自动应用壁纸颜色，无需定义 colorPrimary 等 -->
    </style>
</resources>
```

#### 方式二：代码启用（更灵活）

```kotlin
// Application 或 Activity
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // 全局启用 Dynamic Color
        DynamicColors.applyToActivitiesIfAvailable(this)
    }
}

// 单个 Activity 启用
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 只在此 Activity 启用
        DynamicColors.applyIfAvailable(this)
    }
}
```

#### 方式三：提供回退方案

```kotlin
// 支持用户选择是否启用
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        if (supportsDynamicColor() && userPrefersDynamicColor()) {
            DynamicColors.applyToActivitiesIfAvailable(this)
        }
    }
    
    private fun supportsDynamicColor(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S // Android 12+
    }
}
```

### 自定义Dynamic Color

```xml
<!-- 即使启用 Dynamic Color，也可覆盖特定颜色 -->
<style name="Theme.MyApp" parent="Theme.Material3.DayNight">
    <!-- 强制使用品牌色作为 Primary -->
    <item name="colorPrimary">@color/brand_color</item>
    <!-- 其他颜色让系统自动生成 -->
</style>
```

------

## 传统View主题

### 完整主题配置

```xml
<!-- res/values/colors.xml -->
<resources>
    <!-- Light Mode Colors -->
    <color name="md_theme_light_primary">#6750A4</color>
    <color name="md_theme_light_onPrimary">#FFFFFF</color>
    <color name="md_theme_light_primaryContainer">#EADDFF</color>
    <color name="md_theme_light_onPrimaryContainer">#21005D</color>
    
    <color name="md_theme_light_secondary">#625B71</color>
    <color name="md_theme_light_onSecondary">#FFFFFF</color>
    <color name="md_theme_light_secondaryContainer">#E8DEF8</color>
    <color name="md_theme_light_onSecondaryContainer">#1D192B</color>
    
    <color name="md_theme_light_surface">#FFFBFE</color>
    <color name="md_theme_light_onSurface">#1C1B1F</color>
    <color name="md_theme_light_background">#FFFBFE</color>
    
    <!-- Dark Mode Colors -->
    <color name="md_theme_dark_primary">#D0BCFF</color>
    <color name="md_theme_dark_onPrimary">#381E72</color>
    <!-- ... 其他深色模式颜色 -->
</resources>

<!-- res/values/themes.xml -->
<resources>
    <style name="Theme.MyApp" parent="Theme.Material3.DayNight.NoActionBar">
        <!-- Primary -->
        <item name="colorPrimary">@color/md_theme_light_primary</item>
        <item name="colorOnPrimary">@color/md_theme_light_onPrimary</item>
        <item name="colorPrimaryContainer">@color/md_theme_light_primaryContainer</item>
        <item name="colorOnPrimaryContainer">@color/md_theme_light_onPrimaryContainer</item>
        
        <!-- Secondary -->
        <item name="colorSecondary">@color/md_theme_light_secondary</item>
        <item name="colorOnSecondary">@color/md_theme_light_onSecondary</item>
        <item name="colorSecondaryContainer">@color/md_theme_light_secondaryContainer</item>
        <item name="colorOnSecondaryContainer">@color/md_theme_light_onSecondaryContainer</item>
        
        <!-- Surface & Background -->
        <item name="colorSurface">@color/md_theme_light_surface</item>
        <item name="colorOnSurface">@color/md_theme_light_onSurface</item>
        <item name="android:colorBackground">@color/md_theme_light_background</item>
        
        <!-- 状态栏和导航栏 -->
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@color/md_theme_light_surface</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        
        <!-- 形状（圆角） -->
        <item name="shapeAppearanceSmallComponent">@style/ShapeAppearance.MyApp.SmallComponent</item>
        <item name="shapeAppearanceMediumComponent">@style/ShapeAppearance.MyApp.MediumComponent</item>
        <item name="shapeAppearanceLargeComponent">@style/ShapeAppearance.MyApp.LargeComponent</item>
    </style>
    
    <!-- 自定义形状 -->
    <style name="ShapeAppearance.MyApp.SmallComponent" parent="ShapeAppearance.Material3.SmallComponent">
        <item name="cornerFamily">rounded</item>
        <item name="cornerSize">8dp</item>
    </style>
    
    <style name="ShapeAppearance.MyApp.MediumComponent" parent="ShapeAppearance.Material3.MediumComponent">
        <item name="cornerSize">12dp</item>
    </style>
    
    <style name="ShapeAppearance.MyApp.LargeComponent" parent="ShapeAppearance.Material3.LargeComponent">
        <item name="cornerSize">16dp</item>
    </style>
</resources>

<!-- res/values-night/colors.xml -->
<resources>
    <!-- 深色模式的颜色会自动被使用 -->
    <color name="md_theme_light_primary">@color/md_theme_dark_primary</color>
    <color name="md_theme_light_onPrimary">@color/md_theme_dark_onPrimary</color>
    <!-- ... -->
</resources>
```

### 在布局中使用

```xml
<!-- res/layout/activity_main.xml -->
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="?attr/colorBackground">
    
    <!-- 使用主题颜色 -->
    <com.google.android.material.button.MaterialButton
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Primary Button"
        android:backgroundTint="?attr/colorPrimary"
        android:textColor="?attr/colorOnPrimary" />
    
    <!-- 次要按钮 -->
    <com.google.android.material.button.MaterialButton
        style="@style/Widget.Material3.Button.TonalButton"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Secondary Button" />
    
    <!-- 卡片使用 Surface 色 -->
    <com.google.android.material.card.MaterialCardView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:cardBackgroundColor="?attr/colorSurface"
        app:cardElevation="2dp">
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Card Content"
            android:textColor="?attr/colorOnSurface" />
    </com.google.android.material.card.MaterialCardView>
</LinearLayout>
```

------

## Compose主题

### 完整Compose主题实现

```kotlin
// ui/theme/Color.kt
package com.example.myapp.ui.theme

import androidx.compose.ui.graphics.Color

// Light Theme Colors
val md_theme_light_primary = Color(0xFF6750A4)
val md_theme_light_onPrimary = Color(0xFFFFFFFF)
val md_theme_light_primaryContainer = Color(0xFFEADDFF)
val md_theme_light_onPrimaryContainer = Color(0xFF21005D)

val md_theme_light_secondary = Color(0xFF625B71)
val md_theme_light_onSecondary = Color(0xFFFFFFFF)
val md_theme_light_secondaryContainer = Color(0xFFE8DEF8)
val md_theme_light_onSecondaryContainer = Color(0xFF1D192B)

val md_theme_light_surface = Color(0xFFFFFBFE)
val md_theme_light_onSurface = Color(0xFF1C1B1F)
val md_theme_light_background = Color(0xFFFFFBFE)

// Dark Theme Colors
val md_theme_dark_primary = Color(0xFFD0BCFF)
val md_theme_dark_onPrimary = Color(0xFF381E72)
val md_theme_dark_primaryContainer = Color(0xFF4F378B)
val md_theme_dark_onPrimaryContainer = Color(0xFFEADDFF)

val md_theme_dark_secondary = Color(0xFFCCC2DC)
val md_theme_dark_onSecondary = Color(0xFF332D41)
val md_theme_dark_surface = Color(0xFF1C1B1F)
val md_theme_dark_onSurface = Color(0xFFE6E1E5)
val md_theme_dark_background = Color(0xFF1C1B1F)


// ui/theme/Theme.kt
package com.example.myapp.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = md_theme_light_primary,
    onPrimary = md_theme_light_onPrimary,
    primaryContainer = md_theme_light_primaryContainer,
    onPrimaryContainer = md_theme_light_onPrimaryContainer,
    
    secondary = md_theme_light_secondary,
    onSecondary = md_theme_light_onSecondary,
    secondaryContainer = md_theme_light_secondaryContainer,
    onSecondaryContainer = md_theme_light_onSecondaryContainer,
    
    surface = md_theme_light_surface,
    onSurface = md_theme_light_onSurface,
    background = md_theme_light_background
)

private val DarkColorScheme = darkColorScheme(
    primary = md_theme_dark_primary,
    onPrimary = md_theme_dark_onPrimary,
    primaryContainer = md_theme_dark_primaryContainer,
    onPrimaryContainer = md_theme_dark_onPrimaryContainer,
    
    secondary = md_theme_dark_secondary,
    onSecondary = md_theme_dark_onSecondary,
    surface = md_theme_dark_surface,
    onSurface = md_theme_dark_onSurface,
    background = md_theme_dark_background
)

@Composable
fun MyAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // 启用 Dynamic Color（Android 12+）
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        // Android 12+ 支持 Dynamic Color
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) 
            else dynamicLightColorScheme(context)
        }
        // 回退到静态主题
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    
    // 设置状态栏颜色
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}


// ui/theme/Type.kt
package com.example.myapp.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Typography = Typography(
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)


// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppContent()
                }
            }
        }
    }
}

@Composable
fun AppContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // 使用主题颜色
        Button(
            onClick = { },
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            )
        ) {
            Text("Primary Button")
        }
        
        // 使用 Surface 卡片
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Text(
                text = "Card Content",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}
```

------

## 深色模式

完整实现方法

### 1.系统跟随

```kotlin
// 使用 DayNight 主题
<style name="Theme.MyApp" parent="Theme.Material3.DayNight">
    <!-- 自动根据系统设置切换 -->
</style>
```

### 2. 手动切换

```kotlin
// 提供用户选择
class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 获取当前模式
        val currentMode = AppCompatDelegate.getDefaultNightMode()
        
        // 切换模式
        when (userSelection) {
            "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            "system" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        }
    }
}

// Compose 中切换
@Composable
fun ThemeSettings() {
    var darkMode by remember { mutableStateOf(false) }
    
    MyAppTheme(darkTheme = darkMode) {
        Switch(
            checked = darkMode,
            onCheckedChange = { darkMode = it }
        )
    }
}
```

### 3. 深色模式注意事项

```xml
<!-- 为深色模式提供专用资源 -->
<!-- res/values-night/colors.xml -->
<color name="window_background">#121212</color>

<!-- res/drawable-night/ic_logo.xml -->
<!-- 深色模式下使用不同的图标 -->

<!-- res/values-night/themes.xml -->
<style name="Theme.MyApp" parent="Theme.Material3.DayNight">
    <item name="android:windowLightStatusBar">false</item>
</style>
```

-----

## 最佳实践

### 1. 使用Material 3

```kotlin
// ✅ 使用 M3
   implementation("com.google.android.material:material:1.12.0")
   parent="Theme.Material3.DayNight"
   
   // ❌ 不要用旧版本
   parent="Theme.MaterialComponents.DayNight"
```

### 2. 启用Dynamic Color

```kotlin
// ✅ 让应用更个性化
   DynamicColors.applyToActivitiesIfAvailable(this)
```

### 3. 使用语义化颜色

```kotlin
// ✅ 使用主题属性
   android:textColor="?attr/colorOnSurface"
   
   // ❌ 不要硬编码
   android:textColor="#000000"
```

### 4. 提供深色模式

```kotlin
// ✅ 支持系统深色模式
   parent="Theme.Material3.DayNight"
   
   // ❌ 只支持亮色
   parent="Theme.Material3.Light"
```

---------
