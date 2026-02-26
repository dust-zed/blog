+++
date = '2026-01-04T10:15:55+08:00'
draft = true
title = 'Serde and Serde_json'
categories = ['rust']

+++

`serde` 和 `serde_json` 是一对形影不离的搭档，但它们的分工非常明确。简单来说：**`serde` 是“总指挥”，而 `serde_json` 是“具体的执行者”**。

在 Rust 中，这是一种非常典型的**接口与实现分离**的设计模式。

### 1. 核心区别：框架 vs 实现

#### **`serde` (Serializer / Deserializer)**

- **角色**：它是一个**框架**（Framework）或**协议**（Protocol）。
- **职责**：它定义了一套标准：
  - “什么是序列化？” -> 把 Rust 结构体变成一种中间格式。
  - “什么是反序列化？” -> 把中间格式变回 Rust 结构体。
  - **关键点**：它**不包含**任何具体的格式（JSON, YAML, TOML, Bincode 等）的解析逻辑。它只提供了 `Serialize` 和 `Deserialize` 这两个 Trait（接口）。
- **比喻**：它就像是 USB 协议标准。它规定了插头怎么设计，数据怎么走，但它本身不是一个 U盘，也不是一个鼠标。

#### **`serde_json`**

- **角色**：它是一个具体的**格式实现**（Format Implementation）。
- **职责**：它实现了 `serde` 定义的标准，专门负责处理 JSON 格式。
  - 它知道 `{` 代表对象开始，`[` 代表数组。
  - 它负责把 JSON 字符串变成 `serde` 能理解的数据流。
- **比喻**：它就是一个具体的 U盘（JSON），插在 USB 接口（Serde）上工作。

------

### 2. 为什么要同时引入？

当你写下这段代码时：

Ini, TOML

```
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

你实际上在做两件事：

1. **引入 `serde`**：是为了给你的结构体**打标签**（derive）。

   Rust

   ```
   use serde::{Serialize, Deserialize};
   
   #[derive(Serialize, Deserialize)] // <--- 这是 serde 提供的能力
   struct User {
       name: String,
       age: u8,
   }
   ```

   这一步让你的 `User` 结构体具备了“可被序列化”的能力。**但此时，它还不知道要被序列化成什么样子**（JSON？还是二进制？）。

2. **引入 `serde_json`**：是为了**执行**序列化操作。

   Rust

   ```
   fn main() {
       let user = User { name: "Alice".into(), age: 18 };
       // 这里才用到了 serde_json
       let json_str = serde_json::to_string(&user).unwrap();
   }
   ```

   这一步，`serde_json` 接收了具备 `Serialize` 能力的 `user`，并把它转换成了 JSON 字符串。

### 3. 如果只引入其中一个会怎样？

- 只引入 serde：

  你可以给结构体加 #[derive(Serialize)]，但是你没法把它变成 JSON 字符串。你只能看着它干瞪眼，因为它没有输出格式。

- 只引入 serde_json：

  你可以解析简单的 JSON（例如 serde_json::json!({ "a": 1 })），或者解析到 serde_json::Value（类似 HashMap）。

  但是！ 如果你想把 JSON 直接解析成你自定义的 struct User，你做不到。因为 struct User 没有实现 serde 的接口，serde_json 不认识它。

### 4. 总结

在 TDD 和日常开发中，请记住这个黄金组合：

- **定义数据结构时**：你需要 `serde`（尤其是 `derive` feature）。
- **处理 IO/网络传输时**：你需要 `serde_json`（或其他格式库如 `serde_yaml`）。

这就是为什么每次你都要把它们“成对”引入的原因：**一个负责定义“我是谁”，一个负责定义“我变成什么样”。**
