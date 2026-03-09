# CLAUDE.md

本文件用于约束本仓库中的内容整理、分类与写作标准，目标是让博客结构清晰、内容精炼、可持续维护。

## 1) 仓库定位

- 技术栈：Hugo + Stack Theme
- 主体内容：Android、Rust、计算机基础、学习日志
- 核心目标：
  - 结构稳定（目录与 URL 语义一致）
  - 元数据统一（front matter 规范）
  - 分类可检索（分类、标签可控）
  - 内容干净（无重复、无混乱草稿）

## 2) 标准内容结构（唯一来源）

`content/` 下只保留以下主分区：

- `content/android/`：Android 相关
- `content/rust/`：Rust 相关
- `content/computer-science/`：计算机基础（网络/OS/工具等）
- `content/journal/`：周报、月报、流水笔记

约束：

- 普通文章禁止直接放在 `content/` 根目录。
- 根目录仅允许站点级页面（例如 `categories.md`）和各分区 `_index.md`。
- 每篇文章只能属于一个主分区（通过物理路径表达，不靠多分类混用）。

## 3) 分类与标签规范

### 3.1 categories（受控字段）

每篇文章只允许一个主分类，且必须是以下之一：

- `android`
- `rust`
- `computer-science`
- `journal`

说明：

- 历史值 `cs-basics` 视为遗留值，逐步迁移到 `computer-science`。
- 不新增同义分类（如 `Android`、`安卓`、`cs`）。

### 3.2 tags（自由字段，但要收敛）

- 使用短语义词，优先英文技术词（如 `Compose`, `tokio`, `HTTP`）。
- 单篇建议 `2-5` 个标签。
- 避免近义重复（如 `Coroutine` 与 `Coroutines` 二选一）。

## 4) Front Matter 统一模板

所有文章必须包含以下字段（TOML）：

```toml
+++
title = "文章标题"
date = "2026-03-08T10:00:00+08:00"
draft = false
description = "一句话摘要（80-140 字符）"
slug = "kebab-case-slug"
categories = ["android"]
tags = ["Compose", "Architecture"]
image = ""
+++
```

约束：

- `slug` 必须全小写、短横线风格（kebab-case），禁止中文 slug。
- `description` 必填，直接用于列表摘要与 SEO。
- `draft = true` 的文章不进入正式分区整理完成态。

## 5) 文件命名与层级规范

- 文件名统一：`kebab-case.md`
- 标题可中文，文件名建议英文语义
- 子目录用于主题聚合，最多两层，例如：
  - `android/architecture/xxx.md`
  - `rust/tokio/xxx.md`
  - `computer-science/network/xxx.md`

禁止：

- 空格、冒号、中文标点出现在文件名中
- 同一主题散落在多个不相关目录

## 6) 内容质量标准（写作层）

每篇文章默认结构：

1. 背景与问题
2. 核心原理/方案
3. 实践或示例
4. 总结与边界

硬性要求：

- 避免“聊天式”冗长措辞，优先结论先行。
- 代码块必须标注语言（如 `rust`, `kotlin`, `bash`）。
- 对比类内容必须写清 trade-off，不只给结论。
- 标题层级不跳级（`##` -> `###`）。

## 7) 清理与迁移流程（执行顺序）

1. 盘点：找出 `content/` 根目录下非站点级 md 文件。
2. 归类：按主题移动到 4 个主分区之一。
3. 规范化：补齐 front matter，统一 `slug/categories/description`。
4. 去重：合并重复主题文章，保留一篇主稿。
5. 验证：本地构建通过后再提交。

推荐命令：

```bash
find content -maxdepth 1 -type f -name "*.md" | sort
hugo server -D
hugo --gc --minify
```

## 8) 提交前检查清单

- 文章是否放在正确分区目录
- `categories` 是否在白名单内
- `slug` 是否规范且唯一
- `description` 是否存在且简洁
- `draft` 状态是否符合预期
- 本地构建是否无报错

