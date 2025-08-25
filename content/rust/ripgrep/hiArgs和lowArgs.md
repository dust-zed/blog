+++
date = '2025-08-24T20:57:16+08:00'
draft = false
title = 'HiArgs和lowArgs'
categories = ['rust', 'ripgrep']

+++

### 核心设计模式

#### 1. 两层参数结构

```rust
LowArgs (原始参数) → HiArgs (处理后的配置)
```

**设计理念**

* **LowArgs**：接近CLI原始输入，最小验证
* **HiArgs**：业务就绪的配置，包含复杂对象和计算结果
* **最小验证**：最小验证的核心是**将不受信任数据快速转变为可信数据**

#### 2. 字段组织策略

**简单配置字段**：

```rust
byte_offset: bool,
column: bool,
heading: bool,
quiet: bool,
// ... 直接从LowArgs 复制或简单计算
```

**复杂构建对象**

```rust
globs: ignore::overrides::Override,
pre_globs: ignore::overrides::Overrode,
types: ignore::types::Types,
patterns: Patterns,
paths: Paths,
```

**环境感知字段**

```rust
is_terminal_stdout: bool,                   // 检测输出终端
mmap_choice: grep::searcher::MmapChoice,    // 内存映射策略
hyperlink_config: grep::printer::HyperLinkConfig, // 超链接配置
```

### 关键设计原则

#### 1. 延迟构建模式

复杂对象在 `from_low_args` 中统一构建：

```rust
let globs = globs(&state, &low)?;           // 需要所有 glob 模式
let types = types(&low)?;                   // 需要所有类型规则
let patterns = Patterns::from_low_args(...)?; // 需要所有模式
```

#### 2. 状态依赖管理

通过 `State` 结构体管理环境状态

```rust
let mut state = State::new()?;
// state 包含：终端检测、stdin_cosumed、工作目录等
```

#### 3. 配置计算模式

根据环境和标志动态计算最终配置：

```rust
let color = match low.color {
  ColorChoice::Auto if !state.is_terminal_stdout => ColorChoice::Never,
  _ => low.color,
};
let heading = match low.heading {
  None => !low.vimgrep && state.is_terminal_stdout,  // 智能默认值
  Some(value) => value && !low.vimgrep,              // 考虑标志冲突
};
```

通过 `HiArgs` 和 `LowArgs` 这种分层设计，将“解析”和“配置”职责分离，使得代码更加模块化，每层都有明确的职责边界。

### 核心构建方法

#### matcher() 方法的设计模式

**策略模式**

```rust
pub(crate) fn matcher(&self) -> anyhow::Result<PatternMatcher> {
    match self.engine {
        EngineChoice::Default => match self.matcher_rust() {
            Ok(m) => Ok(m),
            Err(err) => anyhow::bail!(suggest_other_engine(err.to_string())),
        },
        EngineChoice::PCRE2 => Ok(self.matcher_pcre2()?),
        EngineChoice::Auto => {
            // 尝试 Rust 引擎，失败则尝试 PCRE2
            let rust_err = match self.matcher_rust() {
                Ok(m) => return Ok(m),
                Err(err) => err,
            };
            let pcre_err = match self.matcher_pcre2() {
                Ok(m) => return Ok(m),
                Err(err) => err,
            };
            // 两个都失败，提供详细错误信息
            anyhow::bail!("regex could not be compiled with either engine...");
        }
    }
}
```

**设计思路**

* 根据用户选择的引擎类型，动态选择不同的匹配器实现
* `Auto` 模式体现了优雅的降级策略：先尝试默认引擎，失败则尝试 PCRE2

**建造者模式**

```rust
fn matcher_rust(&self) -> anyhow::Result<PatternMatcher> {
    let mut builder = grep::regex::RegexMatcherBuilder::new();
    builder
        .multi_line(true)
        .unicode(!self.no_unicode)
        .octal(false)
        .fixed_strings(self.fixed_strings);
    
    // 根据配置逐步构建
    match self.case {
        CaseMode::Sensitive => builder.case_insensitive(false),
        CaseMode::Insensitive => builder.case_insensitive(true),
        CaseMode::Smart => builder.case_smart(true),
    };
    
    // 最终构建
    let m = builder.build_many(&self.patterns.patterns)?;
    Ok(PatternMatcher::RustRegex(m))
}
```

**设计思路**

* 使用建造者模式逐步配置复杂对象
* 链式调用提供流畅的 API
* 最后调用 `build_many()` 完成构建

#### 条件编译和特性门控

```rust
fn matcher_pcre2(&self) -> anyhow::Result<PatternMatcher> {
    #[cfg(feature = "pcre2")]
    {
        // PCRE2 实现
        let mut builder = grep::pcre2::RegexMatcherBuilder::new();
        // ... 配置代码
        Ok(PatternMatcher::PCRE2(m))
    }
    #[cfg(not(feature = "pcre2"))]
    {
        Err(anyhow::anyhow!("PCRE2 is not available in this build"))
    }
}
```

