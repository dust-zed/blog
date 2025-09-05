+++
date = '2025-09-05T18:49:07+08:00'
draft = true
title = '普通对象和trait对象'
categories = ['rust']

+++

#### 普通对象的内存结构

* 只包含数据成员
* 方法不占用内存空间
* 方法调用是静态分发的，方法存储在代码段中，调用时直接跳转到固定地址

```rust
struct Point {
  x: i32,
  y: i32,
}
///内存结构
+------+------+
| x: 4 | y: 4 |  // 8 字节 (i32 是 4 字节)
+------+------+
```

#### trait对象内存结构

* 由两个指针组成
  * 数据指针：指向实际数据的指针
  * 虚表指针：指向虚表的指针
* 虚表包含
  * 析构函数指针
  * 类型大小和对齐信息
  * trait中所有方法的函数指针

```rust
trait Shape {
    fn area(&self) -> f64;
    fn scale(&mut self, factor: f64);
}

struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
    
    fn scale(&mut self, factor: f64) {
        self.radius *= factor;
    }
}

let circle: Box<dyn Shape> = Box::new(Circle { radius: 1.0 });
```

##### 内存布局

```rust
+------------------+     +------------------+
| 数据指针          | --> | radius: f64      |
+------------------+     +------------------+
| 虚表指针          | --> +------------------+
+------------------+    | 指向 Circle 的虚表 |
                        +------------------+
                        | drop_in_place    |  // 析构函数
                        | size             |  // 类型大小
                        | align            |  // 对齐方式
                        | area() 函数指针   |  // 第一个 trait 方法
                        | scale() 函数指针  |  // 第二个 trait 方法
                        +------------------+
```

#### 方法调用过程

* **普通对象方法**: 普通对象方法存储在代码段中，不占用对象内存，调用时直接跳转到固定地址。
* **trait对象方法**：
  * 获取虚表指针
  * 从虚表中获取函数指针
  * 调用函数
