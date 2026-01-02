+++
date = '2025-09-01T17:12:26+08:00'
draft = false
title = '文件系统'
categories = ['rust']
tags = ['FileSystem', 'OS', 'Configuration']
description = "文件系统基础：元数据、环境变量、挂载点及设备号概念。"
slug = "file-system"

+++

## 文件系统

* `metadata`:本质上就是描述文件信息的数据
* 环境变量和配置文件
  * 配置文件：存储**默认配置**或**静态配置**
  * 环境变量：提供**动态覆盖**或**环境特定配置**
* **挂载（Mount）**： 将**存储设备**或**文件系统**连接到操作系统目录树中特定位置的过程。这个连接点称为**挂载点（Mount Point）**。类比门和仓库的关系。
* 文件设备号
