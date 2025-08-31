+++
date = '2025-08-27T09:07:07+08:00'
draft = false
title = 'Walk整体架构'
categories = ['rust', 'ripgrep']

+++

### Walk整体架构设计详解

让我们从最核心的设计理念开始，系统地解释walk的整体工作机制。

##### 1. 核心架构：三层设计模式

```rust
// 第一层：构建器 - 配置收集
WalkBuilder::new("/path/to/search")
    .max_depth(Some(5))
    .follow_links(true)
    .threads(4)
    
// 第二层：执行器 - 两种模式
    .build()          // → Walk (单线程迭代器)
    .build_parallel() // → WalkParallel (并行执行器)
    
// 第三层：数据抽象 - 统一表示
    // → Iterator<Item = Result<DirEntry, Error>>
```

##### 2. 事件驱动的遍历模型

Walk的核心创新是把目录遍历抽象为**事件流**：

```rust
enum WalkEvent {
  Dir(walkdir::DirEntry),			//	进入目录
  File(walkdir::DirEntry),		//	发现文件
  Exit												//	退出目录
}
```

**工作流程**

```rust
/root/
├── file1.txt          → WalkEvent::File(file1.txt)
├── dir1/              → WalkEvent::Dir(dir1)
│   ├── file2.txt      → WalkEvent::File(file2.txt)
│   └── subdir/        → WalkEvent::Dir(subdir)
│       └── file3.txt  → WalkEvent::File(file3.txt)
│                      → WalkEvent::Exit (subdir)
│                      → WalkEvent::Exit (dir1)
└── file4.txt          → WalkEvent::File(file4.txt)
```

##### 3. Walk vs WalkParallel的设计差异

**Walk** - 标准迭代器模式

```rust
impl Iterator for Walk {
    fn next(&mut self) -> Option<Result<DirEntry, Error>> {
        loop {
            // 1. 从 WalkEventIter 获取下一个事件
            let ev = self.it.as_mut().and_then(|it| it.next());
            
            match ev {
                Ok(WalkEvent::Dir(ent)) => {
                    // 2. 检查是否应该跳过
                    if self.skip_entry(&ent)? {
                        self.it.skip_current_dir();  // 剪枝
                        continue;
                    }
                    // 3. 更新 ignore 规则上下文
                    let (ig_new, err) = self.ig.add_child(ent.path());
                    self.ig = ig_new;
                    return Some(Ok(ent));
                }
                Ok(WalkEvent::File(ent)) => {
                    if !self.skip_entry(&ent)? {
                        return Some(Ok(ent));
                    }
                }
                Ok(WalkEvent::Exit) => {
                    // 4. 恢复父目录的 ignore 上下文
                    self.ig = self.ig.parent().unwrap();
                }
            }
        }
    }
}
```

**WalkParallel** - 工作窃取模式

```rust
impl WalkParallel {
    pub fn run<F>(self, mkf: F) where F: FnMut() -> Box<dyn FnMut(Result<DirEntry, Error>) -> WalkState + Send> {
        // 1. 创建工作窃取队列
        let stacks = Stack::new_for_each_thread(threads, stack);
        
        // 2. 启动多个工作线程
        std::thread::scope(|s| {
            let handles: Vec<_> = stacks.into_iter().map(|stack| {
                Worker {
                    visitor: mkf(),           // 用户回调
                    stack,                    // 工作队列
                    quit_now,                 // 全局退出标志
                    active_workers,           // 活跃工作者计数
                    // ... 其他配置
                }
            }).map(|worker| s.spawn(move || worker.run())).collect();
            
            // 3. 等待所有线程完成
            for handle in handles { handle.join().unwrap(); }
        });
    }
}
```

##### 4. 关键设计模式

**状态管理**：Ignore规则的层次化

```rust
struct Walk {
    ig_root: Ignore,     // 根目录规则
    ig: Ignore,          // 当前目录规则 (随遍历动态变化)
    // ...
}

// 进入子目录时
let (ig_new, err) = self.ig.add_child(child_path);
self.ig = ig_new;  // 继承父目录规则 + 子目录规则

// 退出目录时  
self.ig = self.ig.parent().unwrap();  // 恢复父目录规则
```

**早期过滤优化**

