+++
date = '2025-09-01T10:21:06+08:00'
draft = false
title = 'Result'
categories = ['rust', 'std']

+++

标准库的`Result`源码学习。

#### 1. 基础结构

```rust
#[must_use = "this `Result` may be an `Err` variant, which should be handled"]
pub enum Result<T, E> {
    /// Contains the success value
    #[lang = "Ok"]
    #[stable(feature = "rust1", since = "1.0.0")]
    Ok(#[stable(feature = "rust1", since = "1.0.0")] T),

    /// Contains the error value
    #[lang = "Err"]
    #[stable(feature = "rust1", since = "1.0.0")]
    Err(#[stable(feature = "rust1", since = "1.0.0")] E),
}
```

##### 学习点

* `#[must_use]`属性确保开发者必须处理可能的错误
* 使用泛型`T`和`E`支持任何类型
* `#[lang]`属性表示这是语言项(lang item)

#### 2. 基础方法：`is_ok`和`is_err`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub const fn is_ok(&self) -> bool {
  matches!(*self, Ok(_))
}
```

##### 学习点

* `#[inline]`提示编译器内联优化
* `const fn` 表示编译期可求值
* 使用`matches!`宏进行模式匹配

#### 3. 所有权管理：`as_ref`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub const fn as_ref(&self) -> Result<&T, &E> {
  match *self {
    Ok(ref x) => Ok(x),
    Err(ref x) => Err(x),
  }
}
```

##### 学习点

* 返回引用避免所有权转移
* 使用`ref`模式匹配获取引用
* 保持原始`Result`不变

#### 4. 组合子：`map`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn map<U, F: FnOnce(T) -> U>(self, op: F) -> Result<U, E> {
  match self {
    Ok(t) => Ok(op(t)),
    Err(e) => Err(e),
  }
}
```

##### 学习点

* 高阶函数的使用
* `FnOnce` trait bound允许消费值的闭包
* 模式匹配解构`self`

#### 5. 链式调用：`and_then`

```rust
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn and_then<U, F: FnOnce(T) -> Result<U, E>>(self, op: F) -> Result<U, E> {
    match self {
        Ok(t) => op(t),
        Err(e) => Err(e),
    }
}
```

##### 学习点

* 错误传播模式
* 闭包作为参数
* 组合操作的优雅方式

#### 6. `?`操作符

```rust
#[unstable(feature = "try_trait_v2", issue = "84277")]
#[rustc_const_unstable(feature = "const_convert", issue = "88674")]
impl<T, E> ops::Try for Result<T, E> {
    type Output = T;
    type Residual = Result<!, E>;

    #[inline]
    fn from_output(output: Self::Output) -> Self {
        Ok(output)
    }

    #[inline]
    fn branch(self) -> ControlFlow<Self::Residual, Self::Output> {
        match self {
            Ok(v) => ControlFlow::Continue(v),
            Err(e) => ControlFlow::Break(Err(e)),
        }
    }
}
```

##### 学习点

* 操作符重载
* 控制流抽象
* 编译器魔法背后的实现

#### 7. 迭代器集成

```rust
#[stable(feature = "rust1", since = "1.0.0")]
impl<T, E> IntoIterator for Result<T, E> {
    type Item = T;
    type IntoIter = IntoIter<T>;

    #[inline]
    fn into_iter(self) -> IntoIter<T> {
        IntoIter { inner: self.ok() }
    }
}
```

##### 学习点

* 迭代器模式
* 类型转换
* 零成本抽象
