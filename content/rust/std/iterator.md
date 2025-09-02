+++
date = '2025-09-02T10:12:13+08:00'
draft = true
title = 'Iterator'
categories = ['rust', 'std']

+++

标准库的`Iterator`源码学习。

**常见变量命名**:

* `acc`：是“accumulator”（累加器）的缩写，在函数式编程中用于表示累积计算过程中的中间结果。
* `fold`：是一个高阶函数，用于将集合中的所有元素通过一个操作“折叠”成单个值。

#### 1. 基础结构

```rust
//这是 Iterator trait 的定义
pub trait Iterator {
  type Item;
  
  //必需方法：获取下一个元素
  fn next(&mut self) -> Option<Self::Item>;
  
  //提供默认实现方法
  //这里有很多实用方法，我们重点看几个关键的
}
```

#### 2. 核心方法

```rust
fn next(&mut self) -> Option<Self::Item>;
```

* 这是迭代器最基础的方法
* 每次调用返回`Some(item)`或`None`（表示迭代结束）

#### 3. 常用方法实现

让我们看看`map`的实现：

```rust
fn map<B, F>(self, f: F) -> Map<Self, F>
where
    Self: Sized,
    F: FnMut(Self::Item) -> B,
{
    Map::new(self, f)
}

// Map 结构体
pub struct Map<I, F> {
    iter: I,
    f: F,
}

impl<B, I: Iterator, F> Iterator for Map<I, F>
where
    F: FnMut(I::Item) -> B,
{
    type Item = B;

    fn next(&mut self) -> Option<B> {
      	//由Option的方法完成map操作
        self.iter.next().map(&mut self.f)
    }
}
```

#### 4. 其他重要方法

`collect`方法

```rust
fn collect<B: FromIterator<Self::Item>>(self) -> B
where
    Self: Sized,
{
    FromIterator::from_iter(self)
}
```

`filter`方法

```rust
fn filter<P>(self, predicate: P) -> Filter<Self, P>
where
    Self: Sized,
    P: FnMut(&Self::Item) -> bool,
{
    Filter::new(self, predicate)
}
```

#### 5. 高级特性： `try_fold`

```rust
fn try_fold<B, F, R>(&mut self, init: B, mut f: F) -> R
where
    Self: Sized,
    F: FnMut(B, Self::Item) -> R,
    R: Try<Output = B>,
{
    let mut accum = init;
    while let Some(x) = self.next() {
        accum = f(accum, x)?;
    }
    Try::from_ok(accum)
}
```

#### 6. 实际使用示例

```rust
// 自定义迭代器示例
struct Counter {
    count: usize,
    max: usize,
}

impl Iterator for Counter {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count < self.max {
            let result = Some(self.count);
            self.count += 1;
            result
        } else {
            None
        }
    }
}

// 使用自定义迭代器
let sum: usize = Counter { count: 0, max: 5 }
    .map(|x| x * 2)
    .filter(|x| x % 3 == 0)
    .sum();
```

#### 7. 迭代器组合器

标准库中还有许多有用的迭代器适配器：

- `take`/`take_while`
- `skip`/`skip_while`
- `zip`
- `chain`
- `enumerate`
- `peekable`
- `fuse`

#### 8. 性能考虑

Rust迭代器的零成本抽象：

* 通常会被优化成与手写循环相同的机器码
* 内联优化使得方法调用开销被消除
* 迭代器链会被优化形成单个循环

#### 9. 结构

迭代器大部分需要消耗self的方法，都是新建了一个新迭代器，如`map`之于`Map`，`filter`之于`Filter`。这种设计模式称为“迭代器适配器模式”，它有几个关键优势：

1. **惰性求值**：构建新迭代器不会立即执行计算，直到调用消费方法（如`collect`或`for`循环）才会真正处理数据。
2. **组合性**：每个适配器只关注单一职责，可以通过链式调用任意组合
3. **内存高效**：不需要为中间结果分配额外内存，数据流是管道式的。
