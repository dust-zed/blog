+++
date = '2026-02-26T10:45:04+08:00'
draft = true
title = 'Option所有权和模式匹配总结'
+++

## 一、 核心问题

`Option<T>` 包含一个**拥有所有权**的 `T`，访问它时需要明确：**你要借用还是拿走**？

---

## 二、 四种访问方式

```rust
let mut opt = Some(String::from("hello"))
// 1. 直接匹配 -- 拿走所有权，消耗 opt
match opt {
  Some(s) => println!("{}", s), // s: String, opt 被 move
  None => {}
}
// opt 不能再用了

// 2. ref -- 借用，不消耗
match opt {
  Some(ref s) => println!("{}", s), // s: &String
  None => {}
}
// opt 还能用

// 3. ref mut -- 可变借用，不消耗
match opt {
  Some(ref mut s) => s.push_str(" world"), // s: &mut String
  None => {}
}
// opt还能用，且被修改了

// 4. take() -- 拿走值，留下 None
let inner = opt.take();  // inner: Option<String>, opt = None
// opt 还能用（现在是 None）
```

---

## 三、 类型对比

```rust
let opt: Option<String> = Some(String::from("hello"));

// 两种不同的类型
let a: &Option<String> = &opt; 		// 引用整个 Option
let b: Option<&String> = opt.as_ref();  // Option 里装引用

  // 内存视角：
  //
  // &Option<String>          Option<&String>
  // ┌──────────────┐         ┌──────────────┐
  // │ 指向整个     │         │ Some(指针)   │──┐
  // │ Option 结构  │──┐      └──────────────┘  │
  // └──────────────┘  │                        │
  //                   ▼                        ▼
  //              ┌──────────────┐        ┌──────────────┐
  //              │ Some(String) │        │   String     │
  //              │   ┌──────┐   │        │   "hello"    │
  //              │   │ptr   │───┼───────►│              │
  //              │   │len   │   │        └──────────────┘
  //              │   │cap   │   │
  //              │   └──────┘   │
  //              └──────────────┘

```

---

## 四、 ref vs as_ref() vs &

对 `Option<T>`进行操作

|   方式   |           语法            |    结果类型    |      使用场景      |
| :------: | :-----------------------: | :------------: | :----------------: |
|   ref    |        Some(ref s)        |       &T       |  只有在 match 中   |
| ref mut  |      Some(ref mut s)      |     &mut T     | 只有在 match 中，  |
|    &     | match &opt { Some(s) => } |       &T       |       match        |
| as_ref() |       opt.as_ref()        |   Option<&T>   | 任何地方，链式调用 |
| as_mut() |       opt.as_mut()        | Option<&mut T> |  任何地方，需修改  |

---

## 五、take() 的作用

```rust
let mut opt = Some(String::from("hello"));

// 问题：unwrap() 后 opt 变成未初始化状态
let value = opt.unwrap(); // opt 被部分 move
// opt = None;	// 不能赋值， opt 处于 "部分可用"的奇怪状态

// 解决： take() 取出值， 自动留下 None
let value = opt.take(); // value = Some("hello"), opt = None
opt = Some(String::from("world")); // 可以重新赋值
```

**使用场景**：需要 “拿出值”但还想继续使用这个变量。



