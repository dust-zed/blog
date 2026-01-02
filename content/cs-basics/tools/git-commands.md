+++
date = '2025-09-21T11:08:27+08:00'
draft = false
title = 'Git命令积累'
categories = ['cs-basics']
tags = ['Git', 'Version Control']
description = "常用 Git 命令速查与技巧积累。"
slug = "git-commands"

+++

## `git log --oneline | tail -20`

* `git log`现实提交历史
* `--oneline`将每个提交压缩为一行显示
* `|`，管道符， 将前一个命令的输出作为后一个命令输入
* `tail -20`,显示输入或文件末尾部分，`-20`参数表示显示最后一行
