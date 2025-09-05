+++
date = '2025-09-05T02:04:09+08:00'
draft = false
title = 'Rust中基础网络编程'
categories = ['rust']

+++

### Rust 网络编程基础：TCP 与 UDP

####  TCP 与 UDP 基础概念

##### TCP (传输控制协议)
- **面向连接**：通信前需要建立连接，使用 `TcpStream` 表示连接
- **可靠性**：保证数据按序到达，自动处理丢包重传
- **流式协议**：数据没有明确边界，需要应用层处理消息分帧
- **流量控制**：内置流量控制和拥塞控制机制
- **适用场景**：文件传输、网页浏览、电子邮件等需要可靠传输的场景

#### UDP (用户数据报协议)
- **无连接**：每个数据包独立发送，使用 `UdpSocket` 进行通信
- **不可靠**：不保证数据包顺序和可达性
- **数据报**：每个数据包有明确边界
- **低延迟**：没有连接建立和确认开销
- **适用场景**：实时音视频、在线游戏、DNS 查询等对延迟敏感的应用

### Rust 中的 TCP 编程

#### 服务端
```rust
use tokio::net::{TcpListener, TcpStream};

async fn server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(addr).await?;
    println!("Server listening on {}", addr);
    
    loop {
        let (mut stream, addr) = listener.accept().await?;
        println!("Client connected from: {}", addr);
        
        // 为每个连接创建新任务
        tokio::spawn(async move {
            // 处理连接
            handle_connection(stream).await;
        });
    }
}
```

#### 客户端
```rust
use tokio::net::TcpStream;

async fn client(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut stream = TcpStream::connect(addr).await?;
    println!("Connected to server at {}", addr);
    
    // 发送和接收数据...
    Ok(())
}
```

### Rust 中的 UDP 编程

#### 服务端
```rust
use tokio::net::UdpSocket;

async fn server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let socket = UdpSocket::bind(addr).await?;
    println!("UDP server listening on {}", addr);
    
    let mut buf = vec![0u8; 1024];
    loop {
        let (len, addr) = socket.recv_from(&mut buf).await?;
        println!("Received {} bytes from {}", len, addr);
        
        // 处理数据并回复
        socket.send_to(&buf[..len], &addr).await?;
    }
}
```

#### 客户端
```rust
use tokio::net::UdpSocket;
use std::net::SocketAddr;

async fn client(server_addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    // 绑定到任意可用端口
    let bind_addr = if server_addr.contains(':') {
        "[::]:0"  // IPv6
    } else {
        "0.0.0.0:0"  // IPv4
    };
    
    let socket = UdpSocket::bind(bind_addr).await?;
    let server_addr: SocketAddr = server_addr.parse()?;
    
    // 可选：连接到服务器地址，之后可以使用 send/recv 而非 send_to/recv_from
    socket.connect(&server_addr).await?;
    
    // 发送数据
    socket.send(b"Hello, UDP!").await?;
    
    // 接收响应
    let mut buf = [0u8; 1024];
    let len = socket.recv(&mut buf).await?;
    println!("Received: {}", String::from_utf8_lossy(&buf[..len]));
    
    Ok(())
}
```

### 关键区别总结

1. **连接处理**：
   - TCP 需要显式接受连接 (`accept`)
   - UDP 直接发送/接收数据报

2. **数据边界**：
   - TCP 是流式协议，需要应用层处理消息边界
   - UDP 保持消息边界，每个 `recv_from` 对应一个完整的消息

3. **可靠性**：
   - TCP 保证可靠传输
   - UDP 不保证，需要应用层处理丢包和乱序

4. **性能**：
   - TCP 有连接建立和确认开销
   - UDP 延迟更低，适合实时应用

#### 端口和连接

##### 1. 监听端口

* 一个端口只能被一个进程监听

##### 2. 连接与端口的关系

* 一个端口可以承载多个连接
* 每个连接由四元组唯一标识
  * 源IP
  * 源端口
  * 目标IP
  * 目标端口

##### 套接字与连接

* 每个Tcp连接对应一个唯一的套接字
* 监听套接字负责接受新连接
* 已连接套接字处理具体的传输

### 选择建议

- 选择 TCP 当：
  - 需要可靠的数据传输
  - 数据传输的完整性比实时性更重要
  - 传输大量数据

- 选择 UDP 当：
  - 低延迟比可靠性更重要
  - 可以容忍少量数据丢失
  - 需要广播或多播功能
  - 传输小数据包且频繁

这两种协议各有优势，选择哪种取决于您的具体应用需求。
