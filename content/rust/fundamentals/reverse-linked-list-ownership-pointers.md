+++
title = "反转局部链表看懂 Rust 的所有权与指针微操"
date = "2026-03-21T10:00:00+08:00"
draft = false
description = ""
slug = "reverse-linked-list-ownership-pointers"
categories = ["rust"]
tags = ["ownership", "linked-list", "pointer"]
image = ""

+++

## 一、引言

* **背景**：刷算法题时，链表反转在带 GC 的语言里通常只是简单的指针重新赋值。但在 Rust 中，这道题（LeetCode 92）变成了一个绝佳的内存管理练习场。
* **核心观点**：Rust 链表的难点不在算法思路，而在工程实现 -- 你需要极度清晰地划定 "谁拥有数据"和"谁只是查看数据"。

### 1.1 完整代码

```rust
// 题目给定的标准 ListNode 定义
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
  pub val: i32,
  pub next: Option<Box<ListNode>>
}

impl ListNode {
  #[inline]
  fn new(val: i32) -> Self {
    ListNode { next: None, val }
  }
}

impl Solution {
    pub fn reverse_between(head: Option<Box<ListNode>>, left: i32, right: i32) -> Option<Box<ListNode>> {
        // 如果不用反转，或者链表为空，直接原样返回
        if left == right || head.is_none() {
            return head;
        }

        // 1. 哑节点 (Dummy Node) 技巧：应对 left = 1 时头节点被换掉的情况
        let mut dummy = Some(Box::new(ListNode { val: 0, next: head }));
        
        // pre 指针：负责走到 left 的前一个节点
        let mut pre = &mut dummy;
        for _ in 1..left {
            // 不断深入，获取可变借用
            pre = &mut pre.as_mut().unwrap().next;
        }

        // 2. 切割：把 pre 后面的所有链表节点全部拿走（夺取所有权）
        // 现在 pre.next 变成了 None。part3 装的是从 left 开始到最后的完整链表
        let mut part3 = pre.as_mut().unwrap().next.take();
        
        // 桌子：用来存放反转后的目标区间
        let mut part2_head = None;

        // 3. 开始发牌：只发 (right - left + 1) 张牌
        for _ in left..=right {
            if let Some(mut node) = part3 {
                // (1) 抽出一张牌后，把手里剩下的牌（node.next）重新放回 part3
                part3 = node.next.take();
                
                // (2) 把抽出来的这张牌，压在桌子（part2_head）的最上面
                node.next = part2_head;
                part2_head = Some(node);
            }
        }
        // 循环结束时：
        // part2_head 是反转好的区间 [right -> ... -> left]
        // part3 是剩下的尾巴 [right+1 -> ... -> end]

        // 4. 缝合第一步：找到 part2_head 的尾巴，把 part3 接上去
        let mut tail = &mut part2_head;
        while tail.is_some() {
            tail = &mut tail.as_mut().unwrap().next;
        }
        *tail = part3; // 尾巴的 next 指向剩下的部分

        // 5. 缝合第二步：把拼接好的中间段，接回最初的 pre 后面
        pre.as_mut().unwrap().next = part2_head;

        // 剥去 dummy node 返回最终的新头节点
        dummy.unwrap().next
    }
}

pub struct Solution;
```



## 二、基础构建：为什么是`Option<Box<ListNode>>`？

* **`Box` 的物理意义**：打破递归类型的“无限大小”问题。`Box` 负责把真实数据安顿在堆上，而在栈上留下一个固定大小的指针。
* **为什么不用`&`组装链表**：借用`&`是拿来“串门”的，不能用来“盖房子”。强行用引用组装动态数据结构，会立刻陷入复杂的生命周期标注中。构建拥有自身数据的数据结构，必须用所有权机制（Box）。

## 三、拆解与重组：`take()` 与 `as_mut()` 的应用场景

* `take()`: **安全的“外科手术”**
  * 在不引发别名冲突（多个`&mut `指向同一个目标）的前提下，如何切断链表？
  * 比喻：`take()` 就像是把抽屉里的物品拿走，顺手在里面放一个“空”牌子（`None`），而不是把抽屉直接砸了。它实现了所有权的平滑转移。
* `as_mut()`：**只开锁，不拿走**
  * 为什么不能对游标直接 `unwrap()`?因为默认的解包动作会转移所有权，相当于把房子拆了。
  * `as_mut()`的作用：把“实心箱子的可变引用（`&mut Option<T>`）”转换为“装有可变引用的透明箱子（`Option<&mut T>`）”。
  * 比喻：这相当于大楼保安拿着钥匙打开了房间门（获得了内部数据的修改权限）

## 四、 游标的本质：`&mut` 的链上漫步

* **锚点与游标分离**：* 为什么找尾巴是必须写`let mut tail = &mut part2_head;` ？
  * 如果不加 `&mut`，等号会直接触发 Move 语义，前半段链表会因为失去所有者而被内存回收。
  * `part2_head`持有所有权，而 tail只是可变借用
* **避坑“不能通过借用转移所有权”**：
  * 解析循环代码`pre = &mut pre.as_mut().unwrap().next;`。
  * 你不能把借来屋子里的物品（`.next` 的所有权）直接抱走。加上最外层的 `&mut`，意味着你只是用手**指着**下一扇门（更新游标的地址指向），符合内存安全规范。

## 五、数据与绑定的解耦：入参的变身

* **解开`mut`的视觉欺骗**：函数入参`head`明明不可变，为什么后续能被随意修改？
* **重塑可变性**：* `let mut dummy = Some(Box::nex(ListNode { next: head }))`的作用
  * 在 Rust 中，只要你拥有数据的**绝对所有权**，就可以用 `let mut` 重新绑定它。
  * 比喻：这相当于把原本放在“不可变保险箱”里的物品拿出来，重新放进了一个敞口的“可变工具箱”里。从这一刻起，内部的数据就允许被修改了
