+++
date = '2026-02-17T19:31:18+08:00'
draft = true
title = 'Emmbers Stream : 云游戏流媒体核心模块'
+++

## 一、 模块定位

在 Embers 项目中，embers-stream 承担着 **流媒体处理**的核心职责：

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                        Embers 项目架构                           │
  ├─────────────────────────────────────────────────────────────────┤
  │  embers-client          embers-server          embers-stream    │
  │  (客户端渲染)            (服务端业务)            (流媒体核心)      │
  │                                                  │              │
  │                                  ┌───────────────┘              │
  │                                  ▼                              │
  │                          ┌─────────────────┐                    │
  │                          │   embers-proto  │                    │
  │                          │   (共享协议)     │                    │
  │                          └─────────────────┘                    │
  └─────────────────────────────────────────────────────────────────┘
```

#### 核心职责：

1. 屏幕捕获：从显示器获取原始画面
2. 视频编码：将原始帧编码为 H.264
3. 网络传输：通过 QUIC 协议传输数据包

---

## 二、目录结构

```
  crates/embers-stream/
  ├── Cargo.toml
  └── src/
      ├── lib.rs                 # 入口，re-export
      ├── domain.rs              # 领域模块入口
      │   ├── frame.rs           # 帧数据类型
      │   ├── capture.rs         # 捕获抽象
      │   ├── network.rs         # 网络抽象
      │   ├── error.rs           # 错误定义
      │   └── event.rs           # 事件系统
      └── infra.rs               # 基础设施入口
          ├── cgdisplay.rs       # macOS 屏幕捕获
          ├── encoder.rs         # GStreamer 编码器
          └── quic.rs            # QUIC 网络传输
```

#### 分层原则

* Infrastructure (infra/)：CGDisplay，GStreamer， QUIC   --- 脏活累活，平台相关
* Domain：Frame, NetPacket, Traits ---- 纯逻辑，平台无关
* 依赖方向：Infra --> Domain

---

## Domain 层：类型驱动设计

### 3.1 帧数据类型

使用 **NewType** 防止参数混淆：

```rust
/// 分辨率：宽度 x 高度
/// 内部使用 NonZeroU32, 零值在构造时就报错
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Resolution {
  width: NonZeroU32,
  height: NonZeroU32,
}
impl Resolution {
  pub fn new(width: u32, height: u32) -> Result<Self,	&'static str> {
    Ok(Self {
      width: NonZeroU32::new(width).ok_or("width must be non-zero")?,
      height: NonZeroU32::new(height).ok_or("height must be non-zero")?,
    })
  }
}
/// 帧率：每秒帧数
/// 同样不允许零值
#[derive(Debug, Clone, Copy)]
pub struct FrameRate(NonZeroU32);

impl FrameRate {
  pub const fn frame_duration_ns(&self) -> u64 {
    1_000_000_000 / self.value() as u64
  }
}
/// 帧序号：单调递增
#[derive(Debug, Clone, Copy)]
pub struct FrameNumber(u64);

/// 像素格式
#[derive(Debug, Clone, Copy)]
pub enum PixelFormat {
  Bgra,		// macos/windows 常见
  Rgba, 	//
  Nv12, 	// 硬件编码常用
  I420,	 // 软件编码常用
  Rgb,
}
```

#### 设计要点:

- Resolution::new(0, 1080) -> 编译时不会报错，但运行时会返回 Err
- 使用 NonZeroU32 还有额外好处：Option<Resolition> 仍然是8字节

### 3.2 Frame: 帧数据容器

```rust
#[derive(Debug, Clone)]
pub struct Frame {
  pub data: Vec<u8>,						// 像素数据
  pub format: PixelFormat,			// 像素格式
  pub resolution: Resolution,		// 分辨率
  pub number: FrameNumber,		 // 帧序号
  pub timestamp_ns: u64,			// 捕获时间戳
}

