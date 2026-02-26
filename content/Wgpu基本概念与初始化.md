+++
date = '2026-02-04T23:19:02+08:00'
draft = true
title = 'Wgpu基本概念与初始化'
+++

#### 1. 依赖配置 (Cargo.toml)

首先，我们要锁定版本。不要用 `*`，否则第二天可能就崩了。

```toml
[package]
name = "wgpu-lab"
version = "0.1.0"
edition = "2024"

[dependencies]
# 截至 2026.2 的最新组合
wgpu = "28.0"      
winit = "0.30.12"   
pollster = "0.3"    # 用于在 main 中跑 async
env_logger = "0.10"
log = "0.4"
```

------

#### 1. 核心概念：Android 开发者的“既视感”

作为一名 Android 开发者，我发现这套新架构其实非常好理解。如果你觉得 Rust 的概念抽象，不妨这样类比：

1. **`App` 结构体 ≈ `Activity`**：

   Winit 0.30 不再允许直接在 `main` 里跑死循环，而是强制你实现 `ApplicationHandler` 接口。这就像 Android 的生命周期回调。

2. **`Instance` ≈ 系统图形 API**：

   负责去操作系统里找 Vulkan、Metal 或 DX12。

3. **`Surface` ≈ `SurfaceView`**：

   连接操作系统窗口和 GPU 的那层“膜”。

4. **`Device` ≈ 逻辑显卡上下文**：

   创建资源、发号施令全靠它。

5. **`Queue` ≈ 渲染指令队列**：

   GPU 是异步的，我们把 `Encoder` 录制好的指令 `submit` 进去，显卡才会干活。

------

#### 2. 实战代码：Winit 0.30 + WGPU 28.0 标准模板

这是一份经过修正的、去掉了 `unsafe` 的完整代码。

**核心变动点：**

- 使用 `Arc<Window>` 解决生命周期报错。
- `DeviceDescriptor` 使用 `..Default::default()` 应对未来字段变更。
- `RenderPass` 显式处理 WGPU 28.0 新增的 `depth_slice` 和 `multiview_mask`。

