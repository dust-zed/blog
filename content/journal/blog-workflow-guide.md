+++
title = "我的博客维护工作流"
date = 2026-01-02T21:40:00+08:00
draft = false
tags = ["Workflow", "Git", "Knowledge Management"]
+++

这是我用来维护博客和管理个人知识的一套工作流。核心理念是**“允许过程混乱，追求结果有序”**。

## 1. 目录结构：从输入到输出

我采用了**渐进式总结**的目录结构，将“思考过程”和“知识成果”在物理上隔离。

```text
content/
├── android/          <-- 【正式产品】沉淀下来的硬核技术文 (干货)
├── rust/             <-- 【正式产品】沉淀下来的硬核技术文 (干货)
├── computer-science/ <-- 【正式产品】计算机基础
└── journal/          <-- 【生产车间】永远不发布的私人思考 (湿货)
    ├── memos/        <-- 随手记 (碎片化想法，draft)
    ├── weekly/       <-- 周总结 (半成品，每周整理 Memos)
    └── monthly/      <-- 月度复盘 (成品，月底整理 Weekly)
```

*   **Journal 目录**：配置了 `build` 选项，**永远不会**发布到网站上，但会被 Git 记录。
*   **晋升机制**：如果某个月总结里的技术点非常有价值，应该把它提取出来，移动到 `android` 或 `rust` 等正式目录下，作为一篇公开博客发布。

## 2. Git 分支策略：月度沙盒 (Monthly Sandbox)

为了让写作无压力，我使用**按月分支**策略。

### 月初：开辟沙盒
每个月第一天，切一个新的分支。加 `wip/` 前缀表示 Work In Progress。

```bash
# 基于最新的 main
git checkout main
git pull

# 创建本月分支
git checkout -b wip/2026-01
```

### 月内：随意挥洒
在这个分支里，我可以随意提交。
- 不用管 commit message 乱不乱。
- 不用管代码能不能跑通。
- 随时 `git commit -m "save"`。

### 月底：收纳整理 (Squash Merge)
月底合并回主线时，使用 **Squash Merge** 把这一个月的几百次杂乱提交挤压成 **1 个** 干净的提交。

```bash
# 1. 切回主线
git checkout main

# 2. 挤压合并 (Squash)
# 这会把 wip/2026-01 的内容拿过来，但在 main 上只算作一次未提交的更改
git merge --squash wip/2026-01

# 3. 正式提交
git commit -m "Content: 2026年1月学习记录归档"

# 4. 推送
git push origin main
```

这样，`main` 分支永远保持干净，像是整齐的月刊合订本；而 `wip` 分支保留了详细的修改历史（如果我不删除它）。
