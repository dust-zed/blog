+++
date = '2025-08-15T12:50:54+08:00'
draft = true
title = 'Ripgrep的命令文档'

categories = ['rust']

+++

用法 （`[]`内表示是可选参数):

`rg [OPTIONS] PATTERN [PATH ...]`

`rg [OPTIONS] -e PATTERN ... [PATH ...]`

`rg [OPTIONS] -f PATTERNFILE ... [PATH ...]`

`rg [OPTIONS] --files [PATH ...]`

`rg [OPTIONS] --type-list`

`command | rg [OPTIONS] PATTERN`

`rg [OPTIONS] --help`

`rg [OPTIONS] --version`

#### 参数解释

PATTERN: 要搜索的正则表达式，以`-`开始的正则需要添加 `-e`/`--regexp`flag，如`rg -e -foo`

PATH...: 需要检索的文件或目录

#### 输入选项(input options)

* `--`：表示后续以`-`开头的`word`都不再是`flag`而是`pattern`

* `-e PATTERN, --regexp=PATTERN`: 需要搜索的正则表达式，可多次指定
* `-f PATTERNFILE, --file=PATTERNFILE`:指定从何文件搜索正则表达式，可多次指定
* `--pre=COMMAND` 允许指定一个文件格式转换命令，ripgrep会先将文件通过该命令转换，然后在转换后的内容搜索正则表达式。`文件` → `COMMAND处理` → `获取标准输出` → `ripgrep搜索输出内容`
* `--pre-glob=GLOB`专为`--pre`命令设计，精确的筛选需要预处理的文件，避免对不匹配的文件执行不必要的格式转换，大幅提升性能。`rg --pre=pre-pdftotext --pre-glob='*.pdf' '关键词'`
  * `report.pdf` → 调用 `pdftotext` 转换后搜索
  * `notes.txt` → 直接搜索文本（省去进程创建）
* `-z, --search-zip`搜索压缩包

#### search options

* `-s, --case-sensitive`执行搜索时区分大小写
* `-i, --ignore-case`执行搜索时不区分大小写
* `--crlf`启动时将CRLF(\r\n)视为行终止符，而不是\n
* `--dfa-size-limit=NUM+SUFFIX?`正则表达式的dfa上限，可带单位
* `--regex-size-limit=NUM+SUFFIX?`设置**在内存中构建**的整体正则表达式对象的最大尺寸
* `--engine=ENGINE`指定正则表达式引擎
* `-E ENCODING, --encoding=ENCODING`强制 ripgrep 使用特定编码处理所有被搜索文件（默认自动检测编码）
* `-F, --fixedstrings`将所有模式视为字面量而不是正则表达式
* `-v --invert-match`反转匹配，打印不匹配的行，`--no-invert-match`为相反的输入
* `-x --line-regexp`整行匹配
* `-w, --word-regexp`独立单词匹配，启用此标志后，ripgrep 只显示被**单词边界**包围的匹配结果。类似于在正则表达式中自动给搜索词添加 `\b` 边界，比`-x`优先级高
* `-m NUM, --max-count=NUM`  限制每个文件的匹配行数量，到达指定数量就停止当前文件搜索
* `--mmap`优先使用`mmap`技术进行文件搜索
* `-U, --multiline`多行模式，允许匹配内容跨越多个行，突破默认的单行匹配限制
* `--multiline-dotall`当启用多行搜索时(`-U`)，强制正则表达式中的点号`.`匹配**包括换行符**的所有字符
* `--no-unicode`禁用unicode模式
* `--null-data` 将默认的行终止符从换行符`\n`改为NUL字符(`\0`或ASCII 0)
* `-P, --pcre2`切换默认的正则引擎更换为**PCRE2**
* `-S, --smart-case`启用智能大小写匹配模式
* `--stop-no-nonmatch`找到至少一个匹配行且后续遇到不匹配行就提前停止读取文件
* `-a, --text`强制将所有文件当作纯文本文件处理，禁用其默认的二进制文件检测机制
* `-j NUM, --threads=NUM`控制搜索时使用的并行线程数

#### filter options

* `--binary` 默认情况下ripgrep使用`NUL`字节作为启发式标志。一旦在文件中检测到NUL字节，立即判断为二进制文件，然后立即停止搜索该文件并不显示匹配内容。启用后即使检测到NUL字节，也继续搜索文件，直到找到**首个匹配项**或搜索到**文件结束**停止搜索
* `-L, --follow` 开启“跟随符号链接”功能（默认关闭）,用 `--no-follow` 在本命令中取消 `-L` 的效果
* `-g GLOB, --glob=GLOB` 通过通配符模式（glob）**包含或排除特定文件和目录**进行搜索
* `--glob-case-insensitive`让所有通过`-g/--glob`指定的通配符进行不区分大小写的匹配，`--no-glob-case-insensitive`取消此效果
* `--iglob=GLOB`允许用户通过**不区分大小写**的通配符模式来**包含或排除文件/目录**
* `-., --hidden` 搜索隐藏文件和目录，`--no-hidden`取消此效果
* `--ignore-file=PATH` 通过外部文件指定忽略规则（`gitignore` 格式）
* `--ignore-file-case-insensitive` 控制**忽略文件规则匹配时是否区分大小写**
* `-d NUM, --max-depth=NUM`指定搜索的目录遍历的深度层级
* `--max-filesize=NUM+SUFFIX?`  跳过超过指定大小的文件
* `--no-ignore` 跳过所有忽略文件，`--ignore`取消这效果
* `--no-ignore-dot`  仅跳过 `.ignore` 和`.rgignore` 文件中的过滤规则，通过 `--ignore-dot` 可关闭此功能
* `--no-ignore-exclude` 禁用手动配置的排除规则，`--ignore-exclude`取消此效果
* `--no-ignore-files` 禁用显式指定的忽略文件，`--ignore-files`取消此效果
* `--no-ignore-global` 禁用来自“全局”源的忽略规则（`.gitignore` 文件），`--ignore-global`取消此效果
* `--no-ignore-parent`不应用从父目录中找到的忽略文件（如 `.gitignore`）中的规则，`--ignore-parent`取消此效果
* `--no-ignore-vcs` 禁用版本控制系统的忽略规则，`-ignore--vcs`取消此效果
* `--no-require-git` 默认只在git仓库才遵守版本控制的忽略文件（如`.gitignore`），启用后即使不再git仓库，也会遵守版本控制的忽略文件。`--require-git`取消此效果
* `--no-file-system` 遍历目录树搜索文件时，不会跨越任何文件系统边界，`--no-one-file-system`取消此效果。在搜索**每个给定的起始路径**时，遇到**挂载点（通往另一个文件系统的“门”）就停下来，不进去搜索**。
* `-t TYPE, --type=TYPE`  用于限制只搜索特定类型的文件
* `-T TYPE, --type-not=TYPE` 用于**排除**指定类型的文件不进行搜索
* `--type-add=TYPESPEC`  用于创建自定义文件类型匹配规则
* `--type-clear=TYPE` 清楚 `type-add`创建的自定义文件类型匹配规则
* `-u, --unrestricted` 标志通过多次重复（最高3次）逐步降低 ripgrep 的智能过滤级别，使搜索范围越来越广

#### output options

* `-A NUM, --after-context=NUM`  会显示每条匹配结果**之后**的 NUM 行内容
* 
