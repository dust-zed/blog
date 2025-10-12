+++
date = '2025-10-12T15:03:56+08:00'
draft = true
title = 'Glob语法'
categories = ['rust', 'ripgrep']

+++

#### 核心通配符

##### 1. `*` - 匹配任意字符(不含斜杠)

```bash
*.txt           # 匹配: file.txt, readme.txt
                # 不匹配: dir/file.txt (因为有斜杠)

file*.log       # 匹配: file1.log, file_backup.log
                # 不匹配: myfile.log

*test*          # 匹配: mytest.txt, test_file.log, unittest.rs
```

-------

##### 2. `**` - 匹配任意路径（包括斜杠）

```bash
**/*.rs         # 匹配: main.rs, src/lib.rs, src/deep/nested/file.rs
                # 任意深度的 .rs 文件

src/**          # 匹配: src/ 目录下的所有内容(递归)
                # src/a.txt, src/dir/b.txt, src/x/y/z.txt

**/test.txt     # 匹配: test.txt, dir/test.txt, a/b/c/test.txt
                # 任意位置的 test.txt
```

**记忆要点**：`**`可以匹配0个或多个目录层级

----------

##### 3. `?` - 匹配单个字符

```bash
?.txt           # 匹配: a.txt, 1.txt, _.txt
                # 不匹配: ab.txt (两个字符)

test?.log       # 匹配: test1.log, testA.log
                # 不匹配: test.log, test12.log

file???.rs      # 匹配: file123.rs, fileabc.rs
                # 恰好 3 个字符
```

**记忆要点**：一个`?`代表恰好一个字符，不多不少

-----

##### 4. 方括号`[...]`-匹配字符集中的一个

```bash
[abc].txt       # 匹配: a.txt, b.txt, c.txt
                # 不匹配: d.txt

test[0-9].log   # 匹配: test0.log, test5.log, test9.log
                # 数字范围

file[a-zA-Z].rs # 匹配: filea.rs, fileZ.rs
                # 大小写字母

[0-9][0-9].txt  # 匹配: 01.txt, 99.txt
                # 两位数字
```

**常用范围**：

* `[0-9]` - 数字
* `[a-z]` - 小写字母
* `[A-Z]` - 大写字母
* `[a-zA-Z]` - 所有字母
* `[0-9a-f]` - 十六进制

----

##### 5. 否定字符集`[!...]` - 不匹配这些字符

```bash
[!0-9].txt      # 匹配: a.txt, _.txt
                # 不匹配: 1.txt (不是数字)

[!.]*.txt       # 匹配: file.txt, readme.txt
                # 不匹配: .hidden.txt (不以点开头)

test[!abc].log  # 匹配: testd.log, test1.log
                # 不匹配: testa.log, testb.log, testc.log
```

----

##### 6. 花括号`{a, b, c}` - 匹配其中任意一个

```bash
*.{js,ts}       # 匹配: app.js, main.ts
                # 不匹配: style.css

file.{txt,log,tmp}
                # 匹配: file.txt, file.log, file.tmp

{foo,bar}/*.rs  # 匹配: foo/main.rs, bar/lib.rs
                # foo/ 或 bar/ 目录下的 .rs 文件

test{1,2,3}.txt # 匹配: test1.txt, test2.txt, test3.txt
```

----

##### 7. 前导斜杠`/` - 锚定到根目录

```bash
/config.json    # 只匹配: 项目根目录的 config.json
                # 不匹配: src/config.json (子目录的)

/*.txt          # 只匹配: 根目录下的 .txt 文件
                # 不匹配: dir/file.txt

/src/*.rs       # 只匹配: 根目录下 src/ 中的 .rs
                # 不匹配: other/src/main.rs
```

----

##### 8. 结尾斜杠`/` - 只匹配目录

```bash
temp/           # 只匹配名为 temp 的目录
                # 不匹配名为 temp 的文件

node_modules/   # 只匹配 node_modules 目录
build/          # 只匹配 build 目录
```

----

##### 9. 感叹号`!` - 取消忽略 - gitignore特有

```bash
# 先忽略所有 .log
*.log

# 但不忽略 important.log
!important.log

# 结果: 除了 important.log 外,所有 .log 都被忽略
```

------

