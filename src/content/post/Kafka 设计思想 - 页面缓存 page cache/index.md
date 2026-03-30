---
title: "kafka 设计思想 - page cache"
description: "page cache"
publishDate: "16 Nov 2020"
tags: ["写作", "kafka", "linux"]
---


## 概述

本文用于阐述 kafka 是如何利用 page cache 提升性能的

封面图来自 党岭 - 马

## 引子

在 kafka 官方文档中, 有这样一段话 参考[1.a]

>rather than maintain as much as possible in-memory and flush it all out to the filesystem in a panic when we run out of space, we invert that. All data is immediately written to a persistent log on the filesystem without necessarily flushing to disk. In effect this just means that it is transferred into the kernel's pagecache.
>机翻:
>当我们空间不足时，不要在内存中维护尽可能多的内存并将其全部刷新到文件系统中，而是将其反转。所有数据都会立即写入文件系统上的持久日志中，而不必刷新到磁盘。实际上，这仅意味着将其传输到内核的页面缓存中。

**kafka 在设计时以 page cache 为中心, 充分利用操作系统提供的 page cache , 而不是在 JVM 内存中维护对象。**

## page cache

### 什么是 page cache

操作系统没有将所有未直接分配给应用程序的物理内存用于页面缓存。

页面缓存是在**内核中**通过**页面内存管理**实现的，并且对应用程序几乎是透明的。

下图来自 参考[5.a]

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/qLnUYxw1wrK97iP8.png)

### 为什么要用 page cache

标准 I/O 和内存映射会先把数据写入到 Page Cache，这样做会通过减少 I/O 次数来提升读写效率。**减少 I/O，提升应用的 I/O 速度。**

**使用 page cache 是一个权衡 trade off 的设计方案, 可以在减少 IO, 提升响应速度 / 开发复杂度 上达到一个很好的平衡.**

### 什么是 zero-copy ?

zero-copy 协议对于网络链接容量接近或超过CPU处理能力的高速网络尤其重要。在这种情况下，CPU几乎将所有时间都花在复制传输的数据上，因此成为了瓶颈。 参考[3.b] 为了更加高效的利用系统资源, 于是就有了 zero-copy 上

由于网上文章很多, 下面我仅引用三张图来说明 zero-copy 参考[3.a]

* 普通文件读出, 并通过网卡发出

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/qCSSEong8bWLhJAI.png)

* 使用 sendfile 的 zero-copy 技术

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/mAEMoCXR8CIcpKQG.png)

* 如果网卡支持 SG-DMA The Scatter-Gather Direct Memory Access

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/m8Y7DzPjkeqvvOco.png)

### zero-copy 的优势

参考[3.a]

1. 减少了系统调用, 减少了内核态/用户态上下文切换
2. 减少了内存 拷贝, 降低了用户内存的消耗
3. 最大化利用 socket 缓冲区中的内存
    1. 在没有零拷贝的时候, 如果用户缓冲区过大，它就无法一次性把消息全拷贝给 socket 缓冲区；如果用户缓冲区过小，则会导致过多的 read/write 系统调用。
    2. 而 socket 缓存区的可用空间是动态变化的
    3. 零拷贝使我们不必关心 socket 缓冲区的大小。比如，调用零拷贝发送方法时，尽可以把发送字节数设为文件的所有未发送字节数，例如 320MB，也许此时 socket 缓冲区大小为 1.4MB，那么一次性就会发送 1.4MB 到客户端, 而不局限于用户缓冲区的大小

## kafka 与 page cache 的一些问题

### kafka 数据高持久性, 高可用性应该通过 page cache/本地磁盘持久化 保证么?

no! no! no !

应该通过副本机制, 通过提供数据冗余, 来实现高持久性, 高可用性

这可能是初学者的一个误区, 认为文件必须要刷新到磁盘才可靠, 如果在一个单机的系统中, 是这样的. 但在一个分布式的系统中, 随时要应付某个服务器宕机的情况, 必须使用 副本来降低这种风险.

### 为什么 kafka 要用 page cache