## 9) 协作约定（给 AI/维护者）

- 优先做结构修复，再做文案润色。
- 不在一次改动中同时大规模重命名 + 大幅改写正文，避免难以 review。
- 每次提交聚焦一个主题分区（如仅整理 `android/`）。
- 修改分类规则时，同步更新 `config.toml` 与本文件。

## 10) 重复内容合并规则

当同一主题在不同时间出现多个版本时，按以下规则处理：

1. 选主稿：保留结构最完整、示例最可靠的一篇作为主稿。
2. 吸收增量：将其他版本中的新增观点、案例、坑点并入主稿。
3. 删除重复稿：被合并稿删除，避免搜索结果和归档页重复。
4. 保留时间线：在主稿末尾增加“更新记录”，注明关键补充日期。

判定为“重复主题”的标准：

- 标题高度相似（同一技术词 + 同一问题域）
- front matter 的 slug 或 tags 指向同一知识点
- 正文超过 40% 内容重合

冲突处理原则：

- 新版本若仅是表达优化，不保留为独立文章，直接回写主稿。
- 新版本若引入不同场景（如“源码分析” vs “实战排障”），可拆为姊妹文并互相链接。

## 11) 正文格式规范（Markdown）

- 一级标题（`#`）在正文中最多一个，优先使用 `##` 作为章节起点。
- 中英文之间留空格（如 `Rust trait`、`Compose State`）。
- 表格、代码块、引用前后各空一行。
- 代码块必须声明语言，且示例代码可直接复制运行。
- 长文建议在开头提供“本文提要/目录”。
- 避免连续超过 8 行的纯段落，必要时拆分为短段或列表。

## 12) 知识积累模型（面向长期复用）

文章按“用途”区分，避免所有内容都写成同一种：

- `guide`：入门到实践，偏教程
- `deep-dive`：源码/原理深挖
- `pitfall`：踩坑与排障记录
- `review`：阶段复盘与方法总结
- `journal`：周/月流水日志

建议在文首显式写出：

- 适用场景
- 核心结论（3 条以内）
- 不适用边界

## 13) 文章生命周期（从草稿到常青）

统一生命周期：

1. `inbox`：碎片想法（未成文）
2. `draft`：已成文但未验证
3. `published`：已发布
4. `evergreen`：多次更新后的稳定主稿
5. `archived`：历史参考，不再维护

建议在 front matter 增加可选字段：

```toml
status = "draft"        # inbox/draft/published/evergreen/archived
review_cycle = "monthly" # weekly/monthly/quarterly/none
last_reviewed = "2026-03-08"
```

## 14) 复盘模板（周/月）

周复盘建议路径：`content/journal/weekly/YYYY-Www.md`  
月复盘建议路径：`content/journal/monthly/YYYY-MM-summary.md`

每次复盘至少回答以下问题：

1. 本周期新增了什么可复用知识？
2. 哪些文章需要合并、补充或降级为归档？
3. 哪些结论被新实践推翻或修正？
4. 下周期的 1-3 个写作重点是什么？

## 15) 索引与回链规范（方便检索）

- 每个主分区的 `_index.md` 维护“推荐阅读顺序”。
- 同主题文章必须互链：在文末增加“相关内容”。
- 长文必须给出“前置阅读”和“延伸阅读”。
- 合并后的主稿在文末保留“更新记录”。

## 16) 执行细则（仅规范，不直接改正文）

当用户要求“先规划再整理”时，先产出整理清单，再分批执行：

1. 重复候选清单：按主题列出主稿与待合并稿。
2. 增量补充清单：仅记录主稿缺失的信息点，不直接改写段落。
3. 格式修复清单：仅记录标题层级、代码块语言、表格/列表排版问题。

清单字段建议：

- `topic`：主题名
- `canonical_file`：主稿路径
- `merge_from`：待合并文件路径
- `missing_points`：需要补充的要点
- `format_issues`：需要修复的格式项
- `status`：`todo` / `doing` / `done`
