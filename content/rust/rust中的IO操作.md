+++
date = '2025-08-22T06:01:17+08:00'
draft = false
title = 'Rust中的IO操作'

categories = ['rust']

+++

在Rust中，I/O操作主要通过`Read`和`Write`两个核心trait实现，而`Cursor`、`BufWriter`和`ReadBuf`是围绕这些trait的实用工具。

---------

#### 1. `Read`和`Write` trait

##### `std::io::Read`

**作用**：从数据源（文件、网络等）读取字节流。

**核心方法**：

```rust
fn read(&mut self, buf: &mut [u8]) -> Result<usize>;
```

* 尝试读取数据到缓冲区`buf`
* 返回实际读取的字节数(`Ok(n)`)，或错误（`Err(e)`）
* 当读取到EOF时返回`Ok(0)`

**常用方法**：

* `read_to_end(&mut vec)`:读取所有字节到`Vec<u8>`
* `read_to_string(&mut string)`:读取UTF-8字节到`String`
* `read_exact(&mut buf)`:精确读取`buf.len()`字节，否则报错

##### `std::io::Write`

**作用**：将字节流写入目标

**核心方法**：

```rust
fn write(&mut self, buf: &[u8]) -> Result<usize>;
fn flush(&mut self) -> Result<()>;
```

* `write`尝试写入缓冲区`buf`，返回实际写入的字节数
* `flush`确保所有缓冲数据写入目标（如磁盘）

-------------

#### 2. `Cursor<T>`

**作用**：将内存类型包装成可`随机访问`的`Read`/`Write`对象。

**特点**：

* 在内存中模拟文件指针（维护`position`）。
* 实现Read和Write（需`T: AsMut<[u8]>`)，支持`Seek`。
* 零成本抽象，高性能内存操作。

**使用场景**：

* 从`Vec<u8>`读取数据，或写入到`Vec<u8>`。
* 测试时代替真实文件I/O。

#### 3. `BufWriter<W>`

**作用**：包装一个`Write`对象，提供**写入缓冲**。

**优点**：

* 减少系统调用（如磁盘、网络写入）。
* 批量写入提高性能（默认缓冲区大小**8KB**）。

**行为**：

* 先写入内存缓冲区，满时自动刷新到内部`W`。
* 手动调用`flush()`或`Drop`时强制刷新缓冲区。

#### 4. `BufReader<R>`

**作用**：包装`Read`对象，提供**读取缓冲**。

**优点**：

* 减少频繁系统调用（如读取文件时多次小数据读取）
* 支持按行读取（`read_line`和`lines`）

-----------------

#### 完整知识图谱

```
I/O 核心 Trait
│
├── Read (字节源)
│   ├── 实现类型：File, TcpStream, Vec<u8>, etc.
│   ├── 工具：BufReader (缓冲读取), Take (限制读取长度)
│   └── 扩展：BufRead (提供 read_line, lines 等方法)
│
├── Write (字节目标)
│   ├── 实现类型：File, TcpStream, Vec<u8>, etc.
│   └── 工具：BufWriter (缓冲写入), LineWriter (行缓冲)
│
├── Seek (随机访问)
│   └── 实现类型：File, Cursor<T>
│
└── 内存适配器
    └── Cursor<T> (内存模拟 I/O)
        ├── 支持：Read/Write/Seek
        └── 适用：Vec<u8>, &[u8], String, &str
```

---------------

##### 关键原则

**1. 缓冲使用**：

* BufReader/BufWriter总是推荐用于文件/网络 I/O。
* Cursor用于内存数据（如解析二进制格式）

**2. 错误处理**：

* 所有I/O操作返回`Result`，必须处理`Err`情况。
* 特别注意`flush()`的错误（如磁盘满）。

**3. 性能**

* 小数据写入用`BufWriter`
* 避免频繁小数据读取（缓冲或批量化）
