+++
date = '2026-01-11T13:02:10+08:00'
draft = false
title = 'Clean Architecture + Rust：Kotlin UI 与 Rust Core 的边界'
categories = ['android']
tags = ['Architecture', 'Rust', 'CleanArchitecture', 'FFI']
description = "整理 Kotlin UI + Rust Core 的架构实践：Domain 作为契约层，Kotlin 负责平台与展示，Rust 承载可复用核心逻辑。"
slug = "clean-architecture-rust-practice"
+++

把 Rust 引入 Android 项目时，最重要的问题不是“能不能调用 Rust”，而是“哪些逻辑值得放到 Rust”。如果边界不清楚，跨语言调用只会增加复杂度。

## 核心结论

1. Kotlin 适合处理 Android 平台能力、生命周期、权限、UI 和依赖注入。
2. Rust 适合承载可跨平台复用、计算密集、协议解析或强一致性的核心逻辑。
3. Domain 层应该定义稳定接口和模型，隔离 UI 与具体实现。
4. FFI 边界要尽量窄，避免 Kotlin 和 Rust 互相泄漏内部细节。
5. 使用 Rust 的收益必须大于构建、调试、类型映射和团队学习成本。

## 架构模型

```mermaid
graph LR
    UI["Kotlin UI / Compose"]
    VM["ViewModel"]
    Domain["Domain Interfaces / Models"]
    Adapter["Kotlin Adapter / UniFFI Binding"]
    Rust["Rust Core"]

    UI --> VM
    VM --> Domain
    Domain --> Adapter
    Adapter --> Rust
```

职责划分：

| 层 | 职责 |
| --- | --- |
| Kotlin UI | 渲染、交互、生命周期 |
| ViewModel | UI 状态管理、调用 UseCase |
| Domain | 接口、领域模型、用例边界 |
| Adapter | Kotlin 与 Rust 类型适配 |
| Rust Core | 核心逻辑、协议、计算、跨平台能力 |

## Domain 作为契约

Domain 层不应该关心底层是 Kotlin、Rust 还是 C++。

```kotlin
interface GameRepository {
    suspend fun getGameDetails(id: String): Game
    suspend fun startSession(config: SessionConfig): SessionResult
}
```

ViewModel 只依赖这个接口：

```kotlin
class GameViewModel(
    private val repository: GameRepository,
) : ViewModel()
```

Rust 只是接口的一种实现来源。

## Kotlin 侧边界

Kotlin 保留这些职责：

1. Compose / View UI；
2. Android 生命周期；
3. 权限、通知、Intent 等平台能力；
4. Hilt/Koin 依赖装配；
5. UI 状态和一次性事件。

不要把 Android `Context`、`Activity`、`View` 等平台对象传进 Rust Core。

## Rust 侧边界

Rust 更适合：

1. 协议解析；
2. 编解码辅助逻辑；
3. 复杂业务规则；
4. 高并发网络核心；
5. 跨 Android/iOS/桌面复用的能力。

Rust 不适合直接处理：

1. Android 生命周期；
2. UI 状态；
3. 权限弹窗；
4. 依赖注入容器；
5. 和平台强绑定的对象。

## 依赖装配

Hilt 负责把 Rust 实现装配成 Domain 接口：

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides
    fun provideGameRepository(
        rustService: RustGameService,
    ): GameRepository {
        return RustGameRepository(rustService)
    }
}
```

这样 UI 层不需要知道 Rust 细节。

## 回看清单

1. Rust Core 应该服务架构边界，而不是制造新的耦合。
2. Domain 层定义稳定协议，Kotlin/Rust 都围绕它实现。
3. FFI 传输模型要简单、明确、可版本化。
4. 平台对象留在 Kotlin，核心逻辑放到 Rust。
5. 引入 Rust 前先问：这段逻辑是否真的需要跨平台或高性能核心。
