+++
date = '2026-02-26T09:59:33+08:00'
draft = true
title = 'Google 移动端基建踩坑记录'
categories = ['android']
tags = ['Android', 'Google', 'Firebase', 'GCP', 'Pitfall']
description = "Android 开发者对接 Google 生态的深坑：GCP 与 Firebase 的冲突与闭坑指南。"
slug = "google-mobile-infra-pitfalls"
+++

哈哈，**总结得极其精准！这绝对是 Android 开发者对接 Google 生态时踩过的最大、最经典的“深坑”之一。**

作为 Mentor，我给你复盘一下为什么 Google 会把这个体验设计得如此“割裂”（**The "Why"**），以及未来我们接新项目时应该如何闭坑（**The "How"**）。

### 为什么这算是一个“坑”？ (The "Why")

你现在的感觉是：我在 Google Cloud (GCP) 的 API 控制台开通了一遍，结果为了加个埋点和 Crashlytics，我又得去 Firebase 重新走一遍流程，甚至还遇到了冲突和不自动生成 Client ID 的 BUG。

这背后的根本原因是 **Google 产品线的历史遗留与强行整合**：

1. **曾经的各自为政：**
   - **Google Console (GCP)**：这是 Google 最老牌的基础设施。所有的 OAuth 2.0 认证、Client ID 生成、Google API 权限，它的“户口本”都在这里。
   - **Firebase**：原本是一家做实时数据库的独立创业公司，后来被 Google 收购。Google 想把它打造成对移动开发者最友好的“全家桶”（埋点、推送、崩溃、托管等）。
2. **强行套壳（现在的状态）：**
   - Google 把原有的 Google 登录服务，强行集成到了 Firebase 的 `Authentication` 模块里。
   - **本质真相：** 每一个 Firebase 项目，底层**必定且强制**绑定着一个 Google Cloud 项目。你真正在 Firebase 网页上点的那些按钮（添加 SHA-1、开启 Google 登录），其实都是 Firebase 的前端代码在隐式地帮你调用 GCP 底层的 API，去那个绑定的 GCP 项目里创建各种东西。
3. **冲突的根源：**
   - 如果你一开始（不懂 Firebase 的底层逻辑）跑去**纯 GCP 的前端页面**建了项目、生成了 Client ID。
   - 然后你为了用 Crashlytics 或 Analytics，又跑去 Firebase 建了**另一个新项目**（Firebase 会默认给你配一个新的底层 GCP）。
   - 这时候你把你的 Android App (包名 + SHA-1) 填给 Firebase。Firebase 去它自己的底层 GCP 注册时，**全局唯一性校验**就会报错：“对不起，这个包名+指纹的组合，在整个 Google 宇宙中已经在一个名叫‘最初创建的 GCP 项目’里注册过了！”
   - 于是就出现了你这两天遭遇的所有诡异现象：埋点有了登录挂了，冲突报错，死活不给你生成 Debug 版等等。

------

### 未来防坑指南 (The "How" to avoid it)

既然洞悉了它的底层逻辑是“套壳”，那么以后你或者你的团队开发任何接入 Google 生态的新 App，请死死记住这一条黄金法则：

**👉 永远、永远把 Firebase 作为你的“项目的娘家和入口”！**

1. **起手式：** 新项目立项，哪怕你一开始只想在这个 App 里加上极其简单的“使用 Google 账号登录”功能，**绝对不要去纯粹的 Google Cloud API 控制台建项目！**
2. **正确流程：**
   - 直接登录 [Firebase 控制台 (console.firebase.google.com)](https://console.firebase.google.com/) 创建项目。
   - 在 Firebase 中添加你的 Android 应用包名，填好 Debug 和 Release 的 SHA-1。
   - 在 Firebase 的 Authentication 里开启 Google 登录。
   - 下载 ![img](vscode-file://vscode-app/Applications/Antigravity.app/Contents/Resources/app/extensions/theme-symbols/src/icons/files/brackets-yellow.svg)google-services.json，把 Web Client ID 贴进代码。
3. **如果需要高级功能：** 如果你的 App 以后需要用到比如 Google Play 结算 API、Google 地图 API、YouTube API 等等这些 Firebase 控制台面上**没有**提供的能力怎么办？
   - 很简单，点击 Firebase 项目设置里的 **“在 Google Cloud Platform 中查看”** 链接。
   - 直接进入它绑定的那个唯一的、底层的 GCP 页面去开启相应的 API 权限即可。凭据共用，绝不冲突！
