+++
date = '2026-02-26T09:59:33+08:00'
draft = false
title = 'Google 移动端基建踩坑：GCP 与 Firebase 项目关系'
categories = ['android']
tags = ['Android', 'Google', 'Firebase', 'GCP', 'Pitfall']
description = "复盘 Android 接入 Google/Firebase 生态时，GCP 项目、Firebase 项目、OAuth Client、SHA-1 和 google-services.json 容易混乱的原因与规避方式。"
slug = "google-mobile-infra-pitfalls"
+++

接入 Google 登录、Firebase Analytics、Crashlytics、FCM 等能力时，经常会遇到一个割裂感：有些配置在 GCP，有些配置在 Firebase，包名和 SHA-1 又会触发全局唯一性冲突。

这篇复盘的重点是理清 GCP 与 Firebase 的项目关系，避免以后重复踩坑。

## 问题现象

常见表现：

1. 已经在 GCP 创建 OAuth Client，Firebase 再添加 Android 应用时报冲突；
2. Firebase Analytics 正常，但 Google 登录失败；
3. Debug / Release SHA-1 配置不完整，导致某个构建变体不可用；
4. `google-services.json` 下载了，但 Web Client ID 和预期不一致；
5. 同一个包名 + SHA-1 被绑定到另一个 Google 项目。

## 根因

Firebase 项目底层一定绑定一个 Google Cloud 项目。

可以理解成：

```text
Firebase Console
  -> 更面向移动端开发者的入口
  -> 底层绑定 GCP Project
  -> 间接创建 OAuth Client / API 配置

Google Cloud Console
  -> 更底层的云资源入口
  -> 管理 API、OAuth、服务账号、权限
```

问题通常出在：一开始直接在 GCP 创建了项目和 OAuth Client，后来又在 Firebase 创建了另一个项目。此时同一个 Android 应用的包名和 SHA-1 已经被前一个项目占用，Firebase 再注册就会冲突。

## 推荐流程

新 Android 项目如果会用 Firebase 生态，建议以 Firebase 作为入口。

1. 在 Firebase Console 创建项目；
2. 在 Firebase 项目中添加 Android 应用；
3. 填写 applicationId；
4. 同时配置 Debug 和 Release SHA-1 / SHA-256；
5. 下载 `google-services.json`；
6. 在 Firebase Authentication 中开启 Google 登录；
7. 如需地图、YouTube、Play 相关 API，再进入该 Firebase 绑定的 GCP 项目开启。

原则：

> Firebase 负责移动端应用配置，GCP 负责底层 API 和云资源；不要为同一个 App 分别创建两套项目。

## 排查清单

遇到登录或 Firebase 配置异常时，按这个顺序看：

1. 当前 `applicationId` 是否和 Firebase 里注册的一致；
2. Debug/Release 使用的 keystore 是否都配置了 SHA-1；
3. `google-services.json` 是否来自当前 Firebase 项目；
4. GCP OAuth Client 是否属于同一个底层 GCP 项目；
5. 是否存在另一个历史项目占用了相同包名和 SHA-1；
6. Google Sign-In 使用的 Web Client ID 是否正确。

## 迁移建议

如果已经出现项目分裂：

1. 先确认线上正在使用哪个 Firebase/GCP 项目；
2. 不要直接删除历史 OAuth Client；
3. 记录所有 Debug/Release keystore 指纹；
4. 统一到一个 Firebase 项目；
5. 必要时在 GCP 中清理旧 Client 或重新绑定；
6. 重新下载并替换 `google-services.json`。

## 回看清单

1. Firebase 项目底层绑定 GCP 项目。
2. 同一个包名 + SHA-1 不应该分散注册到多个项目。
3. 接入移动端 Google 能力时，优先从 Firebase 创建项目。
4. 高级 API 再进入 Firebase 绑定的 GCP 项目开启。
5. `google-services.json`、OAuth Client 和 SHA-1 必须属于同一套项目关系。
