+++
title = 'MMKV 与 SharedPreferences：轻量级键值存储选型'
date = '2025-07-01T15:49:53+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Storage', 'MMKV', 'SharedPreferences', 'Performance']
description = "对比 Android 中 MMKV 与 SharedPreferences 的设计差异、性能表现、可靠性边界与适用场景。"
slug = "mmkv-vs-sharedpreferences"
+++

Android 中的 `SharedPreferences` 和 `MMKV` 都适合存储轻量级键值数据，例如开关、用户偏好、少量业务状态和本地缓存标记。它们看起来解决的是同一个问题，但底层模型完全不同，因此性能、可靠性和适用场景也不同。

一句话结论：

> 少量、低频、单进程配置可以继续使用 `SharedPreferences`；高频读写、多进程访问或对启动性能敏感的场景，更适合使用 `MMKV`。

## 核心对比

| 维度 | SharedPreferences | MMKV |
| --- | --- | --- |
| 存储格式 | XML 文件 | Protobuf 编码 |
| 读写模型 | 内存 Map + 文件持久化 | `mmap` 内存映射 + 文件持久化 |
| 写入方式 | `apply()` 异步，`commit()` 同步 | 写入内存映射区域，由系统负责刷盘 |
| 性能特点 | 小数据、低频写入足够简单 | 高频读写更有优势 |
| 多进程 | `MODE_MULTI_PROCESS` 已不推荐 | 原生支持多进程模式 |
| 接入成本 | 系统内置，无需依赖 | 需要引入第三方库 |
| 适合场景 | 简单配置、低频偏好 | 高频配置、跨进程状态、启动路径读写 |

## SharedPreferences 的模型

`SharedPreferences` 是 Android 官方提供的轻量级键值存储 API，文件通常位于：

```text
/data/data/<package_name>/shared_prefs/
```

它的核心模型可以理解为：

```text
XML 文件
  -> 首次读取时加载到内存 Map
  -> 修改内存数据
  -> apply/commit 持久化回 XML
```

### SharedPreferences 的优点

`SharedPreferences` 最大的优势是简单、稳定、系统内置。对于低频配置，例如是否首次启动、主题开关、简单用户偏好，它的使用成本很低。

常见写入方式有两个：

```kotlin
preferences.edit()
    .putBoolean("first_open", false)
    .apply()
```

`apply()` 会先更新内存，再异步写入磁盘，日常更常用。

```kotlin
val success = preferences.edit()
    .putString("token", token)
    .commit()
```

`commit()` 会同步等待写入结果，因此可以拿到成功或失败，但不适合在主线程频繁调用。

### 主要问题

`SharedPreferences` 的问题通常不是“不能用”，而是容易被用在不适合的场景。

1. **频繁写入成本较高**

   它以 XML 作为持久化格式。数据变多后，序列化、反序列化和文件写入成本都会上升。

2. **`apply()` 也可能影响主线程**

   `apply()` 虽然是异步写入，但未完成的写入任务会进入 `QueuedWork`。在 Activity 停止等生命周期阶段，系统可能等待这些任务完成。如果积压了大量写入，仍然可能拖慢主线程。

3. **多进程场景不可靠**

   `MODE_MULTI_PROCESS` 已经不推荐使用。多个进程同时读写同一个配置文件时，很难保证状态实时一致。

4. **不适合存储大对象**

   它只适合基础类型和字符串集合。复杂对象需要自行序列化，这会让边界变得模糊：配置存储逐渐变成小型数据库，但又没有数据库的事务、查询和迁移能力。

## MMKV 的模型

`MMKV` 是微信开源的高性能键值存储组件。它的核心机制是 `mmap`：

```text
文件
  -> mmap 映射到进程虚拟内存
  -> 读写像操作内存一样进行
  -> 操作系统负责把脏页刷回磁盘
```

它还使用 Protobuf 进行编码，相比 XML 更紧凑，也更适合频繁读写。

### MMKV 的优点

1. **读写性能更好**

   高频读写时，`mmap` 可以减少传统文件 I/O 的数据拷贝和系统调用成本。对于启动路径上需要读取多个配置项的场景，MMKV 通常更合适。

2. **支持多进程**

   MMKV 提供多进程模式，内部通过文件锁等机制处理并发访问，比 `SharedPreferences` 的多进程方案可靠。

3. **编码更紧凑**

   Protobuf 编码通常比 XML 更省空间，也减少了解析文本格式的开销。

4. **API 仍然接近键值存储**

   它并没有引入复杂数据库模型，迁移成本相对可控。

### 需要注意的边界

MMKV 性能更强，但不意味着所有本地数据都应该塞进去。

1. **它仍然是键值存储**

   如果数据需要复杂查询、关系建模、分页读取或事务保证，应该考虑 Room、SQLite 或专门的数据层方案。

2. **跨语言或跨版本数据要关注兼容性**

   存储结构升级时，要考虑旧 key、默认值和异常数据。

3. **第三方依赖需要纳入工程治理**

   引入 MMKV 后，要关注版本升级、初始化位置、多进程模式配置和崩溃兜底。

## 选型建议

### 继续使用 SharedPreferences

适合这些场景：

1. 数据量很小；
2. 写入频率低；
3. 只在单进程访问；
4. 不在启动关键路径上频繁读写；
5. 不需要额外引入依赖。

典型例子：

```text
是否首次启动
是否开启深色模式
用户选择的语言
简单实验开关
```

### 优先考虑 MMKV

适合这些场景：

1. 启动阶段需要读取多个配置项；
2. 配置更新比较频繁；
3. App 存在多进程访问；
4. 对配置读写性能比较敏感；
5. 原本的 `SharedPreferences` 已经出现卡顿或 ANR 风险。

典型例子：

```text
启动配置缓存
跨进程共享开关
音视频或云游戏场景中的运行参数
频繁变化的轻量状态
```

## 迁移思路

从 `SharedPreferences` 迁移到 MMKV 时，不建议一次性全量替换。更稳妥的方式是按风险分层：

1. 先迁移高频读写或启动路径上的配置；
2. 保留旧 key 的读取逻辑，首次读取后写入 MMKV；
3. 给默认值和异常值兜底；
4. 观察一段时间后再清理旧数据；
5. 避免在迁移过程中改变业务语义。

伪代码示例：

```kotlin
fun getBoolean(key: String, defaultValue: Boolean): Boolean {
    if (mmkv.containsKey(key)) {
        return mmkv.decodeBool(key, defaultValue)
    }

    val oldValue = sharedPreferences.getBoolean(key, defaultValue)
    mmkv.encode(key, oldValue)
    return oldValue
}
```

## 回看清单

1. `SharedPreferences` 简单可靠，但不适合大文件、高频写入和多进程同步。
2. `apply()` 不是完全没有主线程风险，生命周期阶段可能等待未完成写入。
3. `MMKV` 的优势来自 `mmap` 和 Protobuf，适合性能敏感的轻量级键值数据。
4. MMKV 不是数据库，不应该承担复杂数据模型和查询职责。
5. 迁移时优先处理高风险 key，保持旧数据兜底，避免一次性重构引入新问题。