1. 如果使用 JVM 来管理这些内存 参考[1.a]
    1. 对象头会带来很多空间浪费
    2. 过大的堆会让 JVM GC 负担太重, 影响回收效率
    3. 当重启 kafka 服务时, 内存上重建缓存10GB 的告诉缓存可能需要很长时间 参考[1]
        1. 而使用 page cache , 即使重启 kafka 也能够直接利用其中的缓存
2. 使用 page cache 的另外一个好处就是可以使用 Zero-Copy 零拷贝
    1. zero-copy 可以降低系统调用的次数 (减少内核态/用户态上下文切换)
    2. 可以减少在不同缓冲区之间的 copying
3. **如果Kafka producer的生产速率与consumer的消费速率相差不大，那么就能几乎只靠对broker page cache的读写完成整个生产-消费过程, 所有的数据都在内存中,**这是 kafka 的高吞吐量的保证 参考[2.a]
4. 这也是一个**权衡**的方案, 能够在开发量适当的情况下, 尽可能地提高IO效率 参考[5.a]

### kafka 中的 zero-copy 调用接口

在 java 中通过`FileChannel.transferTo`来使用 zero-copy  , 这个实现依赖于操作系统底层的`sendfile`参考[7.a]

调用流程可以 参考[8.a]

### page cache 污染导致 吞吐量下降

