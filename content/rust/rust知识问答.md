+++
date = '2025-09-01T17:16:28+08:00'
draft = false
title = 'Rust知识问答'
categories = ['rust']

+++

##### 为什么FnOnce只能调用一次

###### 源码分析

```rust
pub trait FnOnce<Args> {
    type Output;
    extern "rust-call" fn call_once(self, args: Args) -> Self::Output;
}
```

1. `self`的含义
   * 接收实现了`FnOnce`的具体类型的值
   * 这个值会被移动(move)进方法

###### 具体例子

假设我们有一个闭包:

```rust
let s = String::from("hello");
let f = || {
    println!("{}", s);  // 获取 s 的所有权
    s.len()
};
```

当这个闭包实现`FnOnce`时

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

###### 调用示例

```rust
let result = f();  // 等价于 FnOnce::call_once(f, ())
// 这里不能再调用 f()，因为 f 已经被移动
```

最终f所有权被转移进`call_once`，并随着call_once的结束而`drop`了，f被释放了，内部捕获的所有权自然也被释放。

`FnOnce`、`FnMut`、`Fn`这些是根据如何捕获环境而区分的，并不影响函数签名，`FnMut`也可以接收**所有权参数**

##### 什么是零成本抽象

零成本抽象的核心就是：

1. **编译期完成工作**：类型检查、泛型单态化、内联优化等在编译时完成
2. **零运行时开销**：不引入额外的运行时检查或间接调用
3. **无额外内存分配**：避免不必要的堆分配，尽可能使用栈内存
4. **透明优化**：高级抽象在编译后生成的机器码与手写底层代码相当

这正是 Rust 能在提供高级语言特性的同时，仍能保持与 C/C++ 相媲美的性能的关键所在。
