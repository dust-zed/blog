+++
date = '2025-09-01T10:59:09+08:00'
draft = false
title = 'Option'
categories = ['rust', 'std']

+++

标准库`Option`源码学习

#### 基础结构

```rust
#[derive(Copy, PartialEq, PartialOrd, Eq, Ord, Debug, Hash)]
#[rustc_diagnostic_item = "Option"]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum Option<T> {
    /// No value
    #[lang = "None"]
    #[stable(feature = "rust1", since = "1.0.0")]
    None,
    /// Some value `T`
    #[lang = "Some"]
    #[stable(feature = "rust1", since = "1.0.0")]
    Some(#[stable(feature = "rust1", since = "1.0.0")] T),
}
```

##### 学习点

* `#[lang = "..."]`属性表示这是语言项
* 泛型参数T支持任何类型
* 自动派生多个trait(`Copy`，`PartialEq`等)

#### 2. 核心方法:`map`和`map_or`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> Option<U> {
    match self {
        Some(x) => Some(f(x)),
        None => None,
    }
}

#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn map_or<U, F: FnOnce(T) -> U>(self, default: U, f: F) -> U {
    match self {
        Some(t) => f(t),
        None => default,
    }
}
```

##### 学习点

* map保留Some/None结构
* map_or提供默认值
* 使用FnOnce因为闭包最多被调用一次

#### 3.解引用实现

```rust
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: Deref> Deref for Option<T> {
    type Target = Option<T::Target>;

    fn deref(&self) -> &Self::Target {
        match self {
            Some(t) => Some(t.deref()),
            None => &None,
        }
    }
}
```

##### 学习点

* 为`Option<Box<T>>`等类型提供自动解引用
* 实现`Deref`而不是直接实现方法，保持一致性

#### 4. `and_then`和`or_else`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn and_then<U, F: FnOnce(T) -> Option<U>>(self, f: F) -> Option<U> {
    match self {
        Some(x) => f(x),
        None => None,
    }
}

#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn or_else<F: FnOnce() -> Option<T>>(self, f: F) -> Option<T> {
    match self {
        Some(x) => Some(x),
        None => f(),
    }
}
```

##### 学习点

* `and_then`用于链式操作
* `or_else`提供回退逻辑
* 闭包`F`只在需要时调用

#### 5. `transpose`方法

```rust
#[inline]
#[stable(feature = "transpose_result", since = "1.33.0")]
pub fn transpose(self) -> Result<Option<T, E>>
{
    match self {
        Some(Ok(ok)) => Ok(Some(ok)),
        Some(Err(err)) => Err(err),
        None => Ok(None),
    }
}
```

##### 学习点

* 在`Option`和`Result`之间转换
* 保持错误传播语义

#### 6. `zip`和`zip_with`

```rust
#[stable(feature = "option_zip_option", since = "1.46.0")]
pub fn zip<U>(self, other: Option<U>) -> Option<(T, U)> {
    match (self, other) {
        (Some(a), Some(b)) => Some((a, b)),
        _ => None,
    }
}

#[unstable(feature = "option_zip", issue = "70086")]
pub fn zip_with<U, F: FnOnce(T) -> Option<U>>(self, f: F) -> Option<U> {
    match self {
        Some(x) => f(x),
        None => None,
    }
}
```

##### 学习点

* `zip`组合两个`Option`值
* `zip_with`提供更灵活的转换
* 使用元组模式匹配处理组合逻辑

#### 7. 性能优化：`Option<&T>`

```rust
// 编译器对 Option<&T> 有特殊优化
// size_of::<Option<&T>>() == size_of::<&T>()

#[stable(feature = "rust1", since = "1.0.0")]
impl<T> Option<&T> {
    #[inline]
    pub fn copied(self) -> Option<T>
    where
        T: Copy,
    {
        self.map(|&t| t)
    }

    #[inline]
    pub fn cloned(self) -> Option<T>
    where
        T: Clone,
    {
        self.map(|t| t.clone())
    }
}
```

##### 学习点

* 零成本抽象
* 为引用类型提供特化实现
* `Copy`和`Clone`的区别处理
