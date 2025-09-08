+++
date = '2025-09-08T12:19:22+08:00'
draft = true
title = 'Mac终端美化配置'
categories = ['tutorials']

+++

# Mac终端美化完整配置指南

## 步骤一：安装 iTerm2

### 1.1 下载并安装 iTerm2

```bash
# 方法一：直接下载
# 访问 https://iterm2.com 下载最新版本

# 方法二：使用 Homebrew（推荐）
# 先安装 Homebrew（如果还没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 使用 Homebrew 安装 iTerm2
brew install --cask iterm2
```

### 1.2 启动 iTerm2

- 在应用程序文件夹中找到 iTerm2
- 双击启动，第一次可能需要授权

------

## 步骤二：确认并切换到 Zsh

### 2.1 检查当前 Shell

```bash
echo $SHELL
```

如果显示 `/bin/zsh`，可以跳过切换步骤

### 2.2 切换到 Zsh（如果需要）

```bash
# 查看系统可用的 Shell
cat /etc/shells

# 切换默认 Shell 为 Zsh
chsh -s /bin/zsh

# 重启终端使设置生效
```

------

## 步骤三：安装 Oh My Zsh

### 3.1 安装 Oh My Zsh

```bash
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### 3.2 验证安装

安装完成后，终端会自动重启，你会看到彩色的提示符，说明安装成功。

------

## 步骤四：安装 Powerlevel10k 主题

### 4.1 安装主题

```bash
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
```

### 4.2 修改配置文件

```bash
# 编辑 zsh 配置文件
nano ~/.zshrc
```

找到 `ZSH_THEME` 行，修改为：

```bash
ZSH_THEME="powerlevel10k/powerlevel10k"
```

### 4.3 重新加载配置

```bash
source ~/.zshrc
```

### 4.4 配置 Powerlevel10k

重新加载后会自动启动配置向导，按照提示选择：

1. 字体安装：选择 "Yes" 安装 MesloLGS NF 字体
2. 样式选择：选择你喜欢的样式（推荐 Rainbow 或 Lean）
3. 图标显示：选择是否显示各种图标
4. 完成配置

如果没有自动启动配置向导：

```bash
p10k configure
```

------

## 步骤五：安装增强插件

### 5.1 安装自动建议插件

```bash
git clone git@github.com:zsh-users/zsh-autosuggestions.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
```

### 5.2 安装语法高亮插件

```bash
git clone git@github.com:zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

### 5.3 修改插件配置

```bash
vim ~/.zshrc
```

找到 `plugins=` 行，替换为：

```bash
plugins=(
    git                      # Git命令补全和别名
    zsh-autosuggestions     # 命令历史建议
    zsh-syntax-highlighting # 命令语法高亮
    web-search              # 快速搜索
    copypath                # 复制当前路径
    copyfile                # 复制文件内容
    colored-man-pages       # 彩色man页面
    extract                 # 智能解压
)
```

### 5.4 重新加载配置

```bash
source ~/.zshrc
```

------

## 步骤六：iTerm2 优化设置

### 6.1 字体设置

1. 打开 iTerm2 偏好设置 (⌘ + ,)
2. 选择 Profiles → Text
3. 字体改为：MesloLGS NF (如果按照向导安装了的话)
4. 字体大小：14-16

### 6.2 颜色主题

1. 在 Profiles → Colors
2. Color Presets 选择：
   - Solarized Dark（经典）
   - Dracula（护眼）
   - 或导入其他主题

### 6.3 窗口设置

1. 在 Profiles → Window
2. 调整透明度（可选）
3. 设置窗口大小

------

## 步骤七：安装实用工具（可选）

### 7.1 安装现代化命令工具

```bash
# 更好的 ls
brew install exa

# 更好的 cat
brew install bat

# 更好的 find
brew install fd

# 更好的 grep
brew install ripgrep
```

### 7.2 添加别名

在 `~/.zshrc` 文件末尾添加：

```bash
# 现代化命令别名
alias ls='exa --icons'
alias ll='exa -l --icons'
alias la='exa -la --icons'
alias cat='bat'
alias find='fd'
alias grep='rg'

# 实用别名
alias zshconfig="vim ~/.zshrc"
alias ohmyzsh="vim ~/.oh-my-zsh"
alias reload="source ~/.zshrc"
```

------

## 步骤八：最终测试

### 8.1 重新加载所有配置

```bash
source ~/.zshrc
```

### 8.2 测试功能

1. **自动建议**：输入 `git` 然后看是否有灰色建议
2. **语法高亮**：输入正确/错误的命令看颜色变化
3. **Tab补全**：输入 `ls ~/` 按Tab看补全效果
4. **Git状态**：在Git仓库中查看分支显示

------

## 常见问题解决

### 字体问题

如果看到乱码或方块：

```bash
# 重新配置 Powerlevel10k
p10k configure
```

### 插件不工作

检查插件是否正确安装：

```bash
ls ~/.oh-my-zsh/custom/plugins/
```

### 配置重置

如果配置出错，可以重新配置：

```bash
# 重新配置主题
p10k configure

# 或者重新安装 Oh My Zsh
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

