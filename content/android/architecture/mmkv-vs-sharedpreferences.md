+++
title = 'MMKV与SharedPreferences'
date = '2025-07-01T15:49:53+08:00'
draft = false
categories = ['android']
tags = ['Android', 'Storage', 'MMKV', 'SharedPreferences', 'Performance']
description = "对比 Android 中 MMKV 与 SharedPreferences 的设计差异、性能表现及适用场景。"
slug = "mmkv-vs-sharedpreferences"
+++

Android中的MMKV和SharedPreferences都是用于存储键值对数据的轻量级解决方案，但他们在设计、性能和适用场景上存在显著差异。

-----

## SharedPreferences

* **定位**：Android官方提供的轻量级键值对存储API。
* **实现**：
  * 基于`XML`文件存储。
  * 数据保存在`/data/data/<package_name>/shared_prefs/`目录下
* 特点：
  * 简单易用：API直观，原生支持
  * 线程安全(读写锁)：内部使用锁机制保证多线程安全，但也可能成为性能瓶颈
  * **异步写入(`apply()`)**:主要推荐方式，异步写入磁盘，避免阻塞UI线程(但提交操作本身在主线程)。
  * **同步写入(`commit()`)**:阻塞调用线程直到写入完成，可能导致ANR，一般避免在主线程使用。
* 主要缺点：
  * 性能较差：
    * **全量写入**：即使只修改一个值，`apply()/commit()`也会触发整个XML文件的序列化和写入操作。
    * **XML解析开销**：每次读取都需要解析XML
  * 潜在ANR风险：
    * `commit(`)在主线程同步写入大文件可能导致ANR。
    * `apply()`的潜在ANR：apply虽然异步，但它把写入任务放进一个`QueueWork队列`。在Activity生命周期（如`onPause`，`onStop`）触发`QueueWork.waitToFinish()`时，会等待所有未完成的apply()写入任务完成。如果后台任务积压或写入缓慢，会阻塞主线程，可能导致ANR(尤其在低端设备、频繁更新或大文件时)。
  * 可靠性问题(`MODE_MULTI_PROCESS`):
    * 官方`MODE_MULTI_PROCESS`已被弃用且声明不可靠。不支持真正的多进程同步。
  * 数据膨胀：修改频繁会导致XML文件变大（需手动`clear + commit`才能减小）。
  * 不支持复杂类型：仅支持基本类型，存储对象需自行序列化

----

## 2. MMKV

* **定位**：由腾讯微信团队开源的高性能**跨平台**键值存储组件
* **实现原理**：
  * **内存映射(`mmap`)**:核心机制！将文件直接映射到内存空间。读写操作直接在内存中进行，由操作系统负责异步刷盘。省去了传统I/O的数据拷贝过程，比XML更小更快
  * `Protobuf`编码：使用高效的protobuf格式进行序列化，比XML更小更快。
  * **增量写入**：修改数据时，通常是**追加写**到文件末尾 (append-only)，避免全量重写。通过特殊的空间复用和垃圾回收机制处理过期数据。
* **特点**：
  * 极致性能：读写速度远超SharedPreferences，通常达到数倍或百倍的提升。写入即生效，读取立即可见。
  * 真正的多进程支持：完美解决跨进程同步问题（`mmap` + `文件锁/进程间锁机制`）
  * 更小的存储空间：protobuf编码比XML更紧凑。
  * 无ANR担忧：
    * 写入操作几乎完全被`mmap`和`OS`接管，是真正非阻塞的。
    * 完全避免了`SharedPreferences.apply`潜在的`QueueWork.waitToFinish()`ANR问题
  * 支持数据类型丰富：原生支持基本类型、`String`, `byte[]`, 并且能方便地支持实现了 `Parcelable` 或 `Serializable` 的**任意 Java 对象**。

