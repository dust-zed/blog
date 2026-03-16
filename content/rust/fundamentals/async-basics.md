+++
title = 'Rust 异步基础'
date = '2026-01-11T20:06:26+08:00'
draft = false
categories = ['rust']
tags = ['Rust', 'Async', 'Trait', 'VTable', 'Pin']
description = "通过手动实现异步 Trait，深入理解 Trait Object、VTable、Pinning、Send/Sync 及 Lifetimes。"
slug = "rust-async-basics"
+++

**核心冲突**：Rust 零成本抽象与动态分发的灵活性在 `async` 场景下剧烈碰撞。

---

## 一、问题起源

### 1.1 看似无害的需求

```rust
trait UserService {
    async fn get_user(&self, id: u32) -> Option<User>;
}
```

### 1.2 编译器的脱糖

`async fn` 是语法糖，编译器展开为：

```rust
trait UserService {
    fn get_user(&self, id: u32) -> impl Future<Output = Option<User>>;
}
```

**问题**：`impl Future` 的具体类型由函数体决定，每个实现类的返回类型都不同。

---

## 二、多态的代价

### 2.1 静态分发

```rust
fn handle<T: UserService>(s: T) { ... }
```

- **原理**：单态化，为每个 `T` 生成专用代码
- **优点**：运行时零开销
- **缺点**：二进制膨胀；无法运行时切换实现

### 2.2 动态分发

```rust
fn handle(s: Box<dyn UserService>) { ... }
```

**胖指针**：
- `data_ptr`：指向具体数据
- `vtable_ptr`：指向虚函数表

### 2.3 对象安全性问题

```
Error: The trait `UserService` cannot be made into an object.
```

**原因**：虚表要求返回值大小确定。`impl Future` 返回的状态机大小不确定：
- `DbService` 的状态机可能是 1024 字节
- `MemService` 的状态机可能是 64 字节

---

## 三、解决方案：类型擦除

### 3.1 Boxed Future

```rust
trait UserService {
    fn get_user(&self, id: u32)
        -> Box<dyn Future<Output = Option<User>> + Unpin>;
}
```

返回 8 字节的指针，虚表可以生成。

### 3.2 为什么需要 Pin？

Async 函数编译成**状态机**，通常是**自引用**的：

```rust
async fn example() {
    let x = [0; 1024];
    let y = &x;           // 引用自身字段
    await_something().await;  // 挂起，状态机被保存
    use(y);
}
```

如果状态机被移动，`y` 指针失效 → **Use-After-Free**。

### 3.3 最终签名

```rust
trait UserService {
    fn get_user(&self, id: u32)
        -> Pin<Box<dyn Future<Output = Option<User>>>>;
}
```

---

## 四、多线程安全

### 4.1 Send 与 Sync

| Trait | 含义 |
|-------|------|
| `Send` | 所有权可跨线程转移 |
| `Sync` | 引用可跨线程共享 |

`dyn Trait` 擦除了类型信息，编译器默认认为是 `!Send` 和 `!Sync`。

### 4.2 显式约束

```rust
type Service = Arc<dyn UserService + Send + Sync>;

trait UserService {
    fn get_user(&self, id: u32)
        -> Pin<Box<dyn Future<Output = Option<User>> + Send>>;
}
```

---

## 五、生命周期

### 5.1 问题

```rust
impl UserService for DbService {
    fn get_user(&self, id: u32) -> ... {
        Box::pin(async move {
            self.db.query(id).await  // Error: lifetime may not live long enough
        })
    }
}
```

`async move` 捕获 `self` 引用，但 Future 可能在 `self` 销毁后才执行。

### 5.2 解决

```rust
trait UserService {
    fn get_user<'a>(&'a self, id: u32)
        -> Pin<Box<dyn Future<Output = Option<User>> + Send + 'a>>;
}
```

`+ 'a` 建立 `&self` 和返回值的生命周期绑定。

---

## 六、工程化方案

实际工程中，使用 `async-trait` 宏：

```rust
use async_trait::async_trait;

#[async_trait]
trait UserService {
    async fn get_user(&self, id: u32) -> Option<User>;
}
```

**代价**：每次调用发生 `Box::pin`（堆分配）。对 IO 密集型应用可忽略。

---

## 总结：Rust 为什么难

这个案例展示了 Rust 学习曲线陡峭的原因：**编码阶段处理所有内存安全和线程安全隐患**。

| 问题 | 解决 |
|------|------|
| VTable 限制 | `Box` 统一大小 |
| 自引用安全 | `Pin` |
| 多线程安全 | 显式 `Send` |
| 引用有效性 | `Lifetime` |

一旦编译通过，你获得的是**内存安全、无数据竞争、无 GC 暂停**的高性能程序。
