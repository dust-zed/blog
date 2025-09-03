+++
date = '2025-09-02T16:42:46+08:00'
draft = false
title = 'Reqwest模块架构解析'
categories = ['rust', 'request']

+++

从顶层结构来理解reqwest的模块组织：

#### 核心模块

##### 1. async_impl/

* 异步HTTP客户端实现
* 包含`Client`、`Reqwest`、`Response`等核心类型
* 基于`hyper`库实现

##### 2. blocking/

* 同步HTTP客户端
* 内部使用`std::thread`封装异步调用
* 提供阻塞式API

##### 3. dns/

* DNS解析功能
* 支持系统DNS和自定义解析器
* 包含`GaiResolver`等实现

##### 4. proxy/

* 代理支持
* 处理HTTP/HTTPS/SOCKS代理
* 代理自动发现和认证

##### 5. tls

* 安全传输层实现
* 支持native-tls和rustls
* 证书和身份管理

##### 6. redirect/

* 重定向处理
* 支持自定义重定向策略
* 处理3xx状态码

##### 7. wasm/

* WebAssembly平台特定实现
* 使用浏览器Fetch API
* 针对Web环境优化

#### 辅助模块

* **cookie/** - Cookie管理
* **multipart/** - 多部分表单数据处理
* **retry/** - 请求重试机制
* **util/** - 工具函数和辅助类型

#### 特性开关

通过Cargo features控制功能：

* `default-tls` - 默认TLS实现
* `native-tls` - 使用系统原生TLS
* `rustls` - 使用rustls纯Rust实现
* `blocking` -  启用同步API
* `cookies` - Cookie支持
* `json` -  JSON序列化支持

```rust
//lib.rs
#[cfg(feature = "blocking")]
pub mod blocking;
#[cfg(feature = "cookies")]
pub mod cookie;
```

在 `Cargo.toml` 中通过 features 控制哪些实现被编译。



