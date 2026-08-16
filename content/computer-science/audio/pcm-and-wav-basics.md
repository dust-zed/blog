+++
  title = "PCM 和 WAV 入门学习记录"
  date = "2026-08-14T00:00:00+08:00"
  draft = false
  description = "记录 PCM 与 WAV 的基础概念、采样率、位深、声道、字节序、数据大小计算方式，以及 WAV 文件头的基本结构。"
  slug = "pcm-and-wav-basics"
  categories = ["computer-science"]
  tags = ["Audio", "PCM", "WAV", "Multimedia"]

+++

## PCM 是原始采样数据

PCM可以理解为一串按时间排列的采样值。

每个sample表示某一个时间点的瞬时振幅：

```
0, 1000, 2000, 1000, 0, -1000, -2000
```

PCM本身不是波形图。波形图是把这些采样值画出来之后得到的可视化结果。

```
PCM 数据 -> 可视化 -> 波形图
```

一次采样只是一个点，很多连续采样点才构成一段波形。

### sample 和 frame

音频里有两个很重要的概念：
```
sample = 单个声道的一次采样值
frame = 同一时刻所有声道 sample 的组合
```

单声道 PCM:

```
S0 S1 S2 S3
```

双声道 interleaved PCM:

```
L0 R0 L1 R1 L2 R2 ...
```

所以生成双声道 PCM 时，每一帧都要写入左右两个声道的数据。

这里容易犯的错误是： 把`frame_index`的奇偶当成左右声道。

实际上`frame_index`表示第几帧，不表示第几个声道。

正确理解应该是:

```
第 0 帧: L0 R0
第 1 帧: L1 R1
第 2 帧: L2 R2
```

如果要做“左声道有声音， 右声道静音”， 每一帧都应该写：

```
left_sample +0
```

而不是偶数帧写左声道、奇数帧写右声道。

### 正弦波公式

生成正弦波时用到：

```rust
let sample = (t * frequency_hz * std::f32::consts::TAU).sin()
```

其中:

```
t = 当前时间
frequency_hz = 每秒振动多少次
TAU = 2π
```

正弦函数接收的是弧度，不是秒。

所以：

```
f * t       = 当前时间已经走过多少个周期
2π * f * t  = 把周期数转换成弧度
sin(...)    = 当前时刻的振幅
```

比如 440Hz 表示每秒 440 个周期。

1 秒就是走过了 440 个周期。

### 振幅和峰值

PCM里的每个 sample 都是一个瞬时振幅值，它会随着时间变化。

代码里的`amplitude`更像是最大振幅比例：

```rust
let sample = sin_value * amplitude * i16::MAX as f32;
```

如果：

```
amplitude = 0.2
```

那么 S16 PCM 的峰值大约是：

```
0.2 * 32767 ≈ 6553
```

所以对于一段纯正弦波：

```
每个采样值在变化
峰值范围基本固定
```

### WAV 是 PCM 的包装

裸 PCM 只有数据，没有格式说明。播放器不知道它的采样率、声道数、位深，也不知道该如何解释这些字节。

WAV 可以先理解为：

```
WAV = header 元数据 + PCM 数据
```

更通用地说：

```
音频文件 = 容器文件 + 编码后的音频数据
```

常见情况：

```
WAV  通常是 RIFF/WAVE 容器 + PCM
MP3  是压缩音频数据
M4A  通常是 MP4 容器 + AAC/ALAC
FLAC 是无损压缩音频数据
```

最简单的 44 字节 PCM WAV:

```
RIFF
WAVE
fmt 
data
```

### peak 和 RMS

读回 PCM 后，可以计算音量信息：

```
peak = 最大瞬时振幅
RMS = 能量意义上的平均音量
```

