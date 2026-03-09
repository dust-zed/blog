# 博客整理清单

> 生成时间：2026-03-09
> 状态：Phase 1+2+3 已完成

---

## 1. 文件移动清单（高优先级）✅ 已完成

根目录文件移动到正确分区：

| 序号 | 当前路径 | 目标路径 | 新文件名 | categories | status |
|------|----------|----------|----------|------------|--------|
| 1 | `content/2026-01-11.md` | `content/journal/weekly/` | `2026-01-11.md` | journal | done |
| 2 | `content/2026-01-18.md` | `content/journal/weekly/` | `2026-01-18.md` | journal | done |
| 3 | `content/2026-01-25.md` | `content/journal/weekly/` | `2026-01-25.md` | journal | done |
| 4 | `content/Android我的面试题总结.md` | `content/android/` | `android-senior-interview.md` | android | done |
| 5 | `content/embers: Stream与tokio::select的艺术.md` | `content/rust/tokio/` | `embers-stream-tokio-select.md` | rust | done |
| 6 | `content/embers_stream_tech_blog_1.md` | `content/rust/` | `embers-stream-tech-blog-01.md` | rust | done |
| 7 | `content/embers stream : 云游戏流媒体核心模块.md` | `content/rust/` | `embers-stream-cloud-gaming-core.md` | rust | done |
| 8 | `content/Option所有权和模式匹配总结.md` | `content/rust/std/` | `option-ownership-pattern-matching.md` | rust | done |
| 9 | `content/QUIC网络层实现总结.md` | `content/computer-science/network/` | `quic-implementation-summary.md` | computer-science | done |
| 10 | `content/Wgpu基本概念与初始化.md` | `content/rust/` | `wgpu-concepts-initialization.md` | rust | done |
| 11 | `content/google移动端基建踩坑记录.md` | `content/android/tools/` | `google-mobile-infra-pitfalls.md` | android | done |
| 12 | `content/Android_App_Startup.md` | `content/android/` | `android-app-startup.md` | android | done |

**front matter 已补充：**
- 所有文件已添加：`slug`, `description`, `tags`, `categories`

---

## 2. 分类修复清单（高优先级）✅ 已完成

将 `cs-basics` 改为 `computer-science`：

| 序号 | 文件路径 | 当前值 | 修改为 | status |
|------|----------|--------|--------|--------|
| 1 | `content/computer-science/webRtc-and-cloud-gaming.md` | cs-basics | computer-science | done |
| 2 | `content/computer-science/understanding-callback.md` | cs-basics | computer-science | done |
| 3 | `content/computer-science/os/endianness.md` | cs-basics | computer-science | done |
| 4 | `content/computer-science/tools/git-commands.md` | cs-basics | computer-science | done |
| 5 | `content/computer-science/tools/hugo-vercel-setup.md` | cs-basics | computer-science | done |
| 6 | `content/computer-science/tools/iterative-learning.md` | cs-basics | computer-science | done |
| 7 | `content/computer-science/tools/mac-terminal-setup.md` | cs-basics | computer-science | done |
| 8 | `content/computer-science/tools/vscode-efficiency.md` | cs-basics | computer-science | done |
| 9 | `content/computer-science/network/http-connection-management.md` | cs-basics | computer-science | done |
| 10 | `content/computer-science/network/http-deep-dive.md` | cs-basics | computer-science | done |
| 11 | `content/computer-science/network/https-encryption-flow.md` | cs-basics | computer-science | done |

---

## 3. 重复内容合并清单（中优先级）✅ 已完成

### 3.1 HTTP 相关文章 ✅

| topic | canonical_file | merge_from | missing_points | format_issues | status |
|-------|---------------|------------|----------------|---------------|--------|
| HTTP 协议深度解析 | `content/computer-science/network/http-deep-dive.md` | `content/computer-science/network/http-connection-management.md` | 无需合并 | 两篇内容互补，非重复 | done |

**处理结果**：两篇内容互补，保留为姊妹文。

### 3.2 Embers 相关文章 ✅

| topic | canonical_file | merge_from | missing_points | format_issues | status |
|-------|---------------|------------|----------------|---------------|--------|
| Embers Stream 云游戏流媒体 | `content/rust/embers-stream-cloud-gaming-core.md` | `embers-stream-tech-blog-01.md`（已删除，内容已在主稿中） | 无 | done |

**处理结果**：
- 删除 `embers-stream-tech-blog-01.md`（内容已包含在主稿中）
- 保留 `embers-stream-tokio-select.md` 和 `embers-stream-cloud-gaming-core.md` 为姊妹文
- 添加互链

### 3.3 WebRTC 相关文章 ✅

| topic | canonical_file | merge_from | missing_points | format_issues | status |
|-------|---------------|------------|----------------|---------------|--------|
| WebRTC 深度解析 | `content/computer-science/network/webRTC-SDP-and-IceCandidate.md` | `content/computer-science/webRtc-and-cloud-gaming.md` | 无 | 无 | done |

**处理结果**：两篇保留为姊妹文，已添加互链。

---

## 4. 文件重命名清单（中优先级）

已移动文件的重命名（见第 1 节），其他分区内的重命名：

| 序号 | 当前路径 | 新文件名 | status |
|------|----------|----------|--------|
| 1 | `content/rust/Clean_Architecture+Rust实战.md` | `clean-architecture-rust-practice.md` | todo |
| 2 | `content/rust/UniFFI实战手册-Android_Rust混合开发版.md` | `uniffi-practical-guide-android-rust.md` | todo |
| 3 | `content/rust/Rust-FFI最佳实践：利用条件编译实现零成本模型共享.md` | `rust-ffi-conditional-compilation.md` | todo |
| 4 | `content/rust/Rust底层揭秘:函数调用、栈帧与虚表的内存博弈.md` | `rust-stack-frame-vtable-memory.md` | todo |
| 5 | `content/rust/从异步Trait到底层原理.md` | `async-trait-deep-dive.md` | todo |

---

## 5. Front Matter 补充清单（低优先级）

需要补充 `slug` 和 `description` 的文件（移动后统一处理）：

| 序号 | 文件 | 缺失字段 | status |
|------|------|----------|--------|
| 1 | 根目录移动的所有文件 | slug, description, tags | todo |
| 2 | 其他分区 front matter 不完整的文件 | 待排查 | todo |

---

## 6. 执行计划

### Phase 1：基础设施修复 ✅ 已完成
1. [x] 批量修改 `cs-basics` -> `computer-science`（11 个文件）
2. [x] 本地构建验证：`hugo --gc --minify`

### Phase 2：文件归位 ✅ 已完成
1. [x] 移动根目录文件到正确分区（12 个文件）
2. [x] 重命名文件为 kebab-case
3. [x] 补充 front matter（slug, description, tags, categories）
4. [x] 本地构建验证：`hugo --gc --minify`

### Phase 3：内容整合 ✅ 已完成
1. [x] 分析 HTTP 相关文章 → 内容互补，保留为姊妹文
2. [x] 整合 Embers 相关文章 → 删除重复稿，保留姊妹文并添加互链
3. [x] 建立 WebRTC 文章互链
4. [x] 本地构建验证：`hugo --gc --minify`

### Phase 4：验证与清理
1. [ ] 运行 `hugo --gc --minify`
2. [ ] 检查所有链接
3. [ ] 更新各分区 `_index.md`

---

## 备注

- 每完成一项，将 status 改为 `done`
- 如遇问题，在备注栏记录
- 建议每个 Phase 单独提交
