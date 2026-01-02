+++
date = 2025-09-12T03:02:50+08:00
title = '深入理解 Callback：从机制到 Rust 实现'
categories = ['cs-basics']
tags = ['编程范式', 'Rust', '闭包']
description = "深入理解回调 (Callback) 机制：由控制反转 (IoC) 到 Rust 中的闭包实现。"
slug = "understanding-callback"
+++

## 1. 核心概念
个人理解：回调（Callback）的本质就是**将函数作为参数传递**。

* **普通参数传递**：传递的是**数据** (Data)。
* **Callback 传递**：传递的是**操作** (Operation) 或 **逻辑** (Logic)。

这就像是你去裁缝店：
* **传数据**：你给裁缝布料（数据），裁缝按他的标准做衣服。
* **传逻辑（Callback）**：你给裁缝布料，并给了一张图纸（逻辑），裁缝按你的图纸做衣服。



## 2. 控制反转 (Inversion of Control)
Callback 是实现控制反转（IoC）的最基础手段，常被称为 **"好莱坞原则" (Don't call us, we'll call you)**。

* **普通函数调用**：
    * Caller（调用者） -> Callee（被调用者）
    * **控制权**在调用者手中，它决定每一步做什么。
    
* **回调模式**：
    * Caller -> Callee (携带 Callback) -> Callback
    * **控制权**转移到了被调用者手中。被调用者决定**何时**执行这个操作，而调用者决定**做什么**。

## 3. Rust 中的 Callback 实现
在 Rust 中，Callback 通常通过闭包（Closures）和 `Fn` traits 来实现。这是对“传递逻辑”最精确的类型系统描述。

```rust
struct Processor {
    data: Vec<i32>,
}

impl Processor {
    // 定义一个接受 Callback 的方法
    // F: Fn(i32) -> i32 表示这个 Callback 接受一个 i32，返回一个 i32
    fn process_data<F>(&self, logic: F) -> Vec<i32>
    where
        F: Fn(i32) -> i32,
    {
        let mut result = Vec::new();
        for &item in &self.data {
            // 这里体现了“何时做”（遍历时），但“做什么”由外部 logic 决定
            let processed = logic(item);
            result.push(processed);
        }
        result
    }
}

fn main() {
    let p = Processor { data: vec![1, 2, 3] };

    // 场景 1：传递“加倍”的逻辑
    let doubled = p.process_data(|x| x * 2);
    println!("Doubled: {:?}", doubled); // [2, 4, 6]

    // 场景 2：传递“平方”的逻辑 —— 复用了 process_data 的流程
    let squared = p.process_data(|x| x * x);
    println!("Squared: {:?}", squared); // [1, 4, 9]
}