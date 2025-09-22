+++
date = '2025-09-22T12:19:53+08:00'
draft = false
title = 'Regex'
categories = ['rust', 'docs_rs']

+++

这个crate提供了在字符串中搜索与正则表达式匹配(`regular expression`简称`regex`)的例程。本库支持的正则表达式语法和其他正则引擎相似，但是缺少了一些无法高效实现的功能。包括但不限于，`look-around`和`backrefernces`。相应的，本库的正则搜索最差的时间复杂度是`O(m * n)`，`m`和正则表达式成正比，`n`和被搜索的字符串成正比。

如果你只需要API文档，只需要跳转至[Regex][https://docs.rs/regex/latest/regex/struct.Regex.html]类型。否则，此处是快速示例，展示如何解析类似grep程序的输出：

```rust
use regex::Regex;

let re = Regex::new(r"(?m)^([^:]+):([0-9]+):(.+)$").unwrap();
let hay = "\
path/to/foo:54:Blue Harvest
path/to/bar:90:Something, Something, Something, Dark Side
path/to/baz:3:It's a Trap!
";

let mut results = vec![];
for (_, [path, lineno, line]) in re.captures_iter(hay).map(|c| c.extract()) {
    results.push((path, lineno.parse::<u64>()?, line));
}
assert_eq!(results, vec![
    ("path/to/foo", 54, "Blue Harvest"),
    ("path/to/bar", 90, "Something, Something, Something, Dark Side"),
    ("path/to/baz", 3, "It's a Trap!"),
]);
```

#### 概述

----------------

本库的主要类型是`Regex`。其重要的方法如下：

* `Regex::new`使用默认配置编译正则表达式。`RegexBuilder`允许配置非默认配置。（例如，不区分大小写匹配，详细模式等。）
* `Regex::is_match` 报告在特定的haystack是否存在匹配。
* `Regex::find`报告匹配项在haystack的字节偏移，如果存在的话。`Regex::find_iter`返回一个迭代器，用于遍历所有匹配项。
* `Regex::captures`返回`Captures`,它报告了在haystack中匹配的字节偏移量以及从haystack中的regex匹配的每个捕获组的字节偏移量。

也有`RegexSet`，它允许在一次搜索中搜索多个正则表达式。然而，它只报告匹配的模式而不报告匹配的字节偏移量。

此外，顶级crate文档组织如下：

* [Usage](#Usage)展示了如何在Rust工程中添加`regex`。
* [Examples](#Examples)提供了有限的正则表达式示例。
* [Performance][]提供了如何优化正则搜索速度的简单总结。
* [Unicode][]讨论了对non-ASCII的支持。
* [Syntax][]列举了本库明确支持的正则表达式语法。
* [Untrusted input][]讨论了本库如何处理不受信任的regex或haystack。
* [Crate features][]记录了这个库可以被启用或禁用的特性。
* [Other crates][]与正则家族中其他库链接。



#### Usage

`regex`在 [crates.io][https://crates.io/crates/regex]上，可以通过在项目`Cargo.toml`文件添加`regex`到你的依赖项来使用。更简单的方式，只需要`cargo run regex`。

这是一个完整的示例，它创建了一个新的 Rust 项目，添加了对 `regex` 的依赖，创建了正则搜索的源代码，然后运行了程序。

第一步，在新目录新建项目：

```bash
$ mkdir regex-example
$ cd regex-example
$ crago init
```

第二步，添加`regex`依赖：

```bash
$ cargo add regex
```

第三步：编辑`src/main.rs`，用以下内容替换其源码：

```rust
use regex::Regex;

fn main() {
    let re = Regex::new(r"Hello (?<name>\w+)!").unwrap();
    let Some(caps) = re.captures("Hello Murphy!") else {
        println!("no match!");
        return;
    };
    println!("The name is: {}", &caps["name"]);
}
```

第四步，执行`cargo run`运行

```bash
$ cargo run
   Compiling memchr v2.5.0
   Compiling regex-syntax v0.7.1
   Compiling aho-corasick v1.0.1
   Compiling regex v1.8.1
   Compiling regex-example v0.1.0 (/tmp/regex-example)
    Finished dev [unoptimized + debuginfo] target(s) in 4.22s
     Running `target/debug/regex-example`
The name is: Murphy
```

程序第一次运行将展示更多输出，如上所示。但是后续运行不需要重新编译依赖项。、

#### Examples

-----------

本节提供了一些示例，以教程风格展示如何使用正则表达式在haystack中进行搜索。API文档中还有更多示例。

在开始之前，有必要定义一些术语：

* **regex**是类型为`Regex`的值。我们用`re`作为正则表达式的变量名。
* **pattern**用于构建正则表达式的字符串。我们用`pat`作为模式的变量名。
* **haystack**是被正则表达式搜索的字符串。我们用`hay`作为haystack的变量名。

有时候“regex”和“pattern”这两个词会被互换使用。

在这个crate中，常规表达式的一般使用方法是将一个模式编译成一个正则表达式，然后使用该正则表达式来搜索、分割或替换字符串的一部分。

---------

[原地址][https://docs.rs/regex/latest/regex/ ]

---------

#### 单词

- `verbose`:
  -  `adj.` 冗长的，啰嗦的
- `routine`: 
  - `n.` 常规， 无聊
  - `adj.` 常规的，无聊的
- `subsequent`：
  - `adj.`随后的，后来的
