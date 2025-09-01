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