```rust
fn skip_entry(&self, ent: &DirEntry) -> Result<bool, Error> {
    // 优先级顺序 (从快到慢)：
    if ent.depth() == 0 { return Ok(false); }           // 1. 根目录检查
    if should_skip_entry(&self.ig, ent) { return Ok(true); }  // 2. ignore 规则
    if path_equals(ent, stdout) { return Ok(true); }    // 3. stdout 检查  
    if skip_filesize(...) { return Ok(true); }          // 4. 文件大小检查
    if !filter(ent) { return Ok(true); }                // 5. 自定义过滤器
    Ok(false)
}
```

**工作窃取队列的智能终止**

```rust
fn get_work(&mut self) -> Option<Work> {
    loop {
        match self.recv() {
            Some(Message::Work(work)) => return Some(work),
            Some(Message::Quit) => return None,
            None => {
                // 关键：原子性检查所有工作者是否都空闲
                if self.deactivate_worker() == 0 {
                    // 所有工作者都空闲 = 没有更多工作
                    self.send_quit();  // 广播退出信号
                    return None;
                }
                // 等待新工作或从其他队列窃取
                self.wait_for_work();
            }
        }
    }
}
```

##### 5. 整体工作流程总结

```rust
用户调用
    ↓
WalkBuilder 收集配置
    ↓
选择执行模式：
    ├── Walk: 单线程迭代器
    │   └── 基于 WalkDir + 事件转换 + ignore 过滤
    └── WalkParallel: 并行执行器  
        └── 工作窃取队列 + 多线程协作 + 智能终止
    ↓
产生 DirEntry 流
    ↓
用户处理结果
```

**核心优势**

* 统一抽象：无论单线程还是并行，用户看到的都是`DirEntry`流
* 智能过滤：多层次、早期过滤，避免不必要的文件系统操作
* 动态适应： ignore规则跟随目录层次动态调整
* 高效并行： 工作窃取 + 智能终止，最大化CPU利用率

#### WalkBuilder构建模式详解

##### 核心结构设计

```rust
pub struct WalkBuilder {
    paths: Vec<PathBuf>,              // 多路径支持
    ig_builder: IgnoreBuilder,        // ignore 规则构建器
    max_depth: Option<usize>,         // 递归深度限制
    max_filesize: Option<u64>,        // 文件大小限制
    follow_links: bool,               // 符号链接跟随
    same_file_system: bool,           // 文件系统边界
    sorter: Option<Sorter>,           // 排序策略
    threads: usize,                   // 线程数配置
    skip: Option<Arc<Handle>>,        // stdout 跳过
    filter: Option<Filter>,           // 自定义过滤器
}
```

##### 流畅接口模式的优雅实现

```rust
// 典型的链式调用模式
let walker = WalkBuilder::new("/path/to/search")
    .max_depth(Some(3))
    .follow_links(true)
    .threads(4)
    .standard_filters(true)
    .hidden(false)
    .git_ignore(true)
    .build_parallel();
```

##### 关键设计模式

###### 1. 委托模式

```rust
impl WalkBuilder {
    // WalkBuilder 将 ignore 相关配置委托给 IgnoreBuilder
  	// WalkDir是基础的文件系统Builder
    pub fn hidden(&mut self, yes: bool) -> &mut WalkBuilder {
        self.ig_builder.hidden(yes);  // 委托给内部构建器
        self
    }
    
    pub fn git_ignore(&mut self, yes: bool) -> &mut WalkBuilder {
        self.ig_builder.git_ignore(yes);
        self
    }
}
```

###### 2. 分组配置模式

```rust
pub fn standard_filters(&mut self, yes: bool) -> &mut WalkBuilder {
    // 一次性配置多个相关选项
    self.hidden(yes)
        .parents(yes)
        .ignore(yes)
        .git_ignore(yes)
        .git_global(yes)
        .git_exclude(yes)
}
```

###### 3.  策略模式的排序设计

```rust
enum Sorter {
    ByName(Arc<dyn Fn(&OsStr, &OsStr) -> Ordering + Send + Sync + 'static>),
    ByPath(Arc<dyn Fn(&Path, &Path) -> Ordering + Send + Sync + 'static>),
}

impl WalkBuilder {
    pub fn sort_by_file_name<F>(&mut self, cmp: F) -> &mut WalkBuilder
    where F: Fn(&OsStr, &OsStr) -> Ordering + Send + Sync + 'static
    {
        self.sorter = Some(Sorter::ByName(Arc::new(cmp)));
        self
    }
}
```