```rust
use std::sync::Arc;
use wgpu::Color;
use winit::{
    application::ApplicationHandler, event::WindowEvent, event_loop::EventLoop, window::Window,
};

// --- 1. 定义 State 结构体 ---
// 所有的图形资源都由这个结构体持有，防止被自动释放
struct State {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    size: winit::dpi::PhysicalSize<u32>,
    // window 必须在最后，因为 surface 引用了 window，Rust 要求 window 活得比 surface 久
    window: Arc<Window>,
}

impl State {
    async fn new(window: Arc<Window>) -> Self {
        let size = window.inner_size();

        // 1. Instance
        // 这是 wgpu 的入口， 负责去操作系统找看支持哪些图形后端 （vulkan，Metal，DX12）
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default() // flags 等参数用默认值
        });

        // 2. Surface
        // 是连接操作系统窗口系统和 GPU 的桥梁
        let surface = instance.create_surface(window.clone()).unwrap();

        // 3. Adapter
        // 物理显卡的代言人
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .unwrap();
        // 4. Device & Queue
        // Device：逻辑显卡。以后要创建纹理，缓冲，着色器，全找它。
        // Queue: 指令队列。GPU 是异步的，不能直接指挥它干活。得把命令写在纸条上，
        // 塞进这个队列里，GPU 有空了就会去拿字条执行
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                label: None,
                ..Default::default()
            })
            .await
            .unwrap();

        // 5. Config
        // 这是在协商。我要用 sRGB 颜色空间，我要垂直同步，我的宽高是 800 * 600
        //  关键点：surface.configure 这一步最关键。如果配置，Surface 只是个空壳
        // 配置了，他才真正分配了显存
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        Self {
            window,
            surface,
            device,
            queue,
            config,
            size,
        }
    }

    fn resize(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
        if new_size.width > 0 && new_size.height > 0 {
            self.size = new_size;
            self.config.width = new_size.width;
            self.config.height = new_size.height;
            self.surface.configure(&self.device, &self.config);
        }
    }

    // 渲染循环 -- 每一帧发生了什么
    // 这是最核心的部分，每秒钟执行 60 次（取决于刷新率）
    fn render(&mut self) -> Result<(), wgpu::SurfaceError> {
        // 1. 获取画布
        // 想象你有两三张白纸（双重/三重缓冲）
        // 这行代码的意思是问 GPU：给我一张没在用的白纸，我要开始画画了
        let output = self.surface.get_current_texture()?;
        
        // 2. 创建视图（View）
        // 显卡很笨，它不知道这张纸是存颜色还是存深度的
        //  View 就像是一副眼镜，告诉显卡：把刚才拿到的那块显存，当做颜色纹理来看待。
        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        
        // 3. 建立指令录制器 （CommandEncoder）
        // 我们不是直接画，而是先“录制“指令
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Error"),
            });
        
        // 4. 开启渲染通道（Render Pass），真正的绘画开始
        {
            let _render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                // 告诉 GPU：画完的结果存到 View 上
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        // Load：画之前怎么处理这张纸
                        //  Clear：无论上面有啥，直接涂成蓝色（0.1， 0.2， 0.3）
                        load: wgpu::LoadOp::Clear(Color {
                            r: 0.1,
                            g: 0.2,
                            b: 0.3,
                            a: 1.0,
                        }),
                        // Store: 画完之后怎么办
                        //  Store： 保存下来，准备显示
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
        } // 离开作用域，_pass 结束，代表这一轮的绘画指令录制完毕
        
        // 5. 提交
        // 把录制好的指令单子（encoder.finish()）扔给 GPU 队列。
        // 这时候 GPU 才真正开始干活
        self.queue.submit(std::iter::once(encoder.finish()));
        // 6. 展示（Present）
        // 告诉系统，我画完了，把这张纸贴到屏幕上给用户看吧
        output.present();
        Ok(())
    }
}

// --- 2. App 结构体 ---
// 我们必须把 State 包裹在 Option 里，因为 App 创建时窗口还没出来
struct App {
    window: Option<Arc<Window>>, //
    state: Option<State>,
}

// 面向过程进化为 面向生命周期？
impl ApplicationHandler for App {
    // 窗口创建必须在 resumed 中进行
    // 只有系统准备好了，给你资源了，你才允许创建窗口
    fn resumed(&mut self, event_loop: &winit::event_loop::ActiveEventLoop) {
        if self.window.is_none() {
            let win_attr = Window::default_attributes().with_title("WGPU 0.30 + 28.0");
            // 创建窗口
            let window = Arc::new(event_loop.create_window(win_attr).unwrap());
            self.window = Some(window.clone());

            // 初始化 WGPU state
            let state = pollster::block_on(State::new(window.clone()));
            self.state = Some(state);
        }
    }
    // 2. 事件分发
    // 这就是 Android 的 onTouchEvent,onKeyDown 等
    fn window_event(
        &mut self,
        event_loop: &winit::event_loop::ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: winit::event::WindowEvent,
    ) {
        let state = match &mut self.state {
            Some(s) => s,
            None => return, // 窗口没准备好，不处理事件
        };
        match event {
            WindowEvent::CloseRequested => {
                println!("The close button was pressed; stopping");
                event_loop.exit();
            }
            WindowEvent::Resized(physical_size) => {
                state.resize(physical_size);
            }
            WindowEvent::RedrawRequested => match state.render() {
                Ok(_) => {}
                Err(wgpu::SurfaceError::Lost) => state.resize(state.size),
                Err(wgpu::SurfaceError::OutOfMemory) => event_loop.exit(),
                Err(e) => eprintln!("{:?}", e),
            },
            _ => {}
        }
    }
    // 这一步很重要：每当事件循环空闲时，请求重绘窗口
    fn about_to_wait(&mut self, _event_loop: &winit::event_loop::ActiveEventLoop) {
        if let Some(window) = &self.window {
            window.request_redraw();
        }
    }
}

fn main() {
    env_logger::init();
    let event_loop = EventLoop::new().unwrap();
    event_loop.set_control_flow(winit::event_loop::ControlFlow::Poll);
    let mut app = App {
        window: None,
        state: None,
    };
    event_loop.run_app(&mut app).unwrap();
}
```

------

#### 3. 踩坑总结

1. **关于 `Arc<Window>`**：

   以前的教程里，`create_surface` 是 `unsafe` 的，因为编译器不知道 Window 能活多久。现在用 `Arc` 包裹后，引用计数确保了 Window 在 Surface 存活期间不会被销毁，代码不仅 Safe 了，还更优雅了。

2. **关于 `..Default::default()`**：

   在构建 `DeviceDescriptor` 时，强烈建议加上这个。WGPU 每次更新都可能往里面塞新字段（比如最近加的 `memory_hints`），加上这一行，你的代码就能“抗版本更新”，不用每次升级都去修修补补。

3. **关于 Winit 的 `ApplicationHandler`**：

   虽然代码量变多了，但这其实是好事。它让 Web、Android、iOS 和桌面的逻辑更加统一了。

#### 总结

跑通这一步，其实只是搭好了“画架”。接下来，我们就可以在这个 `State::render` 函数里，通过 Pipeline 和 Buffer，开始画出我们的第一个三角形了。

Rust 的图形编程虽然门槛高，但只要配置好了这个环境，后面的逻辑其实非常清晰。

**关注我，后续更新“如何在 WGPU 里画一个等边三角形”！**

------

### 下一步建议

你可以把代码运行成功的截图（那个深蓝色的窗口）放在文章里作为头图，这非常有说服力。

等你发了文章，可以继续回到这里，我们下一步要去攻克 **Pipeline (渲染管线)** 和 **Shader (着色器)** 了，那才是真正“魔法”开始的地方。准备好了吗？
