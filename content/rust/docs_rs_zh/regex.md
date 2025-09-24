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
* [Performance](#Performance)提供了如何优化正则搜索速度的简单总结。
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
(?<name>pattern)
 │ │    │       │
 │ │    │       └─ 捕获组的模式
 │ │    └─────────── 捕获组的名称
 │ └─────────────────── 命名语法的开始
 └────────────────────── 捕获组的开始
```

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

##### Example: simpler capture group extraction

--------

可以使用` Captures::extract` 将前一个示例中的代码简化一些：

```rust
use regex::Regex;

let re = Regex::new(r"([0-9]{4})-([0-9]{2})-([0-9]{2})").unwrap();
let hay = "What do 1865-04-14, 1881-07-02, 1901-09-06 and 1963-11-22 have in common?";
let dates: Vec<(&str, &str, &str)> = re.captures_iter(hay).map(|caps| {
    let (_, [year, month, day]) = caps.extract();
    (year, month, day)
}).collect();
assert_eq!(dates, vec![
    ("1865", "04", "14"),
    ("1881", "07", "02"),
    ("1901", "09", "06"),
    ("1963", "11", "22"),
]);
```

`Captures::extract` 通过确保匹配的组数与通过 `[year, month, day] `语法请求的组数匹配来工作。如果它们匹配，那么每个对应捕获组的子字符串将自动以适当大小的数组返回。Rust 的数组模式匹配语法负责其余部分。

##### replacement with named capture groups

--------

在之前的例子基础上，也许我们想重新排列日期格式。可以通过找到每个匹配项并用不同的内容替换它来实现。`Regex::replace_all` 这个函数提供了一种方便的方法来完成这个任务，包括支持在替换字符串中引用命名组：

```rust
use regex::Regex;

let re = Regex::new(r"(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})").unwrap();
let before = "1973-01-05, 1975-08-25 and 1980-10-18";
let after = re.replace_all(before, "$m/$d/$y");
assert_eq!(after, "01/05/1973, 08/25/1975 and 10/18/1980");
```

替换方法实际上在替换中是多态的，这提供了比这里看到的更多的灵活性。（有关 `Regex::replace` 的更多详细信息，请参阅文档。）

##### Example: verbose mode

-------

当你的正则表达式变得复杂时，你可能需要考虑使用其他工具，而不是正则表达式。但是，如果你坚持使用正则表达式，你可以使用 `x` 标志启用不显着的空白模式或“详细模式”。在这种模式下，空白被视为不显着，可以编写注释。这可能会使你的模式更易于理解。

```rust
use regex::Regex;

let re = Regex::new(r"(?x)
  (?P<y>\d{4}) # the year, including all Unicode digits
  -
  (?P<m>\d{2}) # the month, including all Unicode digits
  -
  (?P<d>\d{2}) # the day, including all Unicode digits
").unwrap();

let before = "1973-01-05, 1975-08-25 and 1980-10-18";
let after = re.replace_all(before, "$m/$d/$y");
assert_eq!(after, "01/05/1973, 08/25/1975 and 10/18/1980");
```

如果你希望在这种模式下匹配空白字符，仍然可以使用 `\s`, `\n`, `\t` 等。要转义单个空格字符，可以直接使用 `\`，使用其十六进制字符代码 `\x20` 或暂时禁用` x` 标志，例如，`(?-x: )`。

##### Example: match multiple regular expressions simultaneously

这展示了如何使用 `RegexSet` 在一次扫描中匹配多个（可能重叠的）正则表达式：

```rust
use regex::RegexSet;

let set = RegexSet::new(&[
    r"\w+",
    r"\d+",
    r"\pL+",
    r"foo",
    r"bar",
    r"barfoo",
    r"foobar",
]).unwrap();

// Iterate over and collect all of the matches. Each match corresponds to the
// ID of the matching pattern.
let matches: Vec<_> = set.matches("foobar").into_iter().collect();
assert_eq!(matches, vec![0, 2, 3, 4, 6]);

// You can also test whether a particular regex matched:
let matches = set.matches("foobar");
assert!(!matches.matched(5));
assert!(matches.matched(6));
```

#### Performance

--------

本节简要讨论了正则表达式在速度和资源使用方面的几个问题。

##### Only ask for what you need

------

在使用正则表达式进行搜索时，通常可以请求三种不同类型的信息：

1. 正则表达式在haystack中匹配吗？
2. 正则表达式在haystack匹配的位置？
3. 每个捕获组在haystack中匹配的位置在哪里？

一般来说，这个库可以提供一个函数来回答#3，这会自动包含#1和#2。然而，计算捕获组匹配位置可能会显著更昂贵，所以如果你不需要的话最好不要这样做。

因此，只需要请求你需要的内容。例如，如果你只需要测试正则表达式是否匹配一个字符串，不要使用`Regex::find`。而是使用`Regex::is_match`。

##### Unicode can impact usage and search speed

-------

这个crate对Unicode有一级支持并默认启用。在许多情况下，为了支持它所需的额外内存可以忽略不计，并且通常不会影响搜索速度。但在某些情况下，它可能会有影响。

在内存使用方面，Unicode的主要影响主要通过Unicode字符类体现。Unicode字符类通常相当大。例如，默认情况下，\w匹配大约14万个不同的代码点。这需要额外的内存，并且通常会减慢正则表达式编译的速度。虽然这里偶尔使用一个\w通常不会被注意到，但写\w{100}会默认生成一个相当大的正则表达式。实际上，\w比其仅限ASCII的版本大得多，因此如果您的需求仅限于ASCII，那么使用ASCII类可能是一个好主意。仅限ASCII的\w可以以多种方式拼写。以下所有内容都是等价的：

* `[0-9A-Za-z_]`
* `(?-u:\w)`
* `[[:word:]]`
* `[\w&&\p{ascii}]`

在搜索速度方面，Unicode通常能够很好地处理，即使在使用大型Unicode字符类时也是如此。然而，一些更快的内部正则表达式引擎无法处理Unicode感知的单词边界断言。因此，如果你不需要Unicode感知的单词边界断言，可以考虑使用(?-u:\b)代替\b，其中前者使用ASCII-only的单词字符定义。

##### Literals might accelerate searches

------

这个crate在识别正则表达式模式中的字面量并使用它们加速搜索方面通常表现良好。如果可能的话，在你的模式中包含某种字面量可能会使搜索显著加快。例如，在正则表达式 \w+@\w+ 中，引擎会查找 @ 的出现，然后尝试反向匹配 \w+ 来找到起始位置。

##### Avoid re-compiling regexes, especially in a loop

------

在循环中编译相同的模式是一种反模式，因为正则表达式编译通常很昂贵。（编译时间取决于模式的大小，可能从几微秒到几毫秒不等。）不仅编译本身昂贵，而且这还会阻止正则表达式引擎内部重用分配的优化。

在 Rust 中，如果正则表达式在辅助函数内部使用，传递它们可能会有些麻烦。相反，我们建议使用 `std::sync::LazyLock` 或 `once_cell` crate，如果你不能使用标准库。

这个示例展示了如何使用 `std::sync::LazyLock`：

```rust
use std::sync::LazyLock;

use regex::Regex;

fn some_helper_function(haystack: &str) -> bool {
    static RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"...").unwrap());
    RE.is_match(haystack)
}

