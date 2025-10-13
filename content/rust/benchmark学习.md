+++
date = '2025-10-13T10:33:08+08:00'
draft = false
title = 'Benchmark学习'
categories = ['rust']

+++

#### benchmark核心

所有语言的**Benchmark**都在做：

* 计时 - 测量执行时间
* 重复 - 多次运行取平均
* 统计 - 计算均值、标准差
* 对比 - 比较不同实现

**通用流程**

```bash
预热 → 测量 → 统计 → 报告 （防优化）
```

**预热**: 跳过缓存未命中的初测

#### Criterion

`Criterion`是rust中最现代化的benchmark库，接下来跟着例子一步步深入了benchmark。

#### 入门

```rust
#![allow(unused)]
fn main() {
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mycrate::fibonacci;

pub fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
}

```

##### 1. `bench_function`方法

```rust
c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
```

* **作用**：定义一个基准测试用例
* **参数**:
  * `fib 20`： 测试用例的名称（用于结果报告）
  * 闭包函数：包含实际的测试逻辑
* **闭包内部**
  * `b`:   `Bencher`对象(自动传入)
  * `b.iter(|| ...)`：运行被测代码多次并测量时间
  * `black_box(20)`：阻止编译器优化(确保真实计算)
  * `fibonacci(20)`：实际被测函数

##### 2. `criterion_group!`宏

```rust
criterion_group!(benches, criterion_benchmark);
```

* **作用**：创建基准测试组
* **参数**：
  * `benches`：组名称（自定义标识符）
  * `criterion_benchmark`：包含测试的函数名（本例中的基准函数）
* **特性**：
  * 将多个基准测试组织成组
  * 支持添加多个测试函数
  * 生成对应的 `bench_` 开头的函数（如`benches_benchmark`）

##### 3. `criterion_main!`宏

```rust
criterion_main!(benches);
```

* **作用**：生成基准测试的入口函数
* **参数**：
  * `benches`：前面定义的测试组名
* **功能**：
  * 自动生成`main()`函数
  * 配置并运行所有指定的测试组
  * 处理命令行参数（如 `--filter`, `--savebaseline`）

##### 4. `benches`的来源

```rust
criterion_group!(benches, ...);
//             ^^^^^^ 这里定义
criterion_main!(benches);
//             ^^^^^^ 这里使用
```

- `benches` 是由 `criterion_group!` **宏创建的自定义标识符**
- 在 `criterion_main!` 中引用时：
  1. 查找同名测试组
  2. 将组内测试函数添加到执行队列
  3. 生成报告和图表

#### 进阶

```rust
// 使用 benchmark_group 组织测试
let mut group = c.benchmark_group("data_structures");

group.sample_size(100);  // 配置采样
group.measurement_time(Duration::from_secs(5));

// ... 多个相关测试

group.finish();
```

##### `benchmark_group`方法

* 作用： 创建共享配置的容器，作为多个相关测试的配置载体
* 必须被包含在 `criterion_group!` 注册的测试函数中，并由其调度执行。

#### 理解统计输出

```bash
time:   [123.45 µs 125.67 µs 128.90 µs]
        ↑          ↑          ↑
      下界      中位数       上界

change: [-5.23% +2.34% +10.23%]
        ↑        ↑       ↑
      最好    预期变化  最坏

Found 3 outliers among 100 measurements
  2 high mild    ← 稍微偏高
  1 high severe  ← 严重偏高
```

#### 例子

##### 1. 参数化测试

```rust
// 测试不同输入大小
let mut group = c.benchmark_group("fibonacci");
for i in [10, 15, 20, 25].iter() {
    group.bench_with_input(
        BenchmarkId::from_parameter(i),
        i,
        |b, &i| b.iter(|| fibonacci(black_box(i)))
    );
}
group.finish();
```

##### 2. 对比多个实现

```rust
let mut group = c.benchmark_group("sum");

group.bench_function("for_loop", |b| {
    b.iter(|| sum_for_loop(black_box(&data)))
});

group.bench_function("iterator", |b| {
    b.iter(|| sum_iterator(black_box(&data)))
});

group.finish();
```

##### 吞吐量测量

```rust
let mut group = c.benchmark_group("throughput");

// 设置吞吐量单位
group.throughput(Throughput::Bytes(data.len() as u64));

group.bench_function("process", |b| {
    b.iter(|| process(black_box(&data)))
});

// 报告会显示 MB/s
```

##### 自定义配置

```rust
group.sample_size(1000);              // 样本数
group.warm_up_time(Duration::from_secs(3));  // 预热时间
group.measurement_time(Duration::from_secs(10)); // 测量时间
group.noise_threshold(0.05);          // 噪音阈值
```