* 该案例来自[https://time.geekbang.org/column/article/128184](https://time.geekbang.org/column/article/128184)
>我碰到过一个线上环境的问题：该集群上 Consumer 程序一直表现良好，但是某一天，它的性能突然下降，表现为吞吐量显著降低。我在查看磁盘读 I/O 使用率时，发现其明显上升，但之前该 Consumer Lag 很低，消息读取应该都能直接命中页缓存。此时磁盘读突然飙升，我就怀疑有其他程序写入了页缓存。后来经过排查，我发现果然有一个测试 Console Consumer 程序启动，“污染”了部分页缓存，导致主业务 Consumer 读取消息不得不走物理磁盘，因此吞吐量下降。

## Page Cache 进阶

### 应用本身消耗内存 RSS 不多, 但是整个系统的内存使用率很高?

* 检查 Shmem 共享内存的消耗

### 观测 page cache

参考[5.a] [9.a]

```plain
# 这里我过滤了一些字段
cat /proc/meminfo | grep -E "Buffers|Cached|SwapCached|Active\(file|Inactive\(file|Shmem:"
## out
Buffers:          285316 kB
Cached:          5691760 kB
SwapCached:            0 kB
Active(file):    2579744 kB
Inactive(file):  3397040 kB
Shmem:              5840 kB
```

>Buffers + Cached + SwapCached = Active(file) + Inactive(file) + Shmem + SwapCached
> 
>>Buffers + Cached + SwapCached = 5977076
>
>>Active(file) + Inactive(file) + Shmem + SwapCached = 2579744+3397040+5840 = 5982624
>
>>由于数据采集会一直变化, 等式未必会严格相等, 但不必怀疑它的正确性
>
>>PageCache = Buffers + Cached + SwapCached = Active(file) + Inactive(file) + Shmem + SwapCached

* Buffers
    * Relatively temporary storage for raw disk blocks shouldn't get tremendously large
    * Buffers 是对**原始磁盘块的临时存储 (磁盘缓存)**，也就是用来缓存磁盘的数据，通常不会特别大（20MB 左右）。这样，内核就可以把分散的写集中起来，统一优化磁盘的写入，比如可以把多次小的写合并成单次大的写等等。
* Cached
    * in-memory cache for files read from the disk (the pagecache).  Doesn't include SwapCached
    * Cached 是从磁盘读取文件的页缓存 (**文件缓存**)，也就是用来缓存从文件读取的数据。这样，下次访问这些文件数据时，就可以直接从内存中快速获取，而不需要再次访问缓慢的磁盘。(写文件时, 也会用到这部分缓存)
* SwapCached
    * Memory that once was swapped out, is swapped back in but still also is in the swapfile (if memory is needed it doesn't need to be swapped out AGAIN because it is already in the swapfile. This saves I/O)
* Active
    * Memory that has been used more recently and usually not reclaimed unless absolutely necessary.
* Inactive
    * Memory which has been less recently used.  It is more eligible to be reclaimed for other purposes
* Shmem
    * Total memory used by shared memory (shmem) and tmpfs
* SwapCached
    * Memory that once was swapped out, is swapped back in but still also is in the swapfile (if memory is needed it doesn't need to be swapped out AGAIN because it is already in the swapfile. This saves I/O)
* 在读写普通文件时，会经过文件系统，由文件系统负责与磁盘交互；而读写磁盘或者分区时，就会跳过文件系统，也就是所谓的“裸I/O“。这两种读写方式所使用的缓存是不同的，也就是文中所讲的 Cache 和 Buffer 区别。
    * 对于文件，Page Cache指向Block Buffer，对于非文件则是Block Buffer。文件操作，只影响 Page Cache，Raw操作，则只影响 Buffer.

### 写文件 对 page cache 的影响


```plain
# 打开第一个 shell
# 写入 3 表示清理文件页、目录项、Inodes 等各种缓存
echo 3 > /proc/sys/vm/drop_caches
# 每隔一秒输出 cached KB 数
vmstat 1
# 打开第二个 shell
# 读取随机设备, 生成一个 500M 大小的文件
dd if=/dev/urandom of=./tmp.file bs=1M count=500
```

* 当生成文件时, 可以看到 cache 快速上升, 随后 bo (每秒写入的块数) 上升
    * buff 和 cache 就是我们前面看到的 Buffers 和 Cache，单位是 KB。
    * bi 和 bo 则分别表示块设备读取和写入的大小，单位为块 / 秒。因为 Linux 中块的大小是 1KB，所以这个单位也就等价于 KB/s。

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/CTrvRngfYdJJjjyk.png)

* 上面这个例子说明了在写文件时也会用到 Cache
* 而写磁盘时,  buffer 会出现增长 (好吧, 由于我只有一块磁盘...这里就没有做演示)

### 读文件对 page cache 的影响

```plain
# 打开第一个 shell
# 写入 3 表示清理文件页、目录项、Inodes 等各种缓存
echo 3 > /proc/sys/vm/drop_caches
# 每隔一秒输出 cached KB 数
vmstat 1
# 打开第二个 shell
# 读取文件数据
dd if=./tmp.file of=/dev/null
```

* 可以看到 bi (block 读取) 有变化,  cache 一直在增长

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/DrBDxL2BSZN14qN6.png)

### 读磁盘对 page cache 的影响

```plain
# 打开第一个 shell
# 写入 3 表示清理文件页、目录项、Inodes 等各种缓存
echo 3 > /proc/sys/vm/drop_caches
# 每隔一秒输出 cached KB 数
vmstat 1
# 打开第二个 shell
# 运行dd命令读取设备文件, 我这里用的是 阿里云上的 ecs
dd if=/dev/vda1 of=/dev/null bs=1M count=1024
```

* 可以看到读磁盘,  buff 会增加, 读磁盘时数据会缓存到 Buffer 中。

* 总结下,**Buffer 既可以用作“将要写入磁盘数据的缓存”，也可以用作“从磁盘读取数据的缓存”。Cache 既可以用作“从文件读取数据的页缓存”，也可以用作“写文件的页缓存”。**

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/5gFwuiMOLu9PmuhI.png)

### Page Cache 如何产生

* 分类
    * Buffered I/O 标准 I/O
    * Memory-Mapped I/O 存储映射 I/O
        * 可以理解为文件内容的 zero-copy
* 为什么 Memory mapped IO 比 传统 IO 要快?
    * Memory Mapped IO 可以直接读写 page cache
    * 而 传统 IO (Buffered IO) 需要先将数据从内核缓冲区拷贝到用户缓冲区
* 检查脏页
    * `cat /proc/vmstat | egrep "dirty|writeback"`
    * nr_dirty 表示当前系统中积压了多少脏页，nr_writeback 则表示有多少脏页正在回写到磁盘中，他们两个的单位都是 Page(4KB)。
