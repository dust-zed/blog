+++
title = "12月总结：从 UI 架构到流媒体协议的跨越"
date = 2026-01-02T20:30:00+08:00
draft = true
categories = ["Summary", "Android", "Rust", "Cloud Gaming"]
tags = ["Monthly Summary", "Architecture", "WebRTC", "Jetpack Compose"]
+++

## 🚀 月度概览：破界与重构

2024 年的最后一个月，是**“Hard 模式”**全开的一个月。

从月初接手云游戏 Android 端开发的踌躇满志，到月中与 Jetpack Compose 性能与手势冲突搏斗，再到月末毅然决定深入 Rust 底层复刻 Moonlight 协议。这一个月的轨迹，是一个典型的**从应用层（Application Layer）向协议层（Protocol Layer）下潜**的过程。

在这个月里，我不再仅仅通过 API 调用来完成功能，而是开始尝试去理解每一个字节在网络中传输的形态，以及每一帧画面在 GPU 中渲染的代价。

---

## 🏗️ Android 工程化：架构与陷阱

### 1. 架构演进：从 MVVM 到 MVI 的思维跃迁
本月架构经历了从 **"数据驱动"** 到 **"意图驱动"** 的转变：
*   **v1.0 (MVVM)**: 初始阶段使用 UseCase + ViewModel，但随着云游戏控制逻辑（虚拟手柄、信令状态、媒体流状态）的复杂化，State 变得难以追踪。
*   **v2.0 (MVI)**: 重构为 **MVI (Model-View-Intent)**，核心收益在于**心智模型的统一**：
    *   **Intent ≈ Request**: View 层不再直接调用 VM 方法，而是发送 Intent（如 `GameIntent.VideoQualityChanged`）。
    *   **State ≈ Response**: VM 处理后通过 `StateFlow` 发回不可变的 State。
    *   **SideEffect (副作用)**: 明确剥离了 Toast、导航等一次性事件（使用 `Channel`），解决了 "屏幕旋转后 Toast 重复弹出" 的经典 Bug。
    *   **消费者驱动设计 (Consumer-Driven)**: 确立了 "先写业务层调用，再写底层实现" 的开发原则。假装有一个完美的 Engine 接口，写出最自然的 ViewModel 逻辑，倒逼底层为了适配上层而设计，而非反之。

### 2. 依赖注入的"隐形"陷阱
在模块化拆分（Core vs Feature）过程中，踩中了 Hilt/Dagger 的一个盲区：
*   **现象**: `RtcModule` 代码逻辑无误，但编译时报错找不到符号。
*   **根因**: Java/Kotlin 规范中，**有包名的类无法引用无包名（默认包）的类**。Hilt 生成的代码默认处于包私有域，如果原始类没有声明 `package`，生成的组件将无法链接。
*   **教训**: 即使是 Demo 代码，也必须严格遵守包结构规范。

### 3. @Binds vs @Provides 的抉择
在重构 DI 模块时，整理了最佳实践：
*   **@Binds**: 用于接口绑定（如 `AuthRepositoryImpl` -> `AuthRepository`），**编译开销小**（不生成 Factory，仅做链接）。
*   **@Provides**: 用于第三方库对象（如 `OkHttpClient`）或需要复杂构建逻辑的场景。
*   **原则**: 能用 `@Binds` 绝不用 `@Provides`，减少生成的样板代码量。

---

## ⚡ Jetpack Compose：性能优化的血泪史

### 1. 渲染流水线与"洋葱模型"
在开发虚拟摇杆和触控板时，遇到了"点击区域错位"的问题，从而彻底理解了 Modifier 的执行顺序：
*   **洋葱模型**: Modifier 的链式调用是**从外向内**包裹的。
    *   `offset().clickable()`: 点击区域会跟随位移（外层搬走了整个内层）。
    *   `clickable().offset()`: 点击区域留在原地，只有视觉元素被搬走。
*   **性能优化**: 对于高频动画（如摇杆拖拽），放弃 `Offset` 改用 `graphicsLayer { translationX = ... }`。
    *   **收益**: 完全跳过 Measure 和 Layout 阶段，仅触发 Draw 阶段，GPU 负载显著降低。
*   **Alpha 导致的"截肢"惨案**:
    *   **现象**: 虚拟摇杆划出底座范围时被裁切。
    *   **根因**: `Modifier.alpha` 会强制开启**离屏缓冲 (Off-screen Buffer)**，该 Layer 默认等于组件大小且自带物理边界。
    *   **对策**: 对于溢出容器的绘制，禁用 `Modifier.alpha`，改用 **`Color.alpha`** (仅改变画笔透明度，无边界限制)。

