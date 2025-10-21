+++
date = '2025-10-21T00:05:46+08:00'
draft = false
title = 'Android四大组件'
categories = ['android-develop']

+++

#### Activity

##### 生命周期

```
┌──────────────┐
│  Activity    │
│  Created     │
└──────────────┘
       ↓
   onCreate()  ← 创建，初始化变量、加载布局
       ↓
   onStart()   ← 可见但不可交互
       ↓
   onResume()  ← 可见且可交互（前台）
       ↓
   [运行中]
       ↓
   onPause()   ← 部分可见（被遮挡，如对话框）
       ↓
   onStop()    ← 完全不可见（切到后台）
       ↓
   onDestroy() ← 销毁，释放资源
       ↓
   [结束]
```

-----

##### 状态保存与恢复

###### 为什么需要保存状态？

```
用户正在填写表单
  ↓
突然来电话 → Activity 被销毁
  ↓
电话结束返回 → Activity 重新创建
  ↓
表单内容丢失了！❌
```

##### 保存状态

```kotlin
class FormActivity : AppCompatActivity() {
    private var userName: String = ""
    private var age: Int = 0
    
    // 保存状态（系统杀死 Activity 前调用）
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        
        outState.putString("userName", userName)
        outState.putInt("age", age)
        
        Log.d("State", "状态已保存")
    }
    
    // 恢复状态
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_form)
        
        // 方式 1: 在 onCreate 中恢复
        if (savedInstanceState != null) {
            userName = savedInstanceState.getString("userName", "")
            age = savedInstanceState.getInt("age", 0)
            Log.d("State", "状态已恢复: $userName, $age")
        }
    }
    
    // 方式 2: 在 onRestoreInstanceState 中恢复
    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        
        userName = savedInstanceState.getString("userName", "")
        age = savedInstanceState.getInt("age", 0)
    }
}
```

--------

##### 启动模式

###### 4种启动模式

```kotlin
<!-- AndroidManifest.xml -->
<activity
    android:name=".MainActivity"
    android:launchMode="standard" />
```

###### 1. standard

```
每次启动都创建新实例

MainActivity → MainActivity → MainActivity
    ↑              ↑              ↑
  实例 1        实例 2         实例 3

返回栈: [实例3, 实例2, 实例1]
```

###### 2. singleTop

```
如果在栈顶，复用；否则创建新实例

场景 1: MainActivity 在栈顶
MainActivity (栈顶) → 启动 MainActivity
    ↓
调用 onNewIntent() 复用，不创建新实例

场景 2: MainActivity 不在栈顶
MainActivity → DetailActivity → 启动 MainActivity
    ↓
创建新实例: [MainActivity(新), DetailActivity, MainActivity(旧)]
```

用途：通知栏点击、搜索结果页

```kotlin
class SearchActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent)
    }
    
    // singleTop 模式下，再次启动时调用
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)  // 更新 intent
        handleIntent(intent)
    }
    
    private fun handleIntent(intent: Intent) {
        val query = intent.getStringExtra("query")
        // 搜索...
    }
}
```

###### 3. singleTask

```
整个任务栈中只有一个实例

场景 1: 不存在
TaskA: [DetailActivity, MainActivity]
启动 ProfileActivity (singleTask)
  ↓
TaskA: [ProfileActivity, DetailActivity, MainActivity]

场景 2: 已存在
TaskA: [DetailActivity, ProfileActivity, MainActivity]
启动 ProfileActivity
  ↓
清除其上所有 Activity，ProfileActivity 移到栈顶
TaskA: [ProfileActivity, MainActivity]
DetailActivity 被销毁！
```

用途：主页、登录页

###### 4. singleInstance

```
独占一个任务栈，整个系统中只有一个实例

TaskA: [DetailActivity, MainActivity]
启动 VideoActivity (singleInstance)
  ↓
TaskA: [DetailActivity, MainActivity]
TaskB: [VideoActivity]  ← 独立的任务栈

从 VideoActivity 启动其他 Activity
  ↓
TaskA: [OtherActivity, DetailActivity, MainActivity]
TaskB: [VideoActivity]  ← 仍然独占
```

