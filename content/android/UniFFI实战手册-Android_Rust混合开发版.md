+++
date = '2026-01-11T13:59:24+08:00'
draft = true
title = 'UniFFi 实战手册'

+++

**核心定位**：UniFFI 是你的“AI 翻译机”。它让你像写普通 Rust 代码一样开发，然后自动生成完美的 Kotlin 接口 (JNI 胶水代码)。推荐模式：全线采用 **Proc Macros（过程宏）**模式。

### 一、环境与配置

#### 1.1 `Cargo.toml`依赖配置

在 Rust 项目根目录的`Cargol.toml`中，注意`crate-type`和`uniffi`的版本一致性：

```toml
[lib]
# "cdylib" 是必须的，用于生成 Android 可用的 .so 文件
crate-type = ["cdylib"]
name = "rust_lib_core" # 通用库名

[dependencies]
# features = ["tokio"] 开启异步支持，这对高性能 App 至关重要
uniffi = { version = "0.28", features = ["tokio"] }
thiserror = "1.0"
# 用于驱动异步运行时
tokio = { version = "1", features = ["full"] }
# 常用库推荐
log = "0.4"
android_logger = "0.13" # 让 Rust 日志输出到 Logcat

[build-dependencies]
# ⚠️ 警告：这里的版本必须和 dependencies 里的版本严格一致！
uniffi = { version = "0.28", features = ["build"] }
```

#### 1.2 Rust入口文件 (lib.rs)

```toml
// 这一行宏会自动生成 JNI 胶水代码，不可省略
uniffi::setup_scaffolding!();

// 初始化日志系统（建议放在某个 init 函数中调用）
#[uniffi::export]
fn init_logger() {
    android_logger::init_once(
        android_logger::Config::default().with_min_level(log::Level::Debug),
    );
}
```

#### 1.3 `uniffi.toml`配置文件

在项目根目录（与`Cargo.toml`同级）创建`uniffi.toml`：

```toml
[bindings.kotlin]
# 生成的 Kotlin 代码的包名，必须与 Android 项目结构匹配
package_name = "com.example.app.core"
# 编译生成的 .so 文件名 (去掉 lib 前缀)。例如 librust_lib_core.so -> rust_lib_core
cdylib_name = "rust_lib_core"
```

#### 1.4 Gradle集成（Android侧）

在 Android 项目的 `app/build.gradle.kts` 中，你需要让 Gradle 自动调用 `uniffi-bindgen`。 *(注：市面上有 `net.navatwo.uniffi` 等插件，但手动配置更稳定)*

关键步骤逻辑：

1. Cargo 编译 Rust -> 生成 `.so`
2. `uniffi-bindgen` 读取 `.so` -> 生成 `.kt`
3. 将 `.kt` 加入 Android 源码集

### 二、类型系统 -- 通信的词汇

#### 2.1 基础类型映射表

| Rust            | Kotlin             | 说明                                                         |
| --------------- | ------------------ | ------------------------------------------------------------ |
| `u8` / `i8`     | `UByte` / `Byte`   | -                                                            |
| `i32`           | `Int`              | -                                                            |
| `u64`           | `ULong`            | **坑点**：Kotlin 的 Unsigned 类型使用起来较繁琐，有时建议在 Rust 层转为 `i64` (Long) 传输时间戳。 |
| `f32` / `f64`   | `Float` / `Double` | -                                                            |
| `bool`          | `Boolean`          | -                                                            |
| `String`        | `String`           | 自动处理 UTF-8 转换，内存安全。                              |
| `Vec<u8>`       | `ByteArray`        | **重点**：二进制流、文件数据、protobuf。                     |
| `Vec<T>`        | `List<T>`          | 列表，会有拷贝开销。                                         |
| `Option<T>`     | `T?`               | 完美映射为 Kotlin 的可空类型。                               |
| `HashMap<K, V>` | `Map<K, V>`        | 映射为 Kotlin Map。                                          |

