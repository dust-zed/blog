+++
date = '2025-10-11T11:56:55+08:00'
draft = true
title = 'WalkParallel的学习'
categories = ['rust', 'ripgrep']
tags = ['Rust', 'Ripgrep', 'Parallel', 'Walk']
description = "深入学习 Ripgrep 并行文件遍历机制：WalkParallel, WalkState, Visitor 模式及实现细节。"
slug = "walk-parallel"

+++

`WalkParallel`实现的功能是对目标文件并行遍历，采用的是**生产者-消费者模型**。

## 类说明

### WalkState

`WalkState`用于控制目录遍历的行为，特别适用于并行文件系统遍历的场景。

```rust
pub enum WalkState {
  Continue,
  Skip,
  Quit,
}
```

1. `Continue`
   * 默认状态，继续正常遍历
   * 如果是目录，会递归进入该目录
2. `Skip`
   * 仅当当前条目是目录时有效
   * 跳过该目录，不进入遍历
   * 对文件条目无影响
3. `Quit`
   * 请求终止整个遍历过程
   * 由于并行遍历的特性，可能还会有一些条目被处理
   * 通常用于找到目标后提前退出

### Visitor相关

和`Visitor`相关的类用于定义对文件系统条目的具体处理行为。逐步拆解每个相关类。

#### ParallelVistor Trait

```rust
pub trait ParallelVisitor: Send {
  fn visit(&mut self, entry: Result<DirEntry, Error>) -> WalkState
}
```

* 这是一个访问者接口，定义了如何处理每个文件/目录条目
* `visit`方法接收一个`DirEntry`或错误，返回`WalkState`来控制遍历行为

#### ParallelVisitorBuilder<'s>

```rust
pub trait ParallelVistorBuilder<'s> {
  fn build(&mut self) -> Box<dyn ParallelVisitor + 's>;
}

impl<'a, 's, P: ParallelVisitorBuilder<'s>> ParallelVisitorBuilder<'s> 
		for &'a mut P
{
  fn build(&mut self) ->Box<dyn ParallelVisitor + 's> {
    (**self).build()
  }
}
```

`ParallelVisitorBuilder`定义了如何构造`visitor`，这里主要是涉及到了常见的Rust模式，称为**reference implementation**.这样就可以不转移`Builder`的所有权了，在需要多次调用`build()`时，可以避免所有权问题。

### FnVisitor

```rust
type FnVisitor<'s> = 
		Box<dyn FnMut(Result<DirEntry, Error>) -> WalkState + Send + 's>;
```

* 这是一个可调用对象类型别名，用于简化闭包的存储
* `Send`和`'s`都是修饰闭包的，`Send`保证可以安全的在线程间传递，`'s`确保闭包不会比它捕获的引用活的更久

### FnVisitorImp

```rust
struct FnVisitImp<'s> {
  visitor: FnVisitor<'s>,
}
impl<'s> ParallelVisitor for FnVisitImp<'s> {
    fn visit(&mut self, entry: Result<DirEntry, Error>) -> WalkState {
        (self.visitor)(entry)
    }
}
```

* 包装了`FnVisitor`，实现了`ParallelVisitor`trait
* 将`visit`调用委托给内部的闭包