**设计思路**

* 使用 Rust 的条件编译特性

* 特性定义（`Cargo.toml`）

  ```toml
  [features]
  pcre2 = ["grep/pcre2"]  // 定义 pcre2 特性，依赖于 grep crate 的 pcre2 特性
  ```

* 在编译时决定是否包含 PCRE2 支持

### 其他方法

`searcher()`、`printer()` 等其他构造方法基本采用建造者模式。`search_worker()` 方法单独说明：

#### 组件组合模式

`search_worker` 体现经典的 **组合模式**：

```
SearchWorker
├── PatternMatcher (模式匹配)
├── Searcher (文件搜索)
└── Printer (结果输出)
```

每个组件职责：

1. `PatternMatcher`：判断文本是否匹配模式
2. `Searcher`：读取文件内容，按行处理
3. `Printer`：格式化并输出匹配结果

**设计优势**

* 职责分离：每个组件专注于自己的功能
* 可测试性：可以独立测试每个组件
* 可扩展性：可以替换任何组件的实现

#### walk_builder()

##### 职责分层

包含四个核心职责：

1. **路径管理**

```rust
let mut builder = ignore::WalkBuilder::new(&self.paths.paths[0]);
for path in self.paths.paths.iter().skip(1) {
  builder.add(path)
}
```

* 初始化：使用第一个路径作为根路径
* 扩展：添加所有额外的搜索路径

2. **忽略文件系统配置**

```rust
// 用户自定义忽略文件
if !self.no_ignore_files {
    for path in self.ignore_file.iter() {
        if let Some(err) = builder.add_ignore(path) {
            ignore_message!("{err}");
        }
    }
}

// Git 集成忽略规则
.git_global(!self.no_ignore_vcs && !self.no_ignore_global)
.git_ignore(!self.no_ignore_vcs)
.git_exclude(!self.no_ignore_vcs && !self.no_ignore_exclude)

// 通用忽略文件
.ignore(!self.no_ignore_dot)
.parents(!self.no_ignore_parent)

// ripgrep 专用忽略文件
if !self.no_ignore_dot {
    builder.add_custom_ignore_filename(".rgignore");
}
```

3. **遍历行为配置**

```rust
builder
    .max_depth(self.max_depth)           // 最大递归深度
    .follow_links(self.follow)           // 是否跟随符号链接
    .max_filesize(self.max_filesize)     // 最大文件大小
    .threads(self.threads)               // 线程数
    .same_file_system(self.one_file_system) // 是否限制在同一文件系统
    .skip_stdout(matches!(self.mode, Mode::Search(_))) // 跳过标准输出
    .hidden(!self.hidden)                // 是否包含隐藏文件
    .require_git(!self.no_require_git)   // 是否要求 Git 仓库
    .ignore_case_insensitive(self.ignore_file_case_insensitive); // 忽略文件大小写
```

4. **高级功能配置**

```rust
// 文件类型过滤
.overrides(self.globs.clone())
.types(self.types.clone())

// 排序优化
if let Some(ref sort) = self.sort {
    assert_eq!(1, self.threads, "sorting implies single threaded");
    if !sort.reverse && matches!(sort.kind, SortModeKind::Path) {
        builder.sort_by_file_name(|a, b| a.cmp(b));
    }
}
```

`walk_builder` 是系统集成点：

* **底层**：文件系统遍历（`ignore::WalkBuilder`）
* **中层**：忽略规则处理（Git、自定义、类型过滤）
* **上层**：用户配置映射（命令行参数到行为）

#### current_dir()

```rust
fn current_dir() -> anyhow::Result<PathBuf> {
    let err = match std::env::current_dir() {
        Err(err) => err,                    // 保存错误，继续尝试回退方案
        Ok(cwd) => return Ok(cwd),          // 成功则直接返回
    };
    if let Some(cwd) = std::env::var_os("PWD") {
        if !cwd.is_empty() {
            return Ok(PathBuf::from(cwd));
        }
    }
    anyhow::bail!(
        "failed to get current working directory: {err}\n\
         did your CWD get deleted?",
    )
}
```

此方法获取当前工作目录时的异常处理：

* **目录被删除** - 进程所在目录可能被其他进程删除
* **权限问题** - 无读取当前目录权限
* **符号链接问题** - 当前目录是损坏的符号链接

为何需要复杂处理？  

1. 需要 cwd 将相对路径转绝对路径（如 `rg "pattern" ../other_projects/`）
2. 通过 `PWD` 环境变量回退保证健壮性

`hiargs.rs` 中其他方法均基于 `LowArgs` 完善 `HiArgs`：

