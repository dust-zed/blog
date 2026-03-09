+++
title = 'RecyclerView缓存机制'
date = '2025-06-11T15:26:57+08:00'
draft = false
categories = ['android']
tags = ['Android', 'RecyclerView', 'Performance']
description = "深入解析 RecyclerView 的多级缓存机制：Scrap, Cache, ViewCacheExtension 和 RecycledViewPool。"
slug = "recyclerview-caching-mechanism"
+++

## 多级缓存体系架构图

```
TEXT

RecyclerView 缓存系统
├── 1. 屏幕内缓存 (Attached Scrap)
│   └── 存放当前可见的ViewHolder（快速复用）
├── 2. 屏幕外缓存 (Cache)
│   └── 保存最近离开屏幕的ViewHolder（默认容量=2）
├── 3. 扩展缓存 (ViewCacheExtension)
│   └── 开发者自定义缓存（特殊用途）
└── 4. 回收池 (RecycledViewPool)
    └── 全局共享的ViewHolder存储（不同类型独立缓存）
```

根据`position`判断是否命中`Cache`，根据`viewType`判断是否命中`RecyclerViewPool`，会执行`onBindViewHolder`

在 **RecyclerView** 的回收复用机制中，`changedScrap` 和 `attachedScrap` 是两个关键临时缓存，而 **Stable IDs** 会改变 ViewHolder 获取的方式。以下是详细解释：

---

## 1. `changedScrap` 的作用

- **用途**：专门配合 `notifyItemChanged()` 或 `notifyDataSetChanged()` 使用。
- **工作机制**：
  - 当调用 `notifyItemChanged(position)` 时，被标记更新的 item 会被临时移到 `changedScrap` 中。
  - 在布局阶段（如 `onLayout`），这些 ViewHolder 会被重新绑定数据（调用 `onBindViewHolder()`），然后放回原位置。
- **目的**：支持局部更新动画（如淡入淡出），避免直接回收导致视觉中断。

---

## 2. `attachedScrap` 的作用

- **用途**：用于 **快速复用可见或即将可见的 ViewHolder**。
- **工作机制**：
  - 在布局过程中（如 `LinearLayoutManager.fill()`），RecyclerView 会先将当前屏幕上的 ViewHolder **临时移除** 到 `attachedScrap`。
  - 遍历新布局时，直接从 `attachedScrap` 中按 **position 匹配** 取回 ViewHolder（无需创建或绑定）。
- **目的**：避免无效的创建/绑定，提升滚动性能（尤其在快速滑动时）。

---

## 3. Stable IDs 如何改变 ViewHolder 获取方式

当启用 **Stable IDs**（通过 `setHasStableIds(true)` + 重写 `getItemId()`）时：

- **传统方式（无 Stable IDs）**：  
  RecyclerView 通过 **position** 在 `attachedScrap` 或 `changedScrap` 中查找匹配的 ViewHolder。

  ```java
  // 伪代码：按 position 匹配
  ViewHolder vh = attachedScrap.findViewForPosition(position);
  ```

- **启用 Stable IDs 后**：  
  RecyclerView 改为通过 **item ID**（而非 position）在 `scrap` 中查找 ViewHolder：

  ```java
  // 伪代码：按 stable ID 匹配
  ViewHolder vh = changedScrap.findViewHolderByItemId(id);
  ```

### 优势

1. **位置无关复用**：  
   - 即使数据集变化导致 item 位置改变（如插入/删除），仍能通过唯一 ID 正确复用 ViewHolder。
   - 避免因 position 变化导致的 “复用错乱” 问题（如 A 位置复用到 B 数据）。
2. **动画兼容性**：  
   - 支持更流畅的动画（如 `DiffUtil`），因为 ID 是数据项的唯一标识，不受布局顺序影响。
3. **效率提升**：  
   - 查找操作从 O(N) 优化到 O(1)（基于 `LongSparseArray` 实现）。

---

## 关键对比总结

| **特性**              | `changedScrap`                   | `attachedScrap`                   |
| --------------------- | -------------------------------- | --------------------------------- |
| **触发场景**          | `notifyItemChanged()` 调用时     | 布局过程中临时移除可见 ViewHolder |
| **数据状态**          | 需重新绑定（`onBindViewHolder`） | 数据未变，直接复用                |
| **存储内容**          | 被标记更新的 ViewHolder          | 当前/即将可见的 ViewHolder        |
| **查找方式（无 ID）** | 按 `position` 匹配               | 按 `position` 匹配                |
| **查找方式（有 ID）** | 按 `stableId` 匹配               | 按 `stableId` 匹配                |

> **使用建议**：  
> 若数据集存在动态位置变化（如排序、增删），强烈建议启用 **Stable IDs**，以提升复用准确性和动画效果。