##### 构建过程的两个关键转换

###### build() - 单线程迭代器构建

```rust
pub fn build(&self) -> Walk {
    // 1. 为每个路径创建 WalkDir 迭代器
    let its = self.paths.iter().map(|p| {
        let mut wd = WalkDir::new(p);
        wd = wd.follow_links(self.follow_links || p.is_file());
        wd = wd.same_file_system(self.same_file_system);
        
        // 2. 应用排序策略
        if let Some(ref sorter) = self.sorter {
            match sorter {
                Sorter::ByName(cmp) => wd = wd.sort_by(move |a, b| cmp(a.file_name(), b.file_name())),
                Sorter::ByPath(cmp) => wd = wd.sort_by(move |a, b| cmp(a.path(), b.path())),
            }
        }
        
        (p.to_path_buf(), Some(WalkEventIter::from(wd)))
    }).collect();
    
    // 3. 构建 ignore 规则根节点
    let ig_root = self.ig_builder.build();
    
    Walk { its, ig_root, /* ... */ }
}
```

###### build_parallel() - 并行执行器构建

```rust
pub fn build_parallel(&self) -> WalkParallel {
    WalkParallel {
        paths: self.paths.clone().into_iter(),
        ig_root: self.ig_builder.build(),  // 共享 ignore 规则
        max_depth: self.max_depth,
        threads: self.threads,
        // 直接传递配置，无需转换为迭代器
    }
}
```

#### WalkBuilder 构建模式的智能配置管理

###### 智能默认值处理

```rust
impl WalkParallel {
    fn threads(&self) -> usize {
        if self.threads == 0 {
            2  // 智能默认值：最少2个线程
        } else {
            self.threads
        }
    }
}
```

###### 配置验证和优化

```rust
pub fn visit(mut self, builder: &mut dyn ParallelVisitorBuilder<'_>) {
    let threads = self.threads();
    let mut stack = vec![];
    
    // 1. 预处理根路径，区分文件和目录
    for path in paths {
        let (dent, root_device) = if path == Path::new("-") {
            (DirEntry::new_stdin(), None)  // 特殊处理 stdin
        } else {
            // 设备号检查（same_file_system 支持）
            let root_device = if !self.same_file_system {
                None
            } else {
                match device_num(&path) {
                    Ok(root_device) => Some(root_device),
                    Err(err) => {
                        // 错误处理：单个路径失败不影响其他路径
                        if visitor.visit(Err(err)).is_quit() { return; }
                        continue;
                    }
                }
            };
            // 创建初始 DirEntry
            match DirEntryRaw::from_path(0, path, false) {
                Ok(dent) => (DirEntry::new_raw(dent, None), root_device),
                Err(err) => {
                    if visitor.visit(Err(err)).is_quit() { return; }
                    continue;
                }
            }
        };
        
        // 2. 生成初始工作项
        stack.push(Message::Work(Work {
            dent,
            ignore: self.ig_root.clone(),  // 共享根 ignore 规则
            root_device,
        }));
    }
    
    // 3. 早期退出优化
    if stack.is_empty() { return; }
    
    // 4. 启动工作线程
    let stacks = Stack::new_for_each_thread(threads, stack);
    // ...
}
```

#### 关键设计模式总结

##### 1. 分层委托模式

```rust
WalkBuilder (外层配置)
    ↓ 委托
IgnoreBuilder (ignore 规则配置)
    ↓ 构建
Ignore (运行时规则匹配器)
```

##### 2. 配置收集与延迟构建

* 收集阶段： WalkBuilder收集所有配置选项
* 验证阶段：build()时进行配置验证和转换
* 执行阶段：Walk/WalkParallel使用最终配置执行遍历

##### 3. 多态执行策略

```rust
impl WalkBuilder {
    pub fn build(&self) -> Walk { /* 单线程策略 */ }
    pub fn build_parallel(&self) -> WalkParallel { /* 并行策略 */ }
}
```

##### 4. 错误恢复与部分成功

* 单个路径失败不影响其他路径的处理
* ignore文件解析错误不阻止遍历继续
* 提供详细的错误信息但保持系统健壮性

#### Walk的文件发现与遍历