impl Frame {
  /// 根据格式和分辨率计算所需内存
  pub fn calculate_size(format: PixelFormat, resolution: Resolution) -> uszie {
    PixelFormat::Bgra | PixelFormat::Rgba => {
      (resolution.width() * resolution.height() * 4) as usize 
    }
    PixelFormat::Nv12 | PixelFormat::I420 => {
      (resolution.width() * resolution.height() * 3 / 2) as usize
    }
    // ...
  }
}
```

#### 为什么不存&[u8]?

Frame 需要拥有数据的所有权：

1. 跨异步边界传递（Send）
2. 生命周期可以独立于捕获源
3. 可以安全的放入队列，缓存

### 3.3 NetPacket：网络传输单元

```rust
#[derive(Debug, Clone)]
pub struct NetPacket {
  pub payload: Bytes,			// 使用 bytes::Bytes(比 Vec<u8> 更高效)
  pub sequence: u64,			// 序列号
  pub timestamp_ns: u64,	// 时间戳
  pub packet_type: PacketType, // 包类型
}
#[derive(Debug, Clone, Copy)]
pub enum PacketType {
  Video, 		 // 视频帧
  Audio，		// 音频帧
  Input, 		 // 输入事件
  Control,		// 控制消息
  KeepAlive, 	// 心跳
}
```

#### 为什么使用 bytes::Bytes?

```rust
// Vec<u8> clone: 深拷贝，复制所有数据
let v1 = vec![0u8; 1024];
let v2 = v1.clone();		// 分配新内存，复制 1024 字节
// Bytes clone: 引用计数，零拷贝
let b1 = Bytes::from(vec![0u8; 1024]);
let b2 = b1.clone(); 	// 只增加引用计数
```

---

## 四、Domain 层：Trait 抽象

### 4.1 CaptureSource: 屏幕捕获抽象

```rust
/// 捕获源 Trait
/// 允许不同平台实现互换
pub trait CaptureSource: Send + Sync {
  type Frame: Send;
  type Error: Into<CaptureError> + Send + std::error::Error + 'static;
  
  /// 启动捕获
  async fn start(&mut self, config: CaptureConfig) -> Result<(), Self::Error>;
  
  /// 停止捕获
  async fn stop(&mut self) -> Result<(), Self::Error>;
  
  /// 获取帧流
  fn frame_stream(&mut self) -> impl Stream<Item = Result<Self::Frame, Self::Error>> + '_;
  
  /// 是否正在捕获
  fn is_capturing(&self) -> bool;
}
```

#### 关联类型 vs 泛型

```rust
// 关联类型
trait CaptureSource {
  type Frame: Send;
  // ...
}
// 泛型
trait Capture<Frame> {
  // ...
}
```

关联类型的优势：

- 调用更简洁：impl CaptureSource vs impl CaptureSource<Frame>
- 一个类型只能对应一种 Frame，语义更清晰
- 编译器能更好的推断类型

**Trade-off**: 不能用`dyn CaptureSource`, 因为关联类型在编译时必须确定。

### 4.2 NetworkTransmitter / NetworkReceiver : 网络抽象

```rust
/// 发送端
pub trait NetworkTransmitter: Send + Sync {
  type Error: std::error::Error + Send + 'static;
  
  async fn send(&mut self, conn_id: ConnectionId, packet: NetPacket) -> Result<(), Self::Error>;
  async fn broadcast(&mut self, packet: NetPacket) -> Result<(), Self::Error>;
  async fn close(&mut self, conn_id: ConnectionId) -> Result<(), Self::Error>;
  fn connection_count(&self) -> usize;
}
/// 接收端
pub trait NetworkReceiver: Send + Sync {
  type Error: std::error::Error + Send + 'static;
  async fn connect(&mut self, addr: SocketAddr) -> Result<(), Self::Error>;
  fn receive_stream(&mut self) -> impl Stream<Item = Result<NetPacket, Self::Error>> + '_;
  async fn listen(&mut self, addr: SocketAddr) -> Result<(), Self::Error>;
  async fn shutdown(&mut self) -> Result<(), Self::Error>;
}
```

---

## 五、 状态机设计

### 5.1 CaptureState

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureState {
  Idle,
  Initializing,
  Capturing,
  Stopping,
  Stopped,
}
impl CaptureState {
  /// 状态转移：非法转换返回错误
  pub fn transisiton(&self, next: CaptureState) -> Result<CaptureState, CaptureError> {
    match (*self, next) {
     	(CaptureState::Idle, CaptureState::Initializing) => Ok(next),
      (CaptureState::Initializing, CaptureState::Capturing) => Ok(next),
      (CaptureState::Capturing, CaptureState::Stopping) => Ok(next),
      (CaptureState::Stopping, CaptureState::Stopped) => Ok(next),
      (CaptureState::Stopped, CaptureState::Idle) => Ok(next),
      _ => Err(CaptureError::AlreadyCapturing),
    }
  }
}
```

