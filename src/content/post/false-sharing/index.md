---
title: "JAVA 中的 FALSE SHARING"
description: "false sharing 与 volatile "
publishDate: "6 May 2020"
tags: ["写作", "java", "并发"]
---

# 从 JAVA 中的 FALSE SHARING 讲起

图片为上个月去太湖源拍的

## 引子

这两天正好在看并发,  在案例分析中,  提到一个 [Disruptor  的例子]( https://time.geekbang.org/column/article/98134 ), 讲到了这款有界内存队列高性能的原因之一 ------ 避免 false sharing

关于这个 false sharing 的翻译, 有些人说是虚共享, 有些人说是伪共享, 咱也不管, 直接 false sharing

本文主要从代码的现象出发开始分析, 为什么会出现这样的现象

1. 现象
2. 原因

## False Sharing 定义

**假设两个线程分别访问同一对象中不同的 volatile 字段，逻辑上它们并没有共享内容，因此不需要同步。**

**然而，如果这两个字段恰好在同一个缓存行 cache line 中，那么对这些字段的写操作会导致缓存行的写回，也就造成了实质上的共享。**

其实, 如果是不同对象也是一样的, 不过同一个对象, 由于内存连续, 出现冲突的可能性也就越大(在同一个缓存行中的可能性越大)

## 现象

基于上面的描述, 我构造了几个对象, 来对 false sharing 进行测试

源代码: [ FalseShareTest ](https://github.com/giraffe-tree/boom-java/tree/master/src/main/java/me/giraffetree/java/boomjava/concurrent/problem/falseShare )

### 这里我新建了 3 个类

1. 对照组, 仅仅两个 `volatile` 变量
2. Contented组, 使用 `@Contented` 避免了 false sharing
3. 手动填充组, 使用手动的 padding 填充, 来避免 false sharing


```java
	/**
	 * 对照组
	 */
	private static class Foo {
        volatile int a;
        volatile int b;
    }
	/**
	 * contended 组
	 */ 
    private static class FooWithContented {
        @Contended
        volatile int a;
        @Contended
        volatile int b;
    }
    /**
     * 手动填充组
     * 使用压缩指针, 注意字段重排列
     * 12B obj header + 4B  + 8*8B +4B+ (4B对齐)
     * 关于 java 中字段如何重排列, 请查看下面的参考文档
     * 其实如果更加严谨点, 在 字段 b 后面也应该加上 8 个 long 字段, 将两个缓存行完全占满
     */
    private static class FooWithPadding {
        volatile int a;
        volatile int b;
        // 你以为 p11 - p18 是放在 b 后面的, 所以 padding 实际上没有效果, false sharing 依然存在
        // 实际上 p11 - p18 是放在 a 后面的, 所以这里的 padding 有效(至少在我的电脑上有效), false sharing 被解决
        long p11;
        long p12;
        long p13;
        long p14;
        long p15;
        long p16;
        long p17;
        long p18;
    }
```

### 测试对 volatile 变量  写操作

```java
    
	// count 为写操作次数, retry 是为了多次去平均时间
	private static void testNormalVolatile(final int count, final int retry) {
        long all = 0L;
        int r = retry;
        long[] record = new long[retry];
        while (r-- > 0) {
            Foo foo = new Foo();
            CountDownLatch endLatch = new CountDownLatch(2);
            long l1 = System.currentTimeMillis();
            EXECUTOR_SERVICE.execute(() -> {
                int loop = count;
                while (loop-- > 0) {
                    foo.a = loop;
                }
                endLatch.countDown();
            });
            EXECUTOR_SERVICE.execute(() -> {
                int loop = count;
                while (loop-- > 0) {
                    foo.b = loop;
                }
                endLatch.countDown();
            });

            try {
                endLatch.await();
                long l2 = System.currentTimeMillis();
                all += (l2 - l1);
                record[retry - 1 - r] = l2 - l1;
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        System.out.println(String.format("normal volatile average:%dms %s", all / retry, Arrays.toString(record)));
    }

    private static void testContentedVolatile(final int count, int retry) {
        long all = 0L;
        int r = retry;
        long[] record = new long[retry];
        while (r-- > 0) {

            FooWithContented fooWithContented = new FooWithContented();
            CountDownLatch endLatch = new CountDownLatch(2);

            long l1 = System.currentTimeMillis();
            EXECUTOR_SERVICE.execute(() -> {
                int loop = count;

                while (loop-- > 0) {
                    fooWithContented.a = loop;
                }
                endLatch.countDown();
            });
            EXECUTOR_SERVICE.execute(() -> {
                int loop = count;
                while (loop-- > 0) {
                    fooWithContented.b = loop;
                }
                endLatch.countDown();
            });

            try {
                endLatch.await();
                long l2 = System.currentTimeMillis();
                all += (l2 - l1);
                record[retry - 1 - r] = l2 - l1;
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        System.out.println(String.format("contended volatile average:%dms %s", all / retry, Arrays.toString(record)));
    }

    private static void testPaddingVolatile(final int count, int retry) {
        long all = 0L;
        int r = retry;
        long[] record = new long[retry];
        while (r-- > 0) {

            FooWithPadding fooWithPadding = new FooWithPadding();
            CountDownLatch endLatch = new CountDownLatch(2);

            long l1 = System.currentTimeMillis();
            EXECUTOR_SERVICE.execute(() -> {

                int loop = count;
                while (loop-- > 0) {
                    fooWithPadding.a = loop;
                }
                endLatch.countDown();
            });
            EXECUTOR_SERVICE.execute(() -> {
                int loop = count;
                while (loop-- > 0) {
                    fooWithPadding.b = loop;
                }
                endLatch.countDown();
            });

            try {
                endLatch.await();
                long l2 = System.currentTimeMillis();
                all += (l2 - l1);
                record[retry - 1 - r] = l2 - l1;
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        System.out.println(String.format("padding volatile average:%dms %s", all / retry, Arrays.toString(record)));
    }

```

### 测试结果

执行时请加上 `-XX:-RestrictContended` (java 8上)

参数: 

```java
int count = 10_000_000;
int retry = 10;
```


#### 本地 i3 8100

```
normal volatile average:169ms [112, 43, 223, 214, 117, 258, 209, 226, 72, 224]
contended volatile average:61ms [14, 13, 72, 73, 73, 75, 73, 73, 71, 74]
padding volatile average:65ms [17, 14, 78, 73, 73, 83, 86, 78, 76, 72]
```

#### 本地 linux Intel(R) Xeon(R) CPU E5-2403 v2 @ 1.80GHz

```
normal volatile average:449ms [328, 172, 638, 558, 447, 462, 494, 508, 476, 416]
contended volatile average:138ms [35, 25, 177, 187, 186, 186, 187, 156, 124, 124]
padding volatile average:121ms [31, 29, 123, 124, 124, 124, 124, 181, 187, 171]
```

####  阿里云 c5 主机 2核 Intel(R) Xeon(R) Platinum 8269CY CPU @ 2.50GHz

```
normal volatile average:133ms [112, 34, 148, 149, 148, 149, 149, 148, 149, 148]
contended volatile average:129ms [40, 93, 93, 148, 148, 149, 176, 149, 148, 148]
padding volatile average:127ms [58, 29, 148, 148, 149, 148, 149, 148, 148, 149]
```

#### AMD Ryzen 7 1700 3Ghz cache-line 64B

```
normal volatile average:187ms [118, 29, 227, 246, 260, 231, 242, 214, 66, 243]
contended volatile average:60ms [13, 64, 64, 65, 67, 66, 65, 64, 66, 67]
padding volatile average:55ms [16, 11, 65, 68, 67, 67, 66, 64, 66, 65]
```

### 结果小结

看起来 , 我们使用的避免 false sharing 的手段, 在 3 个 cpu 上都起到了作用

看起来上面的程序很简单, 其实包含了很多底层的知识, 我分别拿出来简单讲讲

####  1. Cache line 的大小

一般都为 64B, 所以你可以看到我在手动填充组中,  使用了多个 long , 保证在一个 cache line 上只有一个 volatile 变量

- 高速缓存行的大小
  - https://stackoverflow.com/questions/14707803/line-size-of-l1-and-l2-caches
- 如何查看 cpu L1, L2 cache line size?
  - windows: 
    - 下载 cpuz 查看缓存行大小

  - linux: 
    - cat /sys/devices/system/cpu/cpu0/cache/index0/coherency_line_size

#### 2.  java 内存布局中的对象头/字段重排序

请查看我在最后给出的参考文档和解释

Java 虚拟机重新分配字段的先后顺序，以达到内存对齐的目的。

主要有两个原则: 

1. 如果一个字段占据 C 个字节，那么该字段的偏移量需要对齐至 NC。这里偏移量指的是字段地址与对象的起始地址差值。
   -  以Long 类为例，仅有一个 long 类型的字段, header 为 12B, 但因为要对齐, 所以 中间的 4B 没用 
   -  12B header +(4B) + 8B
2. 子类所继承字段的偏移量，需要与父类对应字段的偏移量保持一致。

####  3. `@Contended` 注解

这个注解提示即时编译器该字段在多线程下有竞争,  Java 虚拟机会让不同的 `@Contended` 字段处于独立的缓存行中 

## 原因探究

false  share 背后的原因牵扯到 java / JMM / cache cpu 的方方面面,  从 volatile 内存语义的实现, 到cpu缓存一致性协议, 又或者你了解到即时编译器的重新排序,  内存系统的重排序, 处理器的乱序执行,  每一步的背后都和底层原理有着千丝万缕的联系, 可以这样说, 显露在你面前的这个知识点, 仅仅是你看到的冰山一角.  下面是罗列的部分问题

1. volatile 与 java 内存模型的实现?
   -  原来这个问题是 volatile 是如何实现的, 但是在 java 中 volatile 这个关键字和 java 内存模型太密不可分了. 对 volatile 变量读写的实现, 无一不伴随着 java 内存模型的影子
2. 汇编中的 lock 指令是怎么实现的 ?
3. 缓存一致性协议是什么? 请参考最后的文档
4. 为什么不同 cpu 上会有不同的运行差异 ? ECS 与 普通主机的CPU的差别?



### 讲解

里面涉及到的原理颇多, 我这边尽量简单易懂的, 根据**逻辑推理顺序**讲讲

1. volatile 变量的**写**操作经过 JIT 编译后的汇编指令中 有 **lock 前缀**
   - `LOCK` 前缀可确保 CPU 操作的持续时间内有 高速缓存行的  **独占所有权**   [参考](https://stackoverflow.com/questions/8891067/what-does-the-lock-instruction-mean-in-x86-assembly)
   - 在 java 并发编程的艺术中写道  lock 前缀会引发下面两件事
     - 将当前处理器缓存行的数据写回系统内存(主内存)
     - 使在其他cpu缓存了该内存地址的数据无效
2. 前面一点讲到,  lock 前缀需要获取高速缓存行的独占权, 那这里相当于 互斥访问了, 如何实现呢?
   - 有两种实现方式
     - **锁总线** , 导致其他cpu不能访问总线, 也就不能访问系统内存(主内存)
     - **锁缓存行** cache lock
   - 讲到这里也应该明白, volatile 的写必然会引起底层一定范围的锁
3. 前面一点提到, 锁总线和锁缓存行, 再结合之前在不同 cpu 上结果表现不同, 你是否想到了什么?
   - 在 ECS (阿里云主机 Platinum 8269CY ) cpu 上, 由于锁总线导致 false sharing 问题没有出现
   - 而在我们自己使用 i3 / i5/ i7 / Ryzen 上, 则存在 false sharing 问题
   - 所以可以说 缓存行锁定 导致了 false sharing 问题. 虽然前面这样说, 缓存行的问题导致了 false sharing , 但锁缓存行肯定是利大于弊的, 锁范围的变小带来的就是巨大的性能提升.


## 应用: 哪些地方通过避免 falseSharing 来提高效率

- LongAdder 的父类  Striped64
- ConcurrentHashMap 中的 CounterCell
- disruptor

## 奇怪的问题

### java 怎么其打印汇编后的代码?

todo

### 为什么每次测试的前几次时间都较短?

比如下面这次

```
normal volatile average:187ms [118, 29, 227, 246, 260, 231, 242, 214, 66, 243]
contended volatile average:60ms [13, 64, 64, 65, 67, 66, 65, 64, 66, 67]
padding volatile average:55ms [16, 11, 65, 68, 67, 67, 66, 64, 66, 65]
```

现象就是:  这里的 padding  组一共测试了 10 次, 前两次的时间都比较短; 而对照组, contended 组都类似;

网上看了很多, 但是都没有相关的资料, 也很难描述这个问题. 我个人猜测是 由于 竞争激烈,  cpu 对缓存锁进行了一定程度的升级, 导致了之后的执行效率变低. 

如果对此底层原理有了解的, 或者有其他想法想聊聊的, 欢迎在博客 / github issues 留言



## 参考文档

1. [java 内存布局]( https://time.geekbang.org/column/article/13081 )

2. [Java volatile 关键字底层实现原理解析]( https://crowhawk.github.io/2018/02/10/volatile/ )

3. [is-volatile-expensive]( https://stackoverflow.com/questions/4633866/is-volatile-expensive )

4. [MESIF](https://zhuanlan.zhihu.com/p/24146167 )

5. [内存重排序 memory reordering]( https://tech.meituan.com/2014/09/23/java-memory-reordering.html )

   

- java 堆中对象的 字段重排列
  - 概念
    - Java 虚拟机重新分配字段的先后顺序，以达到内存对齐的目的。
      - [java 内存布局]( https://time.geekbang.org/column/article/13081 )
- volatile
  - volatile 转为汇编时会有 lock 前缀 
    - [Java volatile 关键字底层实现原理解析]( https://crowhawk.github.io/2018/02/10/volatile/ )
    - java 并发编程的艺术 第二章
  - volatile 的消耗
    - 对 volatile 变量的读等同于从主内存中加载一个值
    - 对 volatile 变量的写,  会导致缓存行 cache line 失效, 实际的消耗依赖于 CPU 架构
      - [is-volatile-expensive]( https://stackoverflow.com/questions/4633866/is-volatile-expensive )
  
- 内存锁 与 缓存一致性协议
  - 486以及pentium 处理器 向系统总线 发出 lock 指令, cache line 为 单个 cpu 独占
  - 在p6以后的x86处理器中, 原子操作(例如cmpxchg)不再发出任何lock信号, 一切都由缓存一致性协议cache coherency mechanism 来完成.  (但在 java/golang 的汇编中, 由于兼容性, lock 前缀还是要加的, 但是 cpu 不会发送 lock 信号, 并且 lock 保证了指令不会重排序 )
  - MESIF 协议,  core 与其他 core 的MESI 状态对比
    -  [MESIF](https://zhuanlan.zhihu.com/p/24146167 )

- 指令的重排序
  - 硬件架构上讲,  Cpu 采用了允许将多条指令不按程序规定的顺序分开发送给各个相应电路单元处理
    - P371 深入理解jvm 周志明 第12章12.3.3 
    - [does-an-x86-cpu-reorder-instructions ]( https://stackoverflow.com/questions/50307693/does-an-x86-cpu-reorder-instructions )

## 后记

文章从 4 月 写到 5月, 前几天终于把 java 并发编程的艺术看完, 才动笔写完这篇, 不容易呀. 