`Walk`实现了`Iterator`trait，其核心是`next()`方法，负责文件发现和遍历。`Walk`包装了`WalkEventIter`，而`WalkEventIter`包装了`WalkDir`。`WalkDir`提供基础的文件系统遍历功能，文件系统的树形结构转化为了线形的Iter；`WalkEventDir`则是将`WalkDir`转换为`WalkEvent`流；`Walk`负责添加ignore规则和过滤逻辑。

##### 1. 核心数据结构

```rust
pub struct Walk {
  its: std::vec::IntoIter<(PathBuf, Option<WalkEventIter>)>,	//初始路径迭代器
  it: Option<WalkEventIter>,															//当前目录迭代器
  ig_root: Ignore,																				//根目录的忽略规则
  ig: Ignore,																							//当前目录的忽略规则
  //...其他字段
}
```

##### 2.初始化阶段

* 如果当前迭代器it为None，从its获取下一个路径
* 如果its也耗尽，返回None表示遍历结束

##### 3.主循环结构

```rust
fn next(&mut self) -> Option<Result<DirEntry, Error>> {
  loop {
    // 1. 获取下一个事件
    // 2. 处理事件
    // 3. 返回符合条件的文件/目录
  }
}
```

##### 4. 事件获取逻辑

```rust
let ev = match self.it.as_mut().and_then(|it| it.next()) {
    Some(ev) => ev,  // 有事件则处理
    None => {        // 当前迭代器耗尽
        match self.its.next() {  // 获取下一个路径
            None => return None, // 所有路径处理完成
            Some((_, None)) => return Some(Ok(DirEntry::new_stdin())), // 标准输入
            Some((path, Some(it))) => {  // 新路径
                self.it = Some(it);
                if path.is_dir() {
                    // 更新忽略规则
                    let (ig, err) = self.ig_root.add_parents(path);
                    self.ig = ig;
                    if let Some(err) = err {
                        return Some(Err(err));
                    }
                } else {
                    self.ig = self.ig_root.clone(); // 重置为根规则
                }
                continue;  // 继续处理新路径
            }
        }
    }
};
```

##### 5.事件处理

```rust
match ev {
    // 处理错误
    Err(err) => return Some(Err(Error::from_walkdir(err))),
    
    // 退出目录
    Ok(WalkEvent::Exit) => {
        self.ig = self.ig.parent().unwrap(); // 恢复父目录的忽略规则
    }
    
    // 处理目录
    Ok(WalkEvent::Dir(ent)) => {
        let de = DirEntry::new_entry(ent, self.ig.clone());
        if !de.is_dir().unwrap_or(false) {  // 可能是符号链接
            return Some(Ok(de));
        }
        if let Some(err) = de.into_error() {  // 检查错误
            return Some(Err(err));
        }
        // 应用忽略规则
        match self.ig.add_child(&de.path) {
            Ok(Some((child_ig, err_opt))) => {
                self.ig = child_ig;  // 更新为子目录的忽略规则
                if let Some(err) = err_opt {
                    return Some(Err(err));
                }
            }
            Ok(None) => {}  // 无变化
            Err(err) => return Some(Err(err)),
        }
    }
    
    // 处理文件
    Ok(WalkEvent::File(ent)) => {
        let de = DirEntry::new_entry(ent, self.ig.clone());
        if self.skip_entry(&de).unwrap_or(false) {
            continue;  // 跳过该文件
        }
        return Some(Ok(de));  // 返回文件
    }
}
```

#### WalkEventIter的事件生成

##### 1. 核心结构

```rust
struct WalkEventIter {
  depth: usize,
  it: walkdir::IntoIter,
  next: Option<Result<walkdir::DirEntry, walkdir::Error>>
}
```

##### 2. 初始阶段

```rust
WalkEventIter {depth: 0, it: it.IntoIter, next: None }
```

##### 3. 事件生成

从`it`获取`DirEntry`，`depth`表示当前文件遍历深度。

1. Exit事件生成：当检测到深度减少时（dent_depth < self.depth），表示正在从子目录返回
2. **next字段**：仅在生成Exit事件时**保存当前条目**，确保下次处理时能正确处理，
   * 因为退出目录时，我们生成了Exit事件，**当前条目被延迟处理了**，所以要临时保存
