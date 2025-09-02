+++
date = '2025-09-02T08:29:31+08:00'
draft = true
title = 'Std_todolist'
categories = ['rust', 'std']

+++

# Rust 标准库学习清单

## 1. 核心基础
- [x] `core::option` - `Option<T>` 类型
- [x] `core::result` - `Result<T, E>` 类型
- [ ] `core::iter` - 迭代器
- [ ] `core::marker` - 标记 trait
- [ ] `core::mem` - 内存操作
- [ ] `core::ops` - 操作符重载

## 2. 集合类型
- [ ] `alloc::vec::Vec` - 动态数组
- [ ] `alloc::collections` - 集合类型
  - [ ] `VecDeque` - 双端队列
  - [ ] `LinkedList` - 双向链表
  - [ ] `HashMap`/`HashSet` - 哈希表/集合
  - [ ] `BTreeMap`/`BTreeSet` - B树映射/集合
  - [ ] `BinaryHeap` - 二叉堆

## 3. 字符串处理
- [ ] `std::string::String` - 可增长字符串
- [ ] `std::str` - 字符串切片
- [ ] [std::fmt](cci:1://file:///Users/zed/ripgrep/crates/ignore/src/walk.rs:255:4-264:5) - 格式化输出
- [ ] [std::path](cci:1://file:///Users/zed/ripgrep/crates/ignore/src/walk.rs:35:4-38:5) - 路径处理

## 4. 并发编程
- [ ] `std::thread` - 线程
- [ ] `std::sync` - 同步原语
  - [ ] `Mutex`/`RwLock` - 互斥锁/读写锁
  - [ ] `Arc`/`Rc` - 原子/引用计数
  - [ ] `mpsc` - 多生产者单消费者通道
- [ ] `std::sync::atomic` - 原子操作

## 5. 异步编程
- [ ] `std::future::Future` - Future trait
- [ ] `std::task` - 异步任务
- [ ] `std::pin` - 固定内存

## 6. 文件和I/O
- [ ] `std::fs` - 文件系统操作
- [ ] `std::io` - 输入/输出
  - [ ] `Read`/`Write` traits
  - [ ] `BufReader`/`BufWriter`
  - [ ] `Stdout`/`Stdin`/`Stderr`

## 7. 错误处理
- [ ] `std::error::Error` - 错误 trait
- [ ] `std::panic` - 恐慌处理
- [ ] `std::result` - 错误处理惯用法

## 8. 时间和日期
- [ ] `std::time` - 时间处理
- [ ] `std::time::Duration` - 持续时间
- [ ] `std::time::Instant` - 时间点

## 9. 类型转换
- [ ] `std::convert` - 类型转换
  - [ ] `From`/`Into` traits
  - [ ] `TryFrom`/`TryInto` traits
  - [ ] `AsRef`/`AsMut` traits

## 10. 宏系统
- [ ] `std::macros` - 标准宏
- [ ] [std::fmt](cci:1://file:///Users/zed/ripgrep/crates/ignore/src/walk.rs:255:4-264:5) - 格式化宏
- [ ] `std::assert` - 断言宏

## 学习建议

1. **按顺序学习**：从核心基础开始，逐步深入
2. **动手实践**：为每个模块编写示例代码
3. **阅读源码**：理解标准库的实现
4. **参考文档**：善用 [docs.rs](https://docs.rs) 和 Rust 官方文档
