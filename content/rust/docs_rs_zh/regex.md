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

##### Example: find a middle intial

------------

我们从一个非常简单的例子开始：一个正则表达式，用于查找特定的名称，但使用通配符来匹配中间名。

```rust
use regex::Regex;

// We use 'unwrap()' here because it would be a bug in our program if the
// pattern failed to compile to a regex. Panicking in the presence of a bug
// is okay.
let re = Regex::new(r"Homer (.)\. Simpson").unwrap();
let hay = "Homer J. Simpson";
let Some(caps) = re.captures(hay) else { return };
assert_eq!("J", &caps[1]);
```

在第一个例子有些值得注意的地方：

* `.` 是一个特殊的模式元字符，表示“匹配任何单个字符，除了换行符。”（更精确地说，在这个 crate 中，表示“匹配任何 UTF-8 编码的任何 Unicode 标量值，除了 \n。”）
* 我们可以用转义字符来匹配实际的点号，即` \.`。
* 我们使用 Rust 的原始字符串来避免在正则表达式模式语法和 Rust 的字符串字面量语法中处理转义序列。如果我们不使用原始字符串，我们需要使用`\\.`去匹配字符`.`。`r"\."`和`\\.`是等效的模式。
* 我们将通配符` \.` 指令放在括号中。这些括号具有特殊含义，表示“将 haystack 中与这些括号匹配的部分作为捕获组可用”。找到匹配后，我们使用 &caps[1] 访问此捕获组。

否则，我们使用 `re.captures(hay) `执行搜索，并在没有匹配时从我们的函数中返回。然后，我们通过询问与捕获组索引为`1`的部分匹配的haystack的那一部分来引用中间名。（索引为0的捕获组是隐式的，总是对应整个匹配。在这种情况下，那就是`Homer J. Simpson`。）

##### Example: named capture groups

------

在我们上面的中间初始示例中，我们可以稍微调整一下模式，给匹配中间初始的组命名：

```rust
use regex::Regex;
// Note that (?P<middle>.) is a different way to spell the same thing.
let re = Regex::new(r"Homer (?<middle>.)\. Simpson").unwrap();
let hay = "Homer J. Simpson";
let Some(caps) = re.captures(hay) else {return};
assert_eq!("J", &caps["middle"]);
```

给一组命名在模式中有多个组时很有用。它使引用这些组的代码更容易理解。

##### Example: validating a particular date format

----------

这个示例展示了如何确认一个字符串（haystack）是否完全匹配某个特定的日期格式：

```rust
use regex::Regex;

let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
assert!(re.is_match("2010-03-14"));
```

注意 `^` 和 `$` 锚点的使用。在这个crate中，每个正则表达式搜索都会在其模式的开头隐式地加上`(?s:.)*?`，这使得正则表达式可以在haystack的任何位置进行匹配。正如上面所提到的，锚点可以用来确保整个haystack匹配一个模式。

这个 crate 默认是 Unicode 感知的，这意味着 `\d `可能会匹配你可能预期的更多内容。例如：

```rust
use regex::Regex;

let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
assert!(re.is_match("𝟚𝟘𝟙𝟘-𝟘𝟛-𝟙𝟜"));
```

要仅匹配ASCII十进制数字，以下所有内容都是等效的：

* `[0-9]`
* `[?-u:\d]`
* `[[:digit:]]`
* `[\d&&\p{ascii}]`

##### Example: find dates in a haystack

-------

在之前的例子中，我们展示了如何验证整个haystack是否对应于特定的日期格式。但是，如果我们想要从一大堆数据中提取出特定格式看起来像日期的所有东西，该怎么办？要实现这一点，我们可以使用一个迭代器API来查找所有匹配项（请注意，我们已经移除了锚点并切换到查找仅包含ASCII字符的数字）：

```rust
use regex::Regex;

let re = Regex::new(r"[0-9]{4}-[0-9]{2}-[0-9]{2}").unwrap();
let hay = "What do 1865-04-14, 1881-07-02, 1901-09-06 and 1963-11-22 have in common?";
// 'm' is a 'Match', and 'as_str()' returns the matching part of the haystack.
let dates: Vec<&str> = re.find_iter(hay).map(|m| m.as_str()).collect();
assert_eq!(dates, vec![
    "1865-04-14",
    "1881-07-02",
    "1901-09-06",
    "1963-11-22",
]);
```

我们也可以遍历捕获值（`Captures`）而不是匹配值（`Match`），这样就可以通过捕获组访问日期的每个组件：

```rust
use regex::Regex;

let re = Regex::new(r"(?<y>[0-9]{4})-(?<m>[0-9]{2})-(?<d>[0-9]{2})").unwrap();
let hay = "What do 1865-04-14, 1881-07-02, 1901-09-06 and 1963-11-22 have in common?";
// 'm' is a 'Match', and 'as_str()' returns the matching part of the haystack.
let dates: Vec<(&str, &str, &str)> = re.captures_iter(hay).map(|caps| {
    // The unwraps are okay because every capture group must match if the whole
    // regex matches, and in this context, we know we have a match.
    //
    // Note that we use `caps.name("y").unwrap().as_str()` instead of
    // `&caps["y"]` because the lifetime of the former is the same as the
    // lifetime of `hay` above, but the lifetime of the latter is tied to the
    // lifetime of `caps` due to how the `Index` trait is defined.
    let year = caps.name("y").unwrap().as_str();
    let month = caps.name("m").unwrap().as_str();
    let day = caps.name("d").unwrap().as_str();
    (year, month, day)
}).collect();
assert_eq!(dates, vec![
    ("1865", "04", "14"),
    ("1881", "07", "02"),
    ("1901", "09", "06"),
    ("1963", "11", "22"),
]);
```

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
- `wildcard`:
  - `n.`通配符
- `tweak`
  - 