```rust
// 核心数据结构
let patterns = Patterns::from_low_args(&mut state, &mut low)?;
let paths = Paths::from_low_args(&mut state, &patterns, &mut low)?;
let binary = BinaryDetection::from_low_args(&state, &low);

// 辅助功能配置
let colors = take_color_specs(&mut state, &mut low);
let hyperlink_config = take_hyperlink_config(&mut state, &mut low)?;
let stats = stats(&low);
let types = types(&low)?;
let globs = globs(&state, &low)?;           // 文件匹配规则
let pre_globs = preprocessor_globs(&state, &low)?;  // 预处理器规则
```

### 核心结构体

#### Patterns

表示要匹配的内容：

```rust
struct Patterns {
  patterns: Vec<String>,
}
```

模式来源的统一处理：

```rust
fn from_low_args(state: &mut State, low: &mut LowArgs)
    -> anyhow::Result<Patterns>
```

三种模式来源：

1. positional：`rg "pattern" file.txt`
2. `-e/--regexp`: `rg -e "pattern1" -e "pattern2"`
3. `-f/--file`: `rg -f patterns.txt`

`-e/--regexp` 对应 `Pattern` flag 的 update 逻辑：

```rust
fn update(&self, v: FlagValue, args: &mut LowArgs) {
  let regexp = convert::string(v.unwrap_value());
  args.patterns.push(PatternSource::Regexp(regexp));
  Ok(())
}
```

`-f/--file` 对应 `File` flag 的 update 逻辑：

```rust
fn update(&self, v: FlagValue, args: &mut LowArgs) {
  let path = PathBuf::from(v.unwrap_value());
  args.patterns.push(PatternSource::File(path));
  Ok(())
}
```

`Patterns::from_low_args` 从三种来源构造去重(利用`HashSet`)的 `Patterns::patterns: Vec<String>` 。`-f file.txt, --file=file.txt`中`file.txt(pattern文件)`存放着需要匹配的`pattern`。

#### Paths - 路径管理系统

```rust
struct Paths {
  paths: Vec<PathBuf>,         // 实际路径列表
  has_implicit_path: bool,     // 是否有隐式路径
  is_one_file: bool,           // 是否只搜索单个文件
}
```

要么从`positional`中读取文件路径，要么就是智能路径推断：

```rust
let use_cwd = !is_readable_stdin
    || state.stdin_consumed
    || !matches!(low.mode, Mode::Search(_));

let (path, is_one_file) = if use_cwd {
    (PathBuf::from("./"), false)  // 搜索当前目录
} else {
    (PathBuf::from("-"), true)    // 搜索 stdin
};
```

单文件优化检测：

```rust
let is_one_file = paths.len() == 1
    && (paths[0] == Path::new("-") || !paths[0].is_dir());
```

* 使用 `!is_dir()` 而非 `is_file()` 更准确
* stdin (`-`) 被视为单文件
* 单文件搜索启用特定优化

#### BinaryDetection - 二进制文件检测系统

```rust
struct BinaryDetection {
    explicit: grep::searcher::BinaryDetection // 显式指定文件的检测策略
    implicit: grep::searcher::BinaryDetection // 隐式发现文件的检测策略
}
```

**显式 vs 隐式文件处理**：

```rust
let explicit = if none {
    grep::searcher::BinaryDetection::none()
} else {
    grep::searcher::BinaryDetection::convert(b'\x00')
};

let implicit = if none {
    grep::searcher::BinaryDetection::none()
} else if convert {
    grep::searcher::BinaryDetection::convert(b'\x00')
} else {
    grep::searcher::BinaryDetection::quit(b'\x00')  // 关键差异
};
```

* **显式文件**：用户明确指定，必须搜索，不能“退出”
* **隐式文件**：目录遍历发现，可以跳过二进制文件

**三种检测模式**：

1. `none`：禁用二进制检测，当作文本处理 (`--text` 或 `--null-data`)
2. `convert(b'\x00')`：将 null 字节转换为换行符继续搜索 (`--binary`)
3. `quit(b'\x00')`：遇到 null 字节立即停止搜索该文件

默认策略：

* 显式文件：`convert(b'\x00')`
* 隐式文件：`quit(b'\x00')`

#### State - 解析状态管理

```rust
struct State {
    is_terminal_stdout: bool,  // stdout 是否连接到终端
    stdin_consumed: bool,      // stdin 是否已被消费
    cwd: PathBuf,              // 当前工作目录
}
```

* `is_terminal_stdout`：影响颜色输出、缓冲策略等（需跨平台处理）
* `stdin_consumed`：防止同时从 stdin 读取模式和内容

### 结构体设计的核心思想

#### 1. 职责分离

* `Patterns`：模式收集和去重
* `Paths`：路径管理和推断
* `BinaryDetection`：二进制文件处理策略
* `State`：解析状态跟踪