用途：视频通话、闹钟

------

##### Intent Flags

```kotlin
// FLAG_ACTIVITY_NEW_TASK: 新任务栈
val intent = Intent(this, MainActivity::class.java)
intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
startActivity(intent)

// FLAG_ACTIVITY_CLEAR_TOP: 清除其上所有 Activity
// 常用于"返回主页"
val intent = Intent(this, MainActivity::class.java)
intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
startActivity(intent)

// FLAG_ACTIVITY_SINGLE_TOP: 等同于 singleTop 模式
intent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP

// 组合使用（清除栈并启动）
intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
```

-----

#### Service

##### 什么是Service？

Service = 在后台执行长时间运行操作的组件，没有用户界面

```
前台 Activity: 用户正在浏览商品
后台 Service: 同时下载文件、播放音乐、同步数据
```

-----

##### Service的三种类型

###### 1. 前台服务（Foreground Service）

必须显示通知，用户可见

```
┌─────────────────┐
│ 🔔 通知栏        │
│ 正在播放音乐... │ ← 前台服务的通知
├─────────────────┤
│   应用界面      │
└─────────────────┘
```

用途：音乐播放、导航、文件下载

###### 2. 后台服务（Background Service）

用户不可见，但会被系统限制；Android 8.0+严格限制后台服务

用途：数据同步，日志上传（但推荐用WorkManager）

###### 3. 绑定服务（Bound Service）

与组件绑定，提供客户端-服务器接口

```
Activity ←───绑定───→ Service
   ↓                    ↓
调用方法             提供方法
```

用途：进程间通信（IPC）、音乐播放器控制

----

#### Service生命周期

##### 启动服务（Started Service）

```
startService()
     ↓
 onCreate()     ← 首次创建时调用（只调用一次）
     ↓
onStartCommand() ← 每次 startService() 都调用
     ↓
 [运行中]
     ↓
 onDestroy()    ← 服务销毁
```

##### 绑定服务（Bound Service）

```
bindService()
     ↓
 onCreate()     ← 首次创建时调用
     ↓
  onBind()      ← 返回 IBinder 对象
     ↓
 [绑定中]
     ↓
unbindService()
     ↓
 onUnbind()     ← 所有客户端解绑后调用
     ↓
 onDestroy()
```

##### 混合模式（既启动又绑定）

```
startService() + bindService()
     ↓
 onCreate()
     ↓
onStartCommand() + onBind()
     ↓
 [运行并绑定]
     ↓
unbindService() ← 解绑后仍然运行
     ↓
stopService() or stopSelf()
     ↓
 onDestroy()
```

-------

#### 启动服务（Started Service）

##### 基本实现

```kotlin
// MyService.kt
class MyService : Service() {
    
    private val TAG = "MyService"
    
    // 1. 创建时调用（只调用一次）
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service 创建")
    }
    
    // 2. 每次 startService() 都调用
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service 启动")
        
        // 获取传递的数据
        val data = intent?.getStringExtra("data")
        
        // 执行后台任务
        doWork()
        
        // 返回值决定系统杀死服务后的行为
        return START_STICKY
    }
    
    // 3. 销毁时调用
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service 销毁")
    }
    
    // 必须实现，但启动服务不需要绑定
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun doWork() {
        // ⚠️ 不要在主线程做耗时操作
        Thread {
            // 执行后台任务
            Thread.sleep(5000)
            Log.d(TAG, "任务完成")
            stopSelf()  // 任务完成后停止服务
        }.start()
    }
}
```

##### 启动和停止服务

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    
    // 启动服务
    fun startMyService() {
        val intent = Intent(this, MyService::class.java)
        intent.putExtra("data", "Hello Service")
        
        // Android 8.0+ 如果是前台服务，使用 startForegroundService
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
    
    // 停止服务
    fun stopMyService() {
        val intent = Intent(this, MyService::class.java)
        stopService(intent)
    }
}
```

##### onStartCommand返回值

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    
    return when {
        // START_STICKY: 系统杀死后重启服务，但 intent 为 null
        // 适用：音乐播放器
        true -> START_STICKY
        
        // START_NOT_STICKY: 系统杀死后不重启
        // 适用：一次性任务
        false -> START_NOT_STICKY
        
        // START_REDELIVER_INTENT: 系统杀死后重启，重新传递 intent
        // 适用：需要保证任务完成（如下载）
        else -> START_REDELIVER_INTENT
    }
}
```