### 5.2 ConnectionState

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
  Disconnected,
  Connecting,
  Connected,
  Closing,
  Closed,
}
```

#### 为什么用状态机

1. 防止非法操作：不能在Idle 状态调用 stop()
2. 编译时检查：transition() 返回 Result，强制处理错误
3. 可测试：状态转换逻辑是纯函数，容易单元测试

---

## 六、Infrastructure 层：平台实现

### 6.1 CGDisplayCapture (macos)

```rust
#[cfg(target_os = "macos")]
pub struct CGDisplayCapture {
  state: CaptureState,
  display_id: CGDirectDisplayID,
  frame_number: Arc<AtomicU64>,
  config: Option<Arc<CaptureConfig>>,
  is_active: Arc<AtomicBool>,
}
#[cfg(target_os = "macos")]
impl CaptureSouce for CGDisplayCapture {
  type Frame = Frame;
  type Error = CaptureError;
  
  fn frame_stream(&mut self) -> impl Stream<Item = Result<Frame, CaptureError> + '_ {
    let is_active = self.is_active.clone();
    let frame_duration = /*...*/ ;
    
    futures::stream::unfold(self, move |state| {
      let is_active = is_active.clone();
      async move {
        if !is_active.load(Ordering::Relaxed) {
          return None;
        }
        // Yield point: 让出控制权 + 控制帧率
        tokio::time::sleep(frame_duration).await;
        match state.capture_frame() {
          Ok(frame) => Some((Ok(frame), state)),
          Err(e) => Some((Err(e), state)),
        }
      }
    })
  }
}
```

#### 核心 API

```rust
// 从显示器创建 CGImage
let image_ref = unsafe { CGDisplayCreateImage(self.display_id) };
// 包装成安全的 Rust 类型
let image = unsafe { CGImage::from_ptr(image_ref) };
// 复制像素数据
let cf_data = image.data();
let raw_data = cf_data.bytes();
```

### 6.2 GStreamerEncoder

```rust
pub struct GStreamerEncoder {
  pipeline: gst::Pipeline,
  app_src: gst_app::AppSrc,		// 输入
  app_sink: gst_app::AppSink,  // 输出
  width: u32,
  height: u32,
  frame_duration_ns: u64,
  pixel_format: PixelFormat,
  next_seq: u64,
}

impl GStreamerEncoder {
      pub fn new(width: u32, height: u32, fps: u32) -> Result<Self, anyhow::Error> {
          let pipeline_str = format!(
              "appsrc name=src format=time is-live=true caps=\"video/x-raw,format=BGRA,width={},height={},framerate={}/1\" \
               ! videoconvert \
               ! x264enc tune=zerolatency speed-preset=ultrafast key-int-max={} \
               ! video/x-h264,profile=baseline,stream-format=byte-stream \
               ! appsink name=sink emit-signals=true sync=false",
              width, height, fps, fps
          );
          // ...
      }

      /// 推送原始帧到编码器
      pub fn encode(&mut self, frame: Frame) -> Result<(), anyhow::Error> {
          let pts_ns = frame.number().value().saturating_mul(self.frame_duration_ns);
          let mut buffer = gst::Buffer::from_slice(frame.data);
          buffer.get_mut()?.set_pts(gst::ClockTime::from_nseconds(pts_ns));
          self.app_src.push_buffer(buffer)?;
          Ok(())
      }

      /// 拉取编码后的 H.264 数据
      pub fn pull_packets(&mut self) -> Result<Option<NetPacket>, anyhow::Error> {
          let Some(sample) = self.app_sink.try_pull_sample(gst::ClockTime::ZERO) else {
              return Ok(None);
          };
          // ... 封装成 NetPacket
      }
  }
```

### 6.3 QuicServer

```rust
  pub struct QuicServer {
      endpoint: Endpoint,
      connections: HashMap<ConnectionId, Arc<quinn::Connection>>,
      next_conn_id: u64,
  }

  impl QuicServer {
      /// 生成自签名证书（开发用）
      fn generate_self_signed_config() -> Result<(quinn::ServerConfig, Vec<u8>), QuicError> {
          let CertifiedKey { cert, signing_key } =
              generate_simple_self_signed(vec!["localhost".into()])?;

          let cert_der = cert.der().to_vec();
          let key_der = signing_key.serialize_der()?;

          // ... 构建 ServerConfig
      }
  }
```

---

## 七、 数据流

### 7.1 完整链路

```rust
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ CGDisplay   │     │ GStreamer   │     │   QUIC      │
  │  Capture    │────►│  Encoder    │────►│  Server     │
  └─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
      Frame               NetPacket          网络传输
    (BGRA Vec<u8>)     (H.264 Bytes)       (QUIC Stream)
```
