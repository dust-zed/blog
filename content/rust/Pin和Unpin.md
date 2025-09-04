+++
date = '2025-09-04T15:03:11+08:00'
draft = true
title = 'Pin和Unpin'
categories = ['rust']

+++

#### Pin和Unpin的基本概念

##### Pin的作用

`Pin<P>`是一个包装器，用于固定(pin)内存中的值，防止它被移动。这对于自引用结构体和异步编程中的Future特别重要。

##### Unpin的特质

`Unpin`是一个自动派生的标记trait，表示类型可以安全地移出`Pin`。大多数类型都自动实现了`Unpin`。实现了`Unpin`的类型可以安全地从`Pin`中移出。

#### async/await为何需要Pin

* `async`块可能包含自引用，`async`转变为`Future`结构体,它是一个状态机
* 当`.await`暂停执行时，局部变量会保存在生成的Future中
* 如果这些变量相互引用，移动Future会导致悬垂指针

#### 生命周期管理层次

##### 1. 变量级别

* 局部变量被移动到Future状态机中
* 生命周期与Future示例绑定

##### 2. Future级别

* 由执行器拥有和管理
* 执行器决定何时poll，何时drop

##### 3. 执行器级别

* 管理所有Future的生命周期
* 负责调度和管理

##### 4. 栈帧与状态机

* 同步：变量生命周期由栈帧管理
* 异步：变量生命周期由状态机管理

#### 任务队列与Future

##### 一次性移动

* Future被移动到执行器后，由Pin保证不会再次移动
* 执行器内部使用指针来引用Future

##### 任务队列的实现

```rust
// 伪代码：任务队列中的 Future
struct Task {
    future: Pin<Box<dyn Future<Output = ()> + Send>>,
    // ...
}

// 任务队列存储的是 Box<Task>，而不是直接存储 Future
let task_queue: Vec<Box<Task>> = ...;
```

##### 工作窃取调度

* 当任务在线程间转移时，转移的是`Box<Task>`
* `Box`的移动不会影响内部Future的内存地址
* Pin 保证的是 `Box` 内部的 Future 不会被移出