-----

#### 前台服务

**Android 8.0+严格限制后台服务：**

* 应用进入后台几分钟后，系统会停止后台服务
* 前台服务不会被限制，但必须显示通知

##### 实现前台服务

```kotlin
class MusicService : Service() {
    
    private val CHANNEL_ID = "music_channel"
    private val NOTIFICATION_ID = 1
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 创建通知
        val notification = createNotification()
        
        // ⚠️ 必须在 5 秒内调用 startForeground，否则 ANR
        startForeground(NOTIFICATION_ID, notification)
        
        // 播放音乐...
        playMusic()
        
        return START_STICKY
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "音乐播放",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "音乐播放服务"
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        // 点击通知打开 Activity
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("正在播放")
            .setContentText("歌曲名称 - 艺术家")
            .setSmallIcon(R.drawable.ic_music)
            .setContentIntent(pendingIntent)
            .setOngoing(true)  // 不可滑动删除
            .addAction(R.drawable.ic_pause, "暂停", createPauseIntent())
            .addAction(R.drawable.ic_next, "下一首", createNextIntent())
            .build()
    }
    
    private fun createPauseIntent(): PendingIntent {
        val intent = Intent(this, MusicService::class.java).apply {
            action = "ACTION_PAUSE"
        }
        return PendingIntent.getService(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
    }
    
    private fun createNextIntent(): PendingIntent {
        val intent = Intent(this, MusicService::class.java).apply {
            action = "ACTION_NEXT"
        }
        return PendingIntent.getService(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
    }
    
    private fun playMusic() {
        // 播放逻辑...
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
```

##### 前台服务类型（Android 14+）

```xml
<!-- AndroidManifest.xml -->
<manifest>
    <!-- 声明前台服务类型 -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    
    <application>
        <service
            android:name=".MusicService"
            android:foregroundServiceType="mediaPlayback" />
    </application>
</manifest>
```

**前台服务类型**

* `camera` - 相机
* `connectedDevice` - 连接设备
* `dataSync` - 数据同步
* `location` - 位置
* `mediaPlayback` - 媒体播放
* `mediaProjection` - 屏幕录制
* `microphone` - 麦克风
* `phoneCall` - 电话
* `remoteMessaging` - 远程消息
* `shortService` - 短时服务
* `specialUse` - 特殊用途

----------

#### 绑定服务

##### 使用场景

```
Activity 需要：
- 调用 Service 的方法
- 获取 Service 的数据
- 监听 Service 的状态

Example: 音乐播放器控制
Activity: 播放/暂停/切歌
Service: 执行实际操作
```

##### 实现绑定服务

```kotlin
// MusicPlayerService.kt
class MusicPlayerService : Service() {
    
    // 1. 定义 Binder（本地服务）
    inner class MusicBinder : Binder() {
        fun getService(): MusicPlayerService = this@MusicPlayerService
    }
    
    private val binder = MusicBinder()
    
    // 2. 返回 Binder
    override fun onBind(intent: Intent?): IBinder = binder
    
    // 3. 提供公共方法供客户端调用
    fun play() {
        Log.d("Music", "播放音乐")
    }
    
    fun pause() {
        Log.d("Music", "暂停音乐")
    }
    
    fun getCurrentPosition(): Int {
        return 0  // 返回当前播放位置
    }
}
```

##### 绑定服务

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    
    private var musicService: MusicPlayerService? = null
    private var isBound = false
    
    // 1. 定义 ServiceConnection
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            // 服务连接成功
            val binder = service as MusicPlayerService.MusicBinder
            musicService = binder.getService()
            isBound = true
            
            Log.d("Bind", "服务已连接")
        }
        
        override fun onServiceDisconnected(name: ComponentName?) {
            // 服务意外断开（如崩溃）
            musicService = null
            isBound = false
            
            Log.d("Bind", "服务已断开")
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 2. 绑定服务
        val intent = Intent(this, MusicPlayerService::class.java)
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }
    
    // 3. 调用服务方法
    fun onPlayClick() {
        if (isBound) {
            musicService?.play()
        }
    }
    
    fun onPauseClick() {
        if (isBound) {
            musicService?.pause()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // 4. 解绑服务
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
    }
}
```

##### AIDL(跨进程通信)

用于不同应用之间的通信

```aidl
// IMusicService.aidl
package com.example.myapp;

interface IMusicService {
    void play();
    void pause();
    int getCurrentPosition();
}
```

```kotlin
// MusicPlayerService.kt
class MusicPlayerService : Service() {
    
    // 实现 AIDL 接口
    private val binder = object : IMusicService.Stub() {
        override fun play() {
            // 播放逻辑
        }
        
        override fun pause() {
            // 暂停逻辑
        }
        
        override fun getCurrentPosition(): Int {
            return 0
        }
    }
    
    override fun onBind(intent: Intent?): IBinder = binder
}
```

```kotlin
// 客户端 Activity
class MainActivity : AppCompatActivity() {
    
    private var musicService: IMusicService? = null
    
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            musicService = IMusicService.Stub.asInterface(service)
        }
        
        override fun onServiceDisconnected(name: ComponentName?) {
            musicService = null
        }
    }
    
    fun onPlayClick() {
        musicService?.play()
    }
}
```

-----

#### Service的限制（Android 8.0+）

##### 后台执行限制

```
应用进入后台几分钟后：
- stopService() 后台服务被停止
- WorkManager 继续执行（推荐）
```

##### 解决方案

###### 1. 使用前台服务

```kotlin
// 音乐播放、导航、下载
startForegroundService(intent)
service.startForeground(NOTIFICATION_ID, notification)
```

###### 2. 使用workManger

```kotlin
// 数据同步、日志上传
val workRequest = OneTimeWorkRequestBuilder<MyWorker>().build()
WorkManager.getInstance(context).enqueue(workRequest)
```

-----

#### BroadcastReceiver

**BroadcastReceiver** = 接收系统或应用发出的广播消息

```
发送者 (Sender)              接收者 (Receiver)
    ↓                            ↓
发送广播 → [Android System] → BroadcastReceiver
   (Intent)                    (onReceive)
```

-----

#### 广播的类型

##### 1. 系统广播（System Broadcast）

系统发出的广播

```kotlin
// 常见系统广播
Intent.ACTION_BOOT_COMPLETED    // 开机完成
Intent.ACTION_BATTERY_LOW       // 电量低
Intent.ACTION_POWER_CONNECTED   // 充电器连接
Intent.ACTION_SCREEN_ON         // 屏幕开启
Intent.ACTION_SCREEN_OFF        // 屏幕关闭
Intent.ACTION_TIMEZONE_CHANGED  // 时区改变
Intent.ACTION_LOCALE_CHANGED    // 语言改变
```

##### 应用内广播（Local Broadcast）

只在应用内传递，更安全

```kotlin
// 使用 LocalBroadcastManager（已废弃）
// 推荐使用 LiveData 或事件总线
```

##### 3. 自定义广播（Custom Broadcast）

应用自己定义的广播

```kotlin
const val ACTION_CUSTOM = "com.example.ACTION_CUSTOM"
```

-------

#### 注册广播接收器

##### 方式1: 静态注册（Manifest）

应用未运行时也能接收广播

```xml
<!-- AndroidManifest.xml -->
<manifest>
    <!-- 需要的权限 -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    
    <application>
        <!-- 注册接收器 -->
        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="false">
            
            <!-- 声明要接收的广播 -->
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

```kotlin
// BootReceiver.kt
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.d("Boot", "设备启动完成")
                // 启动服务或执行初始化
            }
        }
    }
}
```

**Android 8.0+**限制：

* 大部分系统广播不能静态注册
* 只有少数例外（如`BOOT_COMPLETED`、`LOCALE_CHANGED`）

##### 方式2:动态注册