fn main() {
    assert!(some_helper_function("abc"));
    assert!(!some_helper_function("ac"));
}
```

具体来说，在这个例子中，正则表达式会在第一次使用时进行编译。在后续使用中，它会重用之前构建的正则表达式。注意如何将正则表达式定义为特定函数的局部变量。

##### Sharing a regex across threads can resule in contention

----

虽然单个正则表达式可以同时从多个线程自由使用，但必须支付一定的同步成本。通常情况下，除非每个线程的主要任务是使用正则表达式进行搜索，并且大多数搜索都在较短的字符串中进行，否则不会观察到这种情况。在这种情况下，共享资源的内部竞争可能会激增，增加延迟，从而可能减慢每个单独的搜索。

可以通过在发送到另一个线程之前克隆每个正则表达式来解决这个问题。克隆的正则表达式仍然会共享其编译状态的相同内部只读部分（它是引用计数的），但每个线程将获得对运行搜索时使用的可变空间的优化访问。通常情况下，这样做不会增加额外的内存成本。唯一的成本是需要显式克隆正则表达式所增加的代码复杂性。（如果你在多个线程之间共享同一个正则表达式，每个线程仍然会获得自己的可变空间，但访问该空间会更慢。）

#### Unicode

-----

本节讨论了该正则表达式库对Unicode的支持情况。在展示一些示例之前，我们先总结一下相关要点：

* 这个 crate 几乎完全实现了 Unicode 技术标准 #18 中规定的“基本 Unicode 支持”（级别 1）。支持的详细信息在 regex crate 仓库的根目录下的 UNICODE.md 文件中有详细说明。几乎不支持 Unicode 技术标准 #18 中规定的“扩展 Unicode 支持”（级别 2）。
* 顶级正则表达式像迭代遍历haystack中的每个代码点一样运行搜索。也就是说，匹配的基本原子是一个单一的代码点。
* `bytes::Regex` 在所有情况下都允许禁用 Unicode 模式，对整个模式或部分模式进行禁用。当 Unicode 模式被禁用时，搜索会像遍历 haystack 中的每个字节一样进行。也就是说，匹配的基本单元是一个字节。（顶级 Regex 也允许禁用 Unicode，从而像逐字节匹配一样进行匹配，但仅在这样做不会允许匹配无效的 UTF-8 时。）
* 当Unicode模式启用（默认情况下）时，`.`将匹配一个完整的Unicode标量值，即使它使用多个字节进行编码。当Unicode模式禁用（例如，(?-u:.））时，`.`将始终匹配一个字节。
* 字符类 `\w`, `\d` 和 `\s` 默认是 Unicode 感知的。使用` (?-u:\w)`, `(?-u:\d) `和 `(?-u:\s)` 可以获取它们的 ASCII 仅定义。
* 同样，`\b` 和 `\B` 使用 Unicode 定义的“单词”字符。要获取仅限 ASCII 的单词边界，可以使用 `(?-u:\b)` 和 `(?-u:\B)`。这也适用于特殊的单词边界断言。（即 `\b{start}`，`\b{end}`，`\b{start-half}`，`\b{end-half}`。）
* 在多行模式下，`^ `和` $` 不是 Unicode 感知的。也就是说，它们只识别` \n`（假设未启用 CRLF 模式），而不识别 Unicode 定义的其他任何行终止符。
* 不区分大小写的搜索是Unicode感知的，并使用简单的大小写折叠。
* Unicode通用类别、脚本和许多布尔属性可以通过默认的\p{属性名称}语法访问。
* 在所有情况下，匹配都是使用字节偏移量报告的。更精确地说，是使用UTF-8代码单元偏移量。这允许对haystack进行常数时间的索引和切片。

模式本身仅被解释为Unicode标量值的序列。这意味着你可以在你的模式中直接使用Unicode字符：

```rust
use regex::Regex;

