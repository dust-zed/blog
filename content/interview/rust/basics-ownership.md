+++
title = 'Rust 所有权与闭包 trait'
date = '2025-09-01T17:16:28+08:00'
draft = false
categories = ['rust']
tags = ['Rust', 'Ownership', 'Closure', 'FnOnce']
description = "深入理解 Rust 所有权机制：FnOnce/FnMut/Fn 闭包 trait 与零成本抽象原理。"
slug = "rust-basics-ownership"
+++

## 一、为什么 FnOnce 只能调用一次

### 源码分析

```rust
pub trait FnOnce<Args> {
    type Output;
    extern "rust-call" fn call_once(self, args: Args) -> Self::Output;
}
```

**关键点：`self` 的含义**

- 接收实现了 `FnOnce` 的具体类型的值
- 这个值会被 **移动 (move)** 进方法

### 具体例子

假设我们有一个闭包：

```rust
let s = String::from("hello");
let f = || {
    println!("{}", s);  // 获取 s 的所有权
    s.len()
};
```

当这个闭包实现 `FnOnce` 时，编译器生成的代码类似这样：

```rust
// 编译器生成的代码类似这样：
struct Closure {
    s: String,  // 捕获的环境变量
}

impl FnOnce<()> for Closure {
    type Output = usize;

    fn call_once(self, _args: ()) -> usize {
        println!("{}", self.s);
        self.s.len()
    }
}
```

### 调用示例

```rust
let result = f();  // 等价于 FnOnce::call_once(f, ())
// 这里不能再调用 f()，因为 f 已经被移动
```

**核心原因**：`f` 的所有权被转移进 `call_once`，随着 `call_once` 的结束而 `drop`，`f` 被释放了，内部捕获的所有权自然也被释放。

### FnOnce / FnMut / Fn 的区别

这些 trait 是根据**如何捕获环境**而区分的，并不影响函数签名。`FnMut` 也可以接收所有权参数。

| Trait | 捕获方式 | 调用签名 | 可调用次数 |
|-------|----------|----------|------------|
| `FnOnce` | 获取所有权 | `fn call_once(self, args)` | 一次 |
| `FnMut` | 可变借用 | `fn call_mut(&mut self, args)` | 多次 |
| `Fn` | 不可变借用 | `fn call(&self, args)` | 多次 |

---

## 二、什么是零成本抽象

零成本抽象是 Rust 的核心设计哲学之一，其核心原则：

### 核心要点

1. **编译期完成工作**
   - 类型检查、泛型单态化、内联优化等在编译时完成

2. **零运行时开销**
   - 不引入额外的运行时检查或间接调用

3. **无额外内存分配**
   - 避免不必要的堆分配，尽可能使用栈内存

4. **透明优化**
   - 高级抽象在编译后生成的机器码与手写底层代码相当

### 具体体现

```rust
// 高级抽象：迭代器链
let sum: i32 = (1..=100)
    .filter(|x| x % 2 == 0)
    .map(|x| x * x)
    .sum();

// 编译后与手写循环性能相当：
let mut sum = 0;
for x in 1..=100 {
    if x % 2 == 0 {
        sum += x * x;
    }
}
```

这正是 Rust 能在提供高级语言特性的同时，仍能保持与 C/C++ 相媲美的性能的关键所在。