应用运行时注册，更灵活

```kotlin
class MainActivity : AppCompatActivity() {
    
    // 1. 创建接收器
    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_BATTERY_LOW -> {
                    Toast.makeText(context, "电量低", Toast.LENGTH_SHORT).show()
                }
                Intent.ACTION_BATTERY_OKAY -> {
                    Toast.makeText(context, "电量恢复", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 2. 注册接收器
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_BATTERY_LOW)
            addAction(Intent.ACTION_BATTERY_OKAY)
        }
        registerReceiver(batteryReceiver, filter)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // 3. 必须取消注册，避免内存泄漏
        unregisterReceiver(batteryReceiver)
    }
}
```

**Android13+**动态注册

```kotlin
// Android 13+ 需要在运行时请求权限
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    registerReceiver(
        receiver,
        filter,
        Context.RECEIVER_NOT_EXPORTED  // 或 RECEIVER_EXPORTED
    )
} else {
    registerReceiver(receiver, filter)
}
```

-----

#### 发送广播

##### 1. 标准广播（Normal Broadcast）

所有接收器几乎同时收到

```kotlin
// 发送广播
val intent = Intent("com.example.ACTION_CUSTOM")
intent.putExtra("data", "Hello Broadcast")
sendBroadcast(intent)
```

```kotlin
// 接收广播
class MyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val data = intent.getStringExtra("data")
        Log.d("Receiver", "收到: $data")
    }
}
```

##### 2. 有序广播（Ordered Broadcast）

按优先级一次传递，可拦截

```kotlin
// 发送有序广播
val intent = Intent("com.example.ACTION_ORDERED")
sendOrderedBroadcast(intent, null)
```

```kotlin
<!-- 设置优先级 -->
<receiver android:name=".HighPriorityReceiver">
    <intent-filter android:priority="1000">
        <action android:name="com.example.ACTION_ORDERED" />
```

------

#### ContentProvider

**ContentProvider** = 跨应用共享数据的标准接口

```
应用 A (数据提供者)         应用 B (数据使用者)
    ↓                           ↓
ContentProvider ←─────URI────→ ContentResolver
    ↓
数据库/文件/网络
```

-------

#### ContentProvider的作用

##### 1. 跨应用数据共享

```
联系人应用 → ContentProvider → 其他应用读取联系人
相册应用 → ContentProvider → 其他应用读取图片
```

##### 2. 统一数据访问接口

```
不管数据存在哪里（数据库/文件/网络）
都通过统一的 URI 访问

content://com.example.provider/users/1
content://com.android.contacts/contacts/1
```

##### 3. 数据安全控制

```kotlin
可以控制：
- 哪些应用可以访问
- 哪些数据可以访问（读/写权限）
- 数据访问的粒度
```

-----

#### ContentProvider架构

**URI**结构

```
content://authority/path/id
   ↑        ↑       ↑    ↑
  协议    标识符   路径  ID

示例：
content://com.example.provider/users
content://com.example.provider/users/123
content://com.android.contacts/contacts
content://media/external/images/media
```

组件关系

```
应用 A                      应用 B
  ↓                          ↓
ContentProvider          ContentResolver
  ↓                          ↓
query()                    query()
insert()                   insert()
update()                   update()
delete()                   delete()
  ↓
实际数据存储 (SQLite/文件等)
```

------

#### 创建ContentProvider

##### 步骤1:定义数据模型

```kotlin
// Contract 类（定义 URI 和列名）
object UserContract {
    const val AUTHORITY = "com.example.provider"
    val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/users")
    
    object Columns {
        const val ID = "_id"
        const val NAME = "name"
        const val EMAIL = "email"
        const val AGE = "age"
    }
}
```

##### 步骤2：创建数据库Helper(可选)

```kotlin
class DatabaseHelper(context: Context) : SQLiteOpenHelper(
    context,
    "users.db",
    null,
    1
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE users (
                _id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                age INTEGER
            )
        """)
    }
    
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS users")
        onCreate(db)
    }
}
```

##### 实现ContentProvider

```kotlin
class UserProvider : ContentProvider() {
    
    private lateinit var dbHelper: DatabaseHelper
    private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
        addURI(UserContract.AUTHORITY, "users", USERS)
        addURI(UserContract.AUTHORITY, "users/#", USER_ID)
    }
    
    companion object {
        private const val USERS = 1
        private const val USER_ID = 2
    }
    
    // 1. 初始化（在应用启动时调用）
    override fun onCreate(): Boolean {
        dbHelper = DatabaseHelper(context!!)
        return true
    }
    
    // 2. 查询数据
    override fun query(
        uri: Uri,
        projection: Array<String>?,
        selection: String?,
        selectionArgs: Array<String>?,
        sortOrder: String?
    ): Cursor? {
        val db = dbHelper.readableDatabase
        
        return when (uriMatcher.match(uri)) {
            USERS -> {
                // 查询所有用户
                db.query(
                    "users",
                    projection,
                    selection,
                    selectionArgs,
                    null,
                    null,
                    sortOrder
                )
            }
            USER_ID -> {
                // 查询指定 ID 的用户
                val id = uri.lastPathSegment
                db.query(
                    "users",
                    projection,
                    "${UserContract.Columns.ID} = ?",
                    arrayOf(id),
                    null,
                    null,
                    sortOrder
                )
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }
    
    // 3. 插入数据
    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        val db = dbHelper.writableDatabase
        
        return when (uriMatcher.match(uri)) {
            USERS -> {
                val id = db.insert("users", null, values)
                if (id > 0) {
                    val newUri = ContentUris.withAppendedId(UserContract.CONTENT_URI, id)
                    // 通知数据变化
                    context?.contentResolver?.notifyChange(newUri, null)
                    newUri
                } else {
                    null
                }
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }
    
    // 4. 更新数据
    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<String>?
    ): Int {
        val db = dbHelper.writableDatabase
        
        val count = when (uriMatcher.match(uri)) {
            USERS -> {
                db.update("users", values, selection, selectionArgs)
            }
            USER_ID -> {
                val id = uri.lastPathSegment
                db.update(
                    "users",
                    values,
                    "${UserContract.Columns.ID} = ?",
                    arrayOf(id)
                )
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
        
        if (count > 0) {
            context?.contentResolver?.notifyChange(uri, null)
        }
        
        return count
    }
    
    // 5. 删除数据
    override fun delete(
        uri: Uri,
        selection: String?,
        selectionArgs: Array<String>?
    ): Int {
        val db = dbHelper.writableDatabase
        
        val count = when (uriMatcher.match(uri)) {
            USERS -> {
                db.delete("users", selection, selectionArgs)
            }
            USER_ID -> {
                val id = uri.lastPathSegment
                db.delete(
                    "users",
                    "${UserContract.Columns.ID} = ?",
                    arrayOf(id)
                )
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
        
        if (count > 0) {
            context?.contentResolver?.notifyChange(uri, null)
        }
        
        return count
    }
    
    // 6. 返回 MIME 类型
    override fun getType(uri: Uri): String? {
        return when (uriMatcher.match(uri)) {
            USERS -> "vnd.android.cursor.dir/vnd.com.example.provider.users"
            USER_ID -> "vnd.android.cursor.item/vnd.com.example.provider.users"
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }
}
```

##### 步骤4:注册Provider

```xml
<!-- AndroidManifest.xml -->
<manifest>
    <application>
        <provider
            android:name=".UserProvider"
            android:authorities="com.example.provider"
            android:exported="true"
            android:permission="com.example.READ_USERS">
            
            <!-- 授予其他应用读写权限 -->
            <grant-uri-permission android:pathPattern="/users/.*" />
        </provider>
    </application>
    
    <!-- 定义权限 -->
    <permission
        android:name="com.example.READ_USERS"
        android:protectionLevel="normal" />
    <permission
        android:name="com.example.WRITE_USERS"
        android:protectionLevel="normal" />
</manifest>
```

------

#### 使用ContentProvider

**查询数据**

