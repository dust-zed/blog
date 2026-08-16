+++
title = 'RecyclerView 缓存机制：Scrap、Cache 与 RecycledViewPool'
date = '2025-06-11T15:26:57+08:00'
draft = false
categories = ['android']
tags = ['Android', 'RecyclerView', 'Performance']
description = "整理 RecyclerView 多级缓存机制，解释 attachedScrap、changedScrap、mCachedViews、ViewCacheExtension、RecycledViewPool 与 Stable IDs 的作用。"
slug = "recyclerview-caching-mechanism"
+++

RecyclerView 的性能核心不是“少创建几个 ViewHolder”这么简单，而是通过多级缓存把不同状态的 ViewHolder 放在不同位置，尽量减少创建、绑定和布局成本。

## 核心结论

1. 屏幕内重新布局优先命中 `attachedScrap`，通常不需要重新绑定。
2. 屏幕外短距离滑动优先命中 `mCachedViews`，默认容量较小。
3. `RecycledViewPool` 按 `viewType` 复用 ViewHolder，通常需要重新绑定。
4. `changedScrap` 服务于更新动画和局部刷新。
5. Stable IDs 能让 RecyclerView 在位置变化时仍按数据身份匹配 ViewHolder。

## 多级缓存模型

```text
RecyclerView.Recycler
├── attachedScrap
│   └── 布局过程中临时保存屏幕内 ViewHolder
├── changedScrap
│   └── 保存发生数据变化、用于动画过渡的 ViewHolder
├── mCachedViews
│   └── 保存刚离开屏幕的 ViewHolder，按 position 优先复用
├── ViewCacheExtension
│   └── 业务自定义缓存入口，较少使用
└── RecycledViewPool
    └── 按 viewType 分类的共享回收池
```

可以粗略记成：

```text
越靠前，越接近原位置，复用成本越低；
越靠后，越通用，但越可能需要重新绑定。
```

## attachedScrap

`attachedScrap` 用在布局过程中。

当 RecyclerView 重新布局时，当前可见的 ViewHolder 会先被临时放进 `attachedScrap`。布局管理器再次需要某个 position 时，可以直接取回来。

特点：

1. 主要服务屏幕内重新布局；
2. 通常按 position 匹配；
3. 命中后一般不需要重新创建，也不需要重新绑定；
4. 成本最低。

## changedScrap

`changedScrap` 主要服务更新动画。

当调用 `notifyItemChanged()` 或发生可动画的数据变化时，旧 ViewHolder 可能会进入 `changedScrap`，用于和新状态做动画过渡。

特点：

1. 和 `ItemAnimator` 关系密切；
2. 可能需要重新绑定；
3. 用于保留变化前后的 ViewHolder 状态；
4. 让局部刷新不至于直接闪烁。

## mCachedViews

`mCachedViews` 保存刚离开屏幕的 ViewHolder，默认容量通常较小。

它的价值在于：用户短距离来回滑动时，刚离开的 item 很可能马上回来。这时直接复用可以避免重新绑定。

特点：

1. 默认容量有限；
2. 更偏向 position 级别复用；
3. 命中后可能不需要重新绑定；
4. 适合处理短距离滚动回退。

## RecycledViewPool

`RecycledViewPool` 是更通用的回收池，按 `viewType` 分类。

进入这里的 ViewHolder 已经和具体 position 脱钩。复用时只保证类型匹配，不保证数据仍然正确，因此通常要重新执行 `onBindViewHolder()`。

适合场景：

1. 长列表复用；
2. 多个 RecyclerView 共享同类 item；
3. ViewHolder 创建成本较高；
4. 页面中存在嵌套列表。

## Stable IDs 的作用

默认情况下，RecyclerView 更依赖 position 判断 item 身份。数据插入、删除、排序后，position 会变化，这可能影响动画和复用判断。

启用 Stable IDs 后：

```kotlin
adapter.setHasStableIds(true)

override fun getItemId(position: Int): Long {
    return items[position].id
}
```

RecyclerView 可以用稳定 ID 判断“这是同一条数据”，即使它的位置变了。

适合：

1. 数据有天然唯一 ID；
2. 列表存在插入、删除、排序；
3. 需要更稳定的变更动画；
4. 配合 `DiffUtil` 或 `ListAdapter` 使用。

注意：Stable ID 必须稳定且唯一。如果 ID 错误，复用错乱会更难排查。

## 回看清单

1. `attachedScrap` 解决屏幕内布局复用。
2. `changedScrap` 解决变化动画和局部刷新。
3. `mCachedViews` 解决短距离滑动回退。
4. `RecycledViewPool` 解决跨位置、跨列表的通用复用。
5. Stable IDs 用数据身份补足 position 的不稳定性。