3. depth管理：
   - 进入子目录时 `self.depth += 1`
   - 退出子目录时 `self.depth -= 1`
   - 遇到新条目时更新 `self.depth = dent.depth()`

### WalkParallel

##### 1.核心构成

```rust
pub struct WalkParallel {
    paths: std::vec::IntoIter<PathBuf>,  // 要遍历的路径
    ig_root: Ignore,                    // 根目录的忽略规则
    max_filesize: Option<u64>,          // 文件大小限制
    max_depth: Option<usize>,           // 最大深度
    follow_links: bool,                 // 是否跟踪符号链接
    same_file_system: bool,             // 是否限制在同一个文件系统
    threads: usize,                     // 线程数
    skip: Option<Arc<Handle>>,          // 跳过规则
    filter: Option<Filter>,             // 自定义过滤器
}

struct Worker<'s> {
    visitor: Box<dyn ParallelVisitor>,  // 处理文件/目录的回调
    stack: Stack,                      // 任务栈
    quit_now: Arc<AtomicBool>,         // 提前终止标志
    active_workers: Arc<AtomicUsize>,  // 活跃工作线程计数
    // ... 其他状态
}
```

##### 2. 构建初始化

```rust
// 1. 创建并行遍历器
let walker = WalkBuilder::new("/path")
    .threads(4)  // 设置线程数
    .build_parallel();

// 2. 运行遍历
walker.run(|| {
    // 每个线程的初始化代码
    Box::new(|result| {
        // 处理每个文件/目录
        match result {
            Ok(entry) => println!("Found: {}", entry.path().display()),
            Err(err) => eprintln!("Error: {}", err),
        }
        WalkState::Continue  // 控制遍历流程
    })
});
```

##### 3. 关键组件

* **ParallelVisitor**：定义如何处理遍历结果

```rust
pub trait ParallelVisitor: Send {
    fn visit(&mut self, entry: Result<DirEntry, Error>) -> WalkState;
}
```

* **Work**任务单元：

```rust
struct Work {
  dent: DirEntry, 	//目录项
  ignore: Ignore,		//忽略规则
  root_device: u64,	//设备号（用于跨文件系统检查）
}
```

##### 4. 执行流程

1. 创建工作线程池
2. 将初始路径加入工作队列
3. 每个工作线程：
   * 从队列获取任务
   * 处理目录项
   * 发现子目录生成新任务
   * 处理ignore规则

#### 流程详解

##### 1. 初始化阶段

```rust
let walker = WalkBuilder::new("/path")
    .threads(4)  // 4个工作线程
    .build_parallel();

walker.run(|| {
    // 每个线程初始化时执行
    Box::new(|result| {
        // 处理每个文件/目录
        println!("{:?}", result?);
        WalkState::Continue
    })
});
```

##### 2. 核心方法

###### 2.1 `visit`方法

```rust
pub fn visit(mut self, builder: &mut dyn ParallelVisitorBuilder<'_>) {
    // 1. 初始化工作队列
    let threads = self.threads();
    let mut stack = vec![];
    
    // 2. 处理初始路径
    {
        let mut visitor = builder.build();
        // ... 处理初始路径并填充 stack ...
    }
    
    // 3. 创建工作线程
    let quit_now = Arc::new(AtomicBool::new(false));
    let active_workers = Arc::new(AtomicUsize::new(threads));
    let stacks = Stack::new_for_each_thread(threads, stack);
    
    // 4. 启动工作线程
    std::thread::scope(|s| {
        let handles: Vec<_> = stacks
            .into_iter()
            .map(|stack| Worker { /* ... */ })
            .map(|worker| s.spawn(|| worker.run()))
            .collect();
            
        // 5. 等待所有工作线程完成
        for handle in handles {
            handle.join().unwrap();
        }
    });
}
```

###### 2.2 `Worker::run`方法

```rust
fn run(mut self) {
  while let Some(work) = self.get_work() {	//获取工作项
    if let WalkState::Quit = self.run_one(work) {		//处理工作项
      self.quit_now()
    }
  }
}
```

###### 2.3 `Worker::run_one`方法

```rust
fn run_one(&mut self, work: Work) -> WalkState {
    // 如果是文件或符号链接，直接处理
    if work.is_symlink() || !work.is_dir() {
        return self.visitor.visit(Ok(work.dent));
    }
    
    // 读取目录内容
    let readdir = match work.read_dir() {
        Ok(readdir) => readdir,
        Err(err) => return self.visitor.visit(Err(err)),
    };
    
    // 处理目录中的每个条目
    for result in readdir {
        let state = self.generate_work(/* ... */);
        if state.is_quit() {
            return state;
        }
    }
    WalkState::Continue
}
```

###### 2.4 `Worker::get_work`方法

```rust
fn get_work(&mut self) -> Option<Work> {
    // 1. 先尝试从自己的队列获取工作
    if let Some(work) = self.stack.pop() {
        return Some(work);
    }
    
    // 2. 尝试从其他线程窃取工作
    if let Some(work) = self.stack.steal() {
        return Some(work);
    }
    
    // 3. 如果都失败，等待工作或退出
    self.stack.recv()
}
```

##### 3. 工作流程

###### 1. 初始化阶段

* 创建指定数量的工作线程
* 将初始工作项分配到工作队列

###### 2. 工作阶段

* 每个工作线程从自己的队列获取工作
* 处理文件或遍历目录
* 将新发现的工作放入队列

###### 3. 工作窃取

* 当线程自己的队列为空时，尝试从其他线程窃取工作
* 使用原子操作保证线程安全

###### 4. 终止条件

* 所有工作队列为空时
* 所有工作线程都处于空闲状态
* 收到退出信号

##### 4. 关键设计点

1. 工作窃取：使用工作窃取算法实现负载均衡
2. 无锁设计：使用`channel`进行线程间通信
3. 优雅退出：使用原子布尔值控制工作线程退出
4. 资源管理：使用`RAII`确保资源正确释放

#### 总结

* 文件发现获得文件的绝对路径，之后使用绝对路径便可读取文件内容

* 多线程模式使用广度优先遍历，单线程使用了深度优先遍历
* Worker是任务调度，Work是任务定义，Visitor是任务处理

### Ignore的结构

结构体`Ignore`负责管理忽略规则。

```rust
/// Ignore is a matcher useful for recursively walking one or more directories.
#[derive(Clone, Debug)]
pub(crate) struct Ignore(Arc<IgnoreInner>);

#[derive(Clone, Debug)]
struct IgnoreInner {
    /// A map of all existing directories that have already been
    /// compiled into matchers.
    ///
    /// Note that this is never used during matching, only when adding new
    /// parent directory matchers. This avoids needing to rebuild glob sets for
    /// parent directories if many paths are being searched.
    compiled: Arc<RwLock<HashMap<OsString, Weak<IgnoreInner>>>>,
    /// The path to the directory that this matcher was built from.
    dir: PathBuf,
    /// An override matcher (default is empty).
    overrides: Arc<Override>,
    /// A file type matcher.
    types: Arc<Types>,
    /// The parent directory to match next.
    parent: Ignore,
    /// Whether this matcher should be compiled case insensitively.
    case_insensitive: bool,
    /// Whether to match hidden files.
    hidden: bool,
    /// Whether to read .ignore files.
    ignore: bool,
    /// Whether to respect any ignore files in parent directories.
    parents: bool,
    /// Whether to read git's global gitignore file.
    git_global: bool,
    /// Whether to read .gitignore files.
    git_ignore: bool,
    /// Whether to read .git/info/exclude files.
    git_exclude: bool,
    /// Whether to ignore files case insensitively
    ignore_case_insensitive: bool,
    /// Whether a git repository must be present in order to apply any
    /// git-related ignore rules.
    require_git: bool,
}
```

##### 关键组件解析

1. Ignore结构体
   * 使用`Arc`进行引用计数，允许多线程共享
   * 实际实现在`IgnoreInner`中
2. `IgnoreInner`字段
   * `compiled`：缓存已编译的目录匹配器，避免重复构建
   * `dir`:当前匹配器对应的目录路径
   * `overrides`：覆盖规则，优先级最高
   * `types`：文件类型匹配器
   * `parent`: 父目录的匹配器，形成链式结构
   * 各种标志位：控制忽略规则的行为(如是否忽略隐藏文件、是否读取.gitignore等)
3. 忽略规则的优先级
   * 从高到低
     1. 显式覆盖规则(`overrides`)
     2. 当前目录的.gitignore
     3. 父目录的.gitignore
     4. 全局gitignore
