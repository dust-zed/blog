+++
date = '2025-09-02T21:41:39+08:00'
draft = false
title = 'Android事件分发机制详解'
categories = ['android-develop']

+++

#### 1. 事件分发的基本流程

##### 1.1 事件传递顺序

事件从Activity开始，按照一下顺序传递：

```rust
Activity -> Window -> DecorView -> ViewGroup -> View
```

##### 1.2 核心方法

1. **dispatchTouchEvent**
   * 负责事件的分发
   * 返回true表示事件被消费，false表示未消费
2. **onInterceptTouchEvent**
   * 只有ViewGroup才有的方法
   * 用于拦截事件，返回true表示拦截事件
3. **onTouchEvent**
   * 处理点击事件
   * 返回true表示事件被消费

#### 2. 源码分析

##### 2.1 Activity的dispatchTouchEvent

```java
public boolean dispatchTouchEvent(MotionEvent ev) {
    if (ev.getAction() == MotionEvent.ACTION_DOWN) {
        onUserInteraction(); // 空方法，可以重写
    }
    if (getWindow().superDispatchTouchEvent(ev)) {
        return true; // 事件被消费
    }
    return onTouchEvent(ev); // 如果所有View都没有处理，则调用Activity的onTouchEvent
}
```

##### 2.2 ViewGroup的dispatchTouchEvent

```java
public boolean dispatchTouchEvent(MotionEvent ev) {
    // 1. 检查是否拦截
    final boolean intercepted;
    if (actionMasked == MotionEvent.ACTION_DOWN || mFirstTouchTarget != null) {
        final boolean disallowIntercept = (mGroupFlags & FLAG_DISALLOW_INTERCEPT) != 0;
        if (!disallowIntercept) {
            intercepted = onInterceptTouchEvent(ev);
            ev.setAction(action); // 恢复action，防止被修改
        } else {
            intercepted = false;
        }
    } else {
        // 没有目标处理该事件，也不拦截
        intercepted = true;
    }
    
    // 2. 如果不拦截，则寻找可以处理事件的子View
    if (!canceled && !intercepted) {
        // 遍历子View，寻找可以处理事件的View
        for (int i = childrenCount - 1; i >= 0; i--) {
            final View child = children[i];
            if (child.dispatchTouchEvent(ev)) {
                // 找到可以处理事件的子View
                mFirstTouchTarget = addTouchTarget(child, idBitsToAssign);
                break;
            }
        }
    }
    
    // 3. 分发事件
    if (mFirstTouchTarget == null) {
        // 没有子View处理事件，调用父类的dispatchTouchEvent
        handled = super.dispatchTouchEvent(ev);
    } else {
        // 将事件分发给目标View
        TouchTarget target = mFirstTouchTarget;
        while (target != null) {
            final View child = target.child;
            if (child.dispatchTouchEvent(ev)) {
                handled = true;
            }
            target = target.next;
        }
    }
    return handled;
}
```

###### 实际执行流程

1. **DOWN事件**:
   - `mFirstTouchTarget == null`，进入寻找目标View的循环
   - 调用`child.dispatchTouchEvent(ev)`（第一次）
   - 如果某个子View返回true，设置`mFirstTouchTarget`
2. **MOVE/UP事件**:
   - `mFirstTouchTarget != null`，直接进入分发流程
   - 调用`target.child.dispatchTouchEvent(ev)`（第二次）
   - 不会再次进入寻找目标View的循环
3. **TouchTarget**
   * TouchTarget是链表结构主要目的是为了支持多点触控
   * 从 `mFirstTouchTarget` 开始遍历链表
   * 检查每个 `TouchTarget` 的 `pointerIdBits` 是否与当前事件的 `desiredPointerIdBits` 匹配
   * 如果找到匹配的 `TouchTarget`，则将事件分发给对应的子View
   * 如果没有找到匹配的 `TouchTarget`，则返回false

###### 为什么这样设计

1. **性能优化**：避免每次事件都遍历所有子View
2. **事件一致性**：确保同一事件序列由同一View处理
3. **正确性**：防止事件序列被拆分到不同View处理

##### 2.3 View的dispatchTouchEvent

```java
public boolean dispatchTouchEvent(MotionEvent event) {
    // 1. 首先检查OnTouchListener
    ListenerInfo li = mListenerInfo;
    if (li != null && li.mOnTouchListener != null 
            && (mViewFlags & ENABLED_MASK) == ENABLED 
            && li.mOnTouchListener.onTouch(this, event)) {
        return true;
    }
    
    // 2. 然后调用onTouchEvent
    if (onTouchEvent(event)) {
        return true;
    }
    
    return false;
}
```

#### 3. 事件分发的关键点

1. **事件序列**：从ACTION_DOWN开始，到ACTION_UP或ACTION_CANCEL结束的一些列事件
2. **事件拦截**：ViewGroup可以通过onIterceptTouchEvent拦截事件
3. **事件消费**：View可以通过onTouchEvent或OnTouchListener消费事件
4. **事件传递**：默认情况下，事件会从上到下传递，直到被消费

#### 4. 常见面试题

##### 4.1 事件分发的流程是怎样的

* 从Activity的dispatchTouchEvent开始
* 经过Window、DecorView、ViewGroup
* 最终到达具体的View
* 如果没有任何View消费事件，事件会回传到Activity的onTouchEvent

##### 4.2 onTouch和onTouchEvent的区别

* onTouch是View.OnTouchListener接口中的方法
* onTouchEvent是View的方法
* onTouch的优先级高于onTouchEvent
* 如果onTouch返回true，则onTouch不会被调用

##### 4.3 如何解决滑动冲突

1. 外部拦截法：重写父容器的onInterceptTouchEvent方法
2. 内部拦截法： 重写子元素的dispatchTouchEvent方法，结合requestDisallowInterceptTouchEvent方法

#### 5. 实际应用示例

```java
// 自定义ViewGroup，处理左右滑动冲突
public class CustomViewPager extends ViewGroup {
    private float mLastX;
    private float mLastY;
    
    @Override
    public boolean onInterceptTouchEvent(MotionEvent ev) {
        boolean intercepted = false;
        float x = ev.getX();
        float y = ev.getY();
        
        switch (ev.getAction()) {
            case MotionEvent.ACTION_DOWN:
                mLastX = x;
                mLastY = y;
                intercepted = false;
                break;
            case MotionEvent.ACTION_MOVE:
                float deltaX = Math.abs(x - mLastX);
                float deltaY = Math.abs(y - mLastY);
                // 横向滑动距离大于纵向滑动距离时拦截事件
                if (deltaX > deltaY) {
                    intercepted = true;
                } else {
                    intercepted = false;
                }
                break;
            case MotionEvent.ACTION_UP:
                intercepted = false;
                break;
        }
        
        mLastX = x;
        mLastY = y;
        return intercepted;
    }
}
```