#### 2.2 Record -- 纯数据包（DTO）

* 性质：值拷贝。在传输时进行序列化/反序列化。
* 用途：配置对象，一次性状态快照。

```rust
#[derive(uniffi::Record)]
pub strcut AppConfig {
  pub api_endpoint: String,
  pub timeout_ms: u32,
  pub max_retries: u8
}
```

#### 2.3 Enum -- 状态与事件

* 性质：根据是否携带数据，生成不同的Kotlin结构
* 用途：状态机、业务事件、错误码。

```rust
#[derive(uniffi::Enum)]
pub enum NetworkState {
  Disconnected,
  Connecting,
  Connected { session_id: String, ping_ms: u32 },
  Failed(String)
}
```

#### 2.4 Object（对象）-- 核心服务

* 性质：引用传递。传递的是`Handle(u64)`
* 生命周期: 有`Arc`智能指针管理。
* 线程安全：必须实现`Sync + Send`。这意味着内部状态通常需要`Mutex`

```rust                                                                                                                                                                               
use std::sync::Mutex;

#[derive(uniffi::Object)]
pub struct CoreService {
  inner: Mutex<ServiceState>
}

#[uniffi::export]
imple CoreService {
  #[uniffi::constructor]
  pub fn new() -> Self {
    Self { inner : Mutex::new(ServiceState::default()) }
  }
}
```

### 三、函数与交互

#### 3.1 异步函数(Async) -- 彻底告别卡顿

原理： Rust `Future`通过UniFFI的polling机制桥接到Kotlin `Coroutines`。

Rust写法:

```rust
#[uniffi::export]
impl CoreService {
  pub async fn perform_action(&self, param: String) -> Result<String, CoreError> {
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    if param.is_empty() {
      return Err(CoreError::InvalidParam);
    }
    Ok("success_result".into())
  }
}
```

### 3.2 回调接口 -- 反向通知

场景：Rust后台线程需要通知Android UI更新

Rust定义

```rust
#[uniffi::export(callback_interface)]
pub trait StateListener: Send + Sync {
  fn on_progress(&self, percent: u32);
  fn on_log(&self, msg: String);
}
```

Kotlin实现

```kotlin
class AndroidListener: StateListener {
  override fun onProgress(percent: UInt) {
    MainScope().launch {
      progressBar.progress = percent.toInt()
    }
  }
  override fun onLog(msg: String) {
    Lod.d("RustCore", msg)
  }
}
```

### 三、高级技巧

#### 4.1 自定义类型 -- 包装`SystemTime`

场景：你想在接口里直接使用Rust的`SystemTime`，但Uniffi不支持。你需要把它转换为`u64`传给Kotlin。

Rust实现：

1. 创建一个NewType 包装器（如果需要）或直接为你的类型实现 `UniffiCustomTypeConverter`。
2. 此处演示简单包装模式（Uniffi 尚不支持直接对标准库类型 impl Converter, 通常用 NewType）。

```rust
#[derive(uniffi::Object)]
pub struct RustTime(std::time::SystemTime);

#[uniffi::export]
impl RustTime {
    #[uniffi::constructor]
    pub fn now() -> Self {
        Self(std::time::SystemTime::now())
    }

    // 转为毫秒时间戳给 Kotlin 用
    pub fn to_millis(&self) -> u64 {
        self.0.duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}
```

#### 4.2 错误处理

让异常携带数据，实现精细化UI交互。

```rust
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum ActionError {
    #[error("操作受限，冷却中: {retry_after}秒")]
    Throttled { retry_after: u32 },
}

```

#### 4.3 内存管理

UniFFI的对象虽然有GC兜底，但在高性能场景下，必须**手动释放**重资源对象。

```kotlin
// 在 Android ViewModel 中
override fun onCleared() {
  super.onCleared()
  coreService.destory()
}
```