* 检查 free
    * `free -k / free -m / free -g`

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/WoR7AnUF8MPTJsW9.png)

* 参考 [10.a]

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/vJMXnS2lgsPsPcN7.png)

### Page Cache 如何死亡(被回收)?

* 回收方式
    * 直接回收
    * 后台回收
* 观测
    * System Activity Reporter系统活动情况报告
        * sar -B 1
        * 解析 /proc/vmstat 得出的
        * 命令详解
            * [https://linuxtools-rst.readthedocs.io/zh_CN/latest/tool/sar.html](https://linuxtools-rst.readthedocs.io/zh_CN/latest/tool/sar.html)
    * pgscank/s : kswapd(后台回收线程) 每秒扫描的 page 个数。pgscand/s: Application 在内存申请过程中每秒直接扫描的 page 个数。pgsteal/s: 扫描的 page 中每秒被回收的个数。%vmeff: pgsteal/(pgscank+pgscand), 回收效率，越接近 100 说明系统越安全，越接近 0 说明系统内存压力越大。
* 为什么第一次读写某个文件，Page Cache 是 Inactive 的？
    * 第一次读取文件后，文件内容都是inactive的，只有再次读取这些内容后，才会把它放在active链表上, 处于inactive链表上的pagecache在内存紧张是会首先被回收掉
    * 第二次读取后, 这些内容就会从inactive链表里给promote到active链表里 (二次机会法)

![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/11/jJURiXNsSwrlsSxh.png)

## 其他

### Linux Kernel 设计原则: never break the user space

* 在进行内核更改时，在用户的应用程序“空间”中引起问题是非常不好的
    * [https://stackoverflow.com/questions/25954270/what-does-it-mean-to-break-user-space](https://stackoverflow.com/questions/25954270/what-does-it-mean-to-break-user-space)

## 参考

1. kafka design file system
    1. [http://kafka.apache.org/documentation/#design_filesystem](http://kafka.apache.org/documentation/#design_filesystem)
2. kafka 与 page cache 的那些事
    1. [https://cloud.tencent.com/developer/article/1488144](https://cloud.tencent.com/developer/article/1488144)
3. zero copy
    1. 零拷贝：如何高效地传输文件？
        1. [https://time.geekbang.org/column/article/232676](https://time.geekbang.org/column/article/232676)
    2. zero-copy wiki
        1. [https://en.wikipedia.org/wiki/Zero-copy](https://en.wikipedia.org/wiki/Zero-copy)
    3. zero-copy
        1. [https://blog.csdn.net/u013256816/article/details/52589524](https://blog.csdn.net/u013256816/article/details/52589524)
4. page cache wiki
    1. [https://en.wikipedia.org/wiki/Page_cache](https://en.wikipedia.org/wiki/Page_cache)
    2. [https://upload.wikimedia.org/wikipedia/commons/f/fb/The_Linux_Storage_Stack_Diagram.svg](https://upload.wikimedia.org/wikipedia/commons/f/fb/The_Linux_Storage_Stack_Diagram.svg)
5. linux 内核大佬 page cache
    1. [https://time.geekbang.org/column/article/273892](https://time.geekbang.org/column/article/273892)
6. kafka 的高吞吐 最大化提高效率
    1. [http://kafka.apache.org/documentation/#maximizingefficiency](http://kafka.apache.org/documentation/#maximizingefficiency)
7. java 中使用 zero-copy
    1. [https://developer.ibm.com/articles/j-zerocopy/](https://developer.ibm.com/articles/j-zerocopy/)
8. kafka 中的 zero-copy , transferTo 的调用流程
    1. [https://blog.csdn.net/allwefantasy/article/details/50663533](https://blog.csdn.net/allwefantasy/article/details/50663533)
9. kernel Documentation
    1. [https://www.kernel.org/doc/Documentation/filesystems/proc.rst](https://www.kernel.org/doc/Documentation/filesystems/proc.rst)
10. page cache 如何产生
    1. [https://time.geekbang.org/column/article/274106](https://time.geekbang.org/column/article/274106)