let re = Regex::new(r"(?i)Δ+").unwrap();
let m = re.find("ΔδΔ").unwrap();
assert_eq!((0, 6), (m.start(), m.end()));
// alternatively:
assert_eq!(0..6, m.range());
```

如上所述，Unicode通用类别、脚本、脚本扩展、版本以及一些布尔属性都可以作为字符类使用。例如，你可以匹配一串数字、希腊字母或 Cherokee 字母：

```rust
use regex::Regex;

let re = Regex::new(r"[\pN\p{Greek}\p{Cherokee}]+").unwrap();
let m = re.find("abcΔᎠβⅠᏴγδⅡxyz").unwrap();
assert_eq!(3..23, m.range());
```

##### Opt out of Unicode support

-------

`bytes::Regex`类型可以搜索`&[u8]`haystack。默认情况下，haystacks 通常像主 `Regex` 类型一样被当作 UTF-8 处理。然而，可以通过关闭`u`标志来禁用此行为，即使这样做可能会导致匹配无效的UTF-8。例如，当关闭`u`标志时，`.`将匹配任何字节而不是任何Unicode标量值。

禁用 `u` 标志也可以使用标准的 `&str` 基于的 Regex 类型，但仅在维护 UTF-8 不变性的情况下允许。例如，`(?-u:\w)` 是一个仅包含 ASCII 字符的 \w 字符类，并且在 `&str` 基于的 Regex 中是合法的，但 `(?-u:\W)`将尝试匹配不在` (?-u:\w) `中的任何字节，这反过来包括无效的 UTF-8 字节。同样，`(?-u:\xFF)`将尝试匹配原始字节 `\xFF`（而不是 U+00FF），这是无效的 UTF-8，因此在 `&str` 基于的正则表达式中是非法的。

最后，由于Unicode支持需要打包大型Unicode数据表，该crate提供了控制台开关来禁用这些数据表的编译，这在缩小二进制文件大小和减少编译时间方面可能很有用。有关如何实现这一点的详细信息，请参阅crate功能部分。

#### Syntax

-----

本库支持的语法如下。

注意，正则表达式解析器和抽象语法在单独的 crate `regex-syntax` 中暴露。

##### Matching one character

```tcl
.             除了换行符（包括带有 s 标志的换行符）
[0-9]         任何 ASCII 数字
\d            数字 (\p{Nd})
\D            非数字
\pX           由一个字母名称标识的Unicode字符类
\p{Greek}     Unicode字符类（通用类别或脚本）
\PX           由一个字母名称标识的否定Unicode字符类
\P{Greek}     否定的Unicode字符类（通用类别或脚本）
```

##### Character classes

-----



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
  - `adj.`稍微调整，拧，扯
- `polymorphic`
  - `adj.`多态的
- `insignificant`
  - `adj.`微不足道的；无足轻重的；无意义的
- `comprehend`
  - `vt.`理解，领悟，包含
- `simultaneously`
  - `adv.`同时地，同步地
- `overlap`
  - `vt.`与...重叠；有重叠
  - `n.`重叠部分
- `concern`
  - `n.`关心，担心
  - `vt.`使担心，涉及
- `contention`
  - 
