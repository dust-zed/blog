+++
date = '2025-06-11T12:20:50+08:00'
draft = false
title = 'Hugo Vercel博客配置'
description = '利用Hugo搭建博客并通过Vercel自动部署'
categories = ['tutorials']

+++

#### 前期准备

1. 安装 Hugo

   ```bash
   # macOS (Homebrew)
   brew install hugo
   ```

2. 注册Vercel账号

#### 创建本地博客

##### 1.1 生成新站点

```bash
hugo new site myblog
cd myblog
```

##### 1.2 添加主题

```bash
git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke.git themes/ananke
echo "theme = 'ananke'" >> config.toml  # 配置主题
```

#### 自定义域名

1. 在Vercel控制控制台 -> **Settings** -> **Domains**
2. 输入自己的域名(`dust-zed.site`,可在阿里云购买)
3. 按提示配置DNS解析

#### 管理不同类型的文章

##### 3.1 使用物理目录分类

```bash
content/
├── blog/           # 常规博客
├── tutorials/      # 教程类
├── reviews/        # 产品评测
└── notes/          # 学习笔记
```

##### 3.2 创建对应类型文章

```bash
hugo new tutorials/hugo-vercel博客配置.md
```

##### 3.3 统一配置文件

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

##### 3.4 自动生成分类列表



#### 升级维护

* 更新主题：`git submodule update --remote --merge`

* 本地测试：`hugo server -D`

* 强制清除缓存：`hugo --gc -minify --cleanDestiantionDir`

* 使用`hugo new --kind tutorial tutorials/new-tutorial.md`创建预设格式的文章

* 为不同目录设置独立的前言参数(archetypes)

  ```bash
  archetypes/
  ├── tutorials.md     # 博客教程模板
  ```

  