```kotlin
class MainActivity : AppCompatActivity() {
    
    fun queryUsers() {
        // 1. 获取 ContentResolver
        val resolver = contentResolver
        
        // 2. 构建查询
        val uri = Uri.parse("content://com.example.provider/users")
        val projection = arrayOf(
            UserContract.Columns.ID,
            UserContract.Columns.NAME,
            UserContract.Columns.EMAIL
        )
        val selection = "${UserContract.Columns.AGE} > ?"
        val selectionArgs = arrayOf("18")
        val sortOrder = "${UserContract.Columns.NAME} ASC"
        
        // 3. 执行查询
        val cursor = resolver.query(
            uri,
            projection,
            selection,
            selectionArgs,
            sortOrder
        )
        
        // 4. 处理结果
        cursor?.use {
            while (it.moveToNext()) {
                val id = it.getLong(it.getColumnIndexOrThrow(UserContract.Columns.ID))
                val name = it.getString(it.getColumnIndexOrThrow(UserContract.Columns.NAME))
                val email = it.getString(it.getColumnIndexOrThrow(UserContract.Columns.EMAIL))
                
                Log.d("User", "ID: $id, Name: $name, Email: $email")
            }
        }
    }
}
```

**插入数据**

```kotlin
fun insertUser() {
    val resolver = contentResolver
    val uri = Uri.parse("content://com.example.provider/users")
    
    val values = ContentValues().apply {
        put(UserContract.Columns.NAME, "Alice")
        put(UserContract.Columns.EMAIL, "alice@example.com")
        put(UserContract.Columns.AGE, 25)
    }
    
    val newUri = resolver.insert(uri, values)
    Log.d("Insert", "新用户 URI: $newUri")
}
```

**更新数据**

```kotlin
fun updateUser(userId: Long) {
    val resolver = contentResolver
    val uri = ContentUris.withAppendedId(
        Uri.parse("content://com.example.provider/users"),
        userId
    )
    
    val values = ContentValues().apply {
        put(UserContract.Columns.EMAIL, "newemail@example.com")
    }
    
    val count = resolver.update(uri, values, null, null)
    Log.d("Update", "更新了 $count 条记录")
}
```

**删除数据**

```kotlin
fun deleteUser(userId: Long) {
    val resolver = contentResolver
    val uri = ContentUris.withAppendedId(
        Uri.parse("content://com.example.provider/users"),
        userId
    )
    
    val count = resolver.delete(uri, null, null)
    Log.d("Delete", "删除了 $count 条记录")
}
```

-------

#### 监听数据变化

**ContentObserver**

```kotlin
class MainActivity : AppCompatActivity() {
    
    private val userObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            super.onChange(selfChange, uri)
            Log.d("Observer", "数据变化: $uri")
            // 重新查询数据
            queryUsers()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 注册观察者
        contentResolver.registerContentObserver(
            Uri.parse("content://com.example.provider/users"),
            true,  // 监听所有子 URI
            userObserver
        )
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // 取消注册
        contentResolver.unregisterContentObserver(userObserver)
    }
}
```

-----

#### 权限控制

##### 定义权限

```xml
<!-- AndroidManifest.xml -->
<manifest>
    <!-- 定义权限 -->
    <permission
        android:name="com.example.READ_USERS"
        android:label="读取用户数据"
        android:description="允许读取用户数据"
        android:protectionLevel="normal" />
    
    <permission
        android:name="com.example.WRITE_USERS"
        android:label="写入用户数据"
        android:protectionLevel="normal" />
    
    <application>
        <provider
            android:name=".UserProvider"
            android:authorities="com.example.provider"
            android:exported="true"
            android:readPermission="com.example.READ_USERS"
            android:writePermission="com.example.WRITE_USERS" />
    </application>
</manifest>
```

##### 请求权限

```xml
<!-- 其他应用的 Manifest -->
<manifest>
    <uses-permission android:name="com.example.READ_USERS" />
    <uses-permission android:name="com.example.WRITE_USERS" />
</manifest>
```

##### 临时授权(URI权限)

```kotlin
// 授予其他应用临时访问权限
val intent = Intent(Intent.ACTION_VIEW)
intent.data = Uri.parse("content://com.example.provider/users/1")
intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
startActivity(intent)
```

