+++
date = '2025-06-11T12:20:50+08:00'
draft = false
title = 'Hugo Vercel博客配置'
categories = ['cs-basics']
tags = ['Hugo', 'Vercel', 'Blog']
description = '利用Hugo搭建博客并通过Vercel自动部署'
slug = "hugo-vercel-setup"

+++

## 前期准备

1. 安装 Hugo

   ```bash
   # macOS (Homebrew)
   brew install hugo
   ```

2. 注册Vercel账号

## 创建本地博客

### 1.1 生成新站点

```bash
hugo new site myblog
cd myblog
```

### 1.2 添加主题

```bash
git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke.git themes/ananke
echo "theme = 'ananke'" >> config.toml  # 配置主题
```

## 自定义域名

1. 在Vercel控制控制台 -> **Settings** -> **Domains**
2. 输入自己的域名(`dust-zed.site`,可在阿里云购买)
3. 按提示配置DNS解析

## 管理不同类型的文章

### 3.1 使用物理目录分类

```bash
content/
├── blog/           # 常规博客
├── tutorials/      # 教程类
├── reviews/        # 产品评测
└── notes/          # 学习笔记
```

### 3.2 创建对应类型文章

```bash
hugo new tutorials/hugo-vercel博客配置.md
```

### 3.3 统一配置文件

在`config.toml`中集中管理URL规则

```toml
# 所有文章默认路径
# :slug动态代表内容的URL友好版本标题
[permalinks]
  posts = "/blog/:year/:month/:slug/"
  tutorials = "/learn/:slug/"
  reviews = "/products/:category/:slug/"

# 分类页面路径
[taxonomies]
  category = "categories"
  tag = "tags"

```

### 3.5 多级目录

使用的是`hugo-theme-stack`主题，支持多级目录，需要通过配置和内容组织来实现。

**内容组织**

按层级组织内容文件夹：

```toml
content/
├── rust/                  # 一级目录
│   ├── ripgrep/              # 二级目录
│   │   ├── test/            # 三级目录
│   │   │   ├── post1.md   # 文章
│   │   ├── post2.md
│   ├── other/              # 二级目录
│   │   ├── post3.md
```

然后需要在文章的frontmatter中指定分类层级：

```toml
categories = ["rust", "ripgrep"]
```

**配置导航菜单**

修改config.toml配置文件，通过[[menu.main]]定义需要多级菜单的目录:

```toml
[[menu.main]]
  name = "rust"
  url = "/rust"
  weight = 2

  [[menu.main.children]] # 注意缩进
    name = "ripgrep"
    url = "/rust/ripgrep"
    weight = 1
```

**添加索引文件**

二级菜单通常需要对应实际内容目录，否则可能被主题隐藏：

* 在`content`目录下创建匹配的文件夹结构，并添加索引文件`_index.md`

```
content/
└── rust/
    ├── _index.md  # 一级目录索引页
    └── ripgrep/
        └── _index.md  # 二级目录索引页
```

* 在 `_index.md` 中添加基本内容（frontmatter 即可）：

```toml
# content/rust/_index.md
+++
title = "Rust 相关内容"
+++
```

## 升级维护

* 更新主题：`git submodule update --remote --merge`

* 本地测试：`hugo server -D`

* 强制清除缓存：`hugo --gc -minify --cleanDestiantionDir`

* 使用`hugo new --kind tutorial tutorials/new-tutorial.md`创建预设格式的文章

* 为不同目录设置独立的前言参数(archetypes)

  ```bash
  archetypes/
  ├── tutorials.md     # 博客教程模板
  ```