### 2. 重组（Recomposition）隔断术
为了解决"全局状态变化导致整个页面重组"的问题，引入了 **Provider Pattern**：
*   **问题**: 直接传递 `state.value` 给子组件，一旦值变化，父组件也会重组。
*   **解法**: 传递 Lambda `() -> T` 而非值。
*   **效果**: 父组件只持有一个稳定的 Lambda 引用（跳过重组），只有真正调用 Lambda 的最底层子组件才会重组。

### 3. 并发死锁：Suspend vs Synchronized
在处理信令加锁时，复习了一个多线程经典死锁场景：
*   **禁忌**: 在 `synchronized` 块中调用 `suspend` 函数。
*   **后果**: 协程挂起释放了线程，但没有释放锁。其他协程试图获取锁时会被物理线程阻塞，导致死锁。
*   **对策**: 全面迁移到 `Mutex`，它支持挂起式等待，不阻塞线程。

---

## ☁️ 云游戏核心：解码流媒体的"黑盒"

### 1. 协议生态全景
不再盲目调用 API，而是理清了 NVIDIA GameStream 生态的协作关系：
*   **HTTP/XML**: 用于前期的配对、应用列表获取（Web 业务逻辑）。
*   **RTSP (遥控器)**: 控制平面。不传视频，只负责协商参数（如 "我要 1080P/60FPS"）和状态控制（Play/Pause）。
*   **RTP (快递包裹)**: 数据平面。通过 UDP 协议高频传输音视频数据包。
*   **QoS 策略**: 放弃了单纯的 DataChannel，选择 WebSocket 作为信令通道，以便服务端能实时动态调整码率。
*   **可靠 UDP (ENet/KCP)**:
    *   在输入指令传输上，通过对比 TCP (队头阻塞) 和 UDP (不可靠)，确立了 **Reliable UDP** 的必要性。
    *   **多通道 (Channels)**: 将 "震动"、"按键"、"鼠标轨迹" 隔离在不同通道，防止非关键数据的丢包阻塞关键指令。

### 2. NALU：视频流的原子拆解
在 Rust 复刻协议的过程中，对 H.264/H.265 码流结构进行了"外科手术式"的解剖：
*   **SPS/PPS (书籍目录)**: 必须最先收到，否则解码器无法初始化（不知道分辨率和 Profile）。
*   **IDR 帧 (全彩插图)**: 关键帧。画面花屏或断连后，必须请求服务端立即发送 IDR 帧以"重生"画面。
*   **P 帧 (透明贴纸)**: 增量帧。依赖前一帧，数据量小但丢包容忍度低。
*   **Fragmentation (碎片化)**: 一个 NALU 可能有 50KB，远超 UDP MTU (1400字节)。必须手动实现分包逻辑，并写入 Start Code (`00 00 00 01`) 作为"装订线"。

---

## 🦀 Rust 与底层探索：走出舒适区

这个月通过 Rust 接入 `moonlight-common-c`，是向系统编程迈出的重要一步：

### 1. 跨语言调试 (FFI)
跨越 Kotlin <-> JNI <-> Rust <-> C 四层栈的调试极其痛苦，但也带来了深刻理解：
*   **ABI 兼容性**: Rust 的 `struct` 必须标记 `#[repr(C)]` 才能与 C 代码安全交互。
*   **内存布局**: 理解了 JVM 堆内存与 Native 堆内存的隔离，以及 JNI 指针传递的开销。

### 2. Rust 异步编程基石
在处理异步流时，攻克了 **Self-Referential (自引用)** 结构的难点：
*   **Move 语义**: Rust 的赋值是内存按位与拷贝（Bitwise Copy），这会导致结构体内指针失效。
*   **Pin <P>**: 像钉子一样把对象固定在内存中，防止它被 Move，这是实现异步状态机（Future）的前提。
*   **Box <T>**: 即使是系统编程，该用堆内存（Heap）时也不要吝啬，解决栈溢出和生命周期问题的利器。
*   **闭包的"俄罗斯套娃"**:
    *   在处理异步任务时，总结了标准范式：`Arc` (共享) -> `move` (捕获) -> `clone` (副本) -> `async move` (消耗副本)。这是 Rust 编译器倒逼出的内存安全最佳实践。

---

> **本月金句**：
> “Modifier 的执行顺序就像剥洋葱，外层决定了内层的世界。”
> “NALU 是书的章节，Start Code 是章节的装订线。”
