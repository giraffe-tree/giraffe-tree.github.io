---
title: "ARP 协议小结"
description: "arp"
publishDate: "5 Jan 2021"
tags: ["写作", "网络协议"]
---

# ARP 协议小结

- 题图是去川西住在寨子里的时候, 村民采的各种菌菇

## Survey

- Address Resolution Protocol 地址解析协议
- ARP 是一个通过 **解析网络层地址来寻找数据链路层地址** 的网络传输协议，它在IPv4中极其重要

## Question

- 是哪一层的协议
- ARP 协议能抓包么? 怎么抓包 ?
- ARP 的工作机制是怎么样的 ?
- ARP 常见的应用 ?
- ARP 与其他协议的联系/交互? DHCP ?
- 如果找不到 ip 对应的 mac 会怎么处理?
- docker 中如何运用 arp 的 ?
- ip 对应的 mac 地址会过期么? 过期策略是怎么样的 ?
- ARP poisoning ARP 病毒是什么?
- RARP 协议是什么？
- ARP 报文格式

## Read

### 入门

- ARP 应该算是 2.5 层协议, 因为它工作在 链路层和IP层中间 (ARP 没有ip协议头部)
- 查看 arp 映射表
    - windows  `arp -a`
    - linux `arp`
        - `yum install net-tools`
    - mac  `arp -nla`
- 操作系统会缓存 arp 映射表
- 清空 arp 映射表
    - windows `arp -d`

### ARP 如何抓包 ?

- FrameType = 0x0806
- 使用 wireshark  arp 过滤
- 图中的 opCode = 1 请求 192.168.31.1 是谁?
    - 一般来说 ARP 请求都是广播

![0](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/arp/0.png)

- 也有单播的

![1](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/arp/1.png)

- 响应 opCode = 2 如图

![2](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/arp/2.png)

### ARP 的工作机制是怎么样的 ?

1. 在局域网内广播:  这个IP是谁的?
2. 正常情况下, 当局域网内一个设备接收到一个问它自己IP 的 ARP 请求, 它会填充自己的硬件地址, 将两个发送方地址和两个接收方地址互换, 将 OpCode 字段设置为 2, 然后发送生成的应答

### ARP 常见的应用

1. 主要功能还是将 ip 转换为 mac 
2. 当数据报的目的地不在当前子网时, 将其转发到一台路由器
3. Gratuitous ARP 主机主动使用自己的IP地址作为目标地址发送ARP请求
    1. 正常情况下应当不能收到ARP回应，如果收到，则表明本网络中存在与自身IP地址重复的地址。(可以用来检查局域网内的 ip 地址冲突)
    2. 用于通告一个新的MAC地址, 发送方换了块网卡，MAC地址变了，为了能够在ARP表项老化前就通告所有主机，发送方可以发送一个免费ARP。
    3. 通知交换机
    4. 每次IP接口或链路断开时，该接口的驱动程序通常都会发送免费ARP，以预加载所有其他本地主机的ARP表。

### ARP 与其他协议的联系/交互? DHCP ?

- ARP 是将 IP 映射到 Mac
- todo

### 如果找不到 ip 对应的 mac 会怎么处理?

那就找不到 =.= 没有响应

### docker 中如何运用 arp 的 ?

这个问题问的..... 

容器网络用的是 namespace 隔离, 原理大概了解了下, 但是还没有串联起来

通过tcpdump 同样可以抓到 arp 的request 包 

```
docker run -d --name if-test  centos:8.1.1911 sleep 36001
```

创建一个 centos 容器, 然后在里面安装 tcpdump , 使用 tcpdump 进行抓包 

```
tcpdump -i eth0 arp
```

### ip 对应的 mac 地址会过期么? 过期策略是怎么样的 ?

会过期, TCP/IP 详解 卷1 中写到, 大多数实现中, 完整条目的超时时间为 20 分钟, 不完整条目的超时时间为 3分钟 (不完整条目即找不到 ip 地址对应的mac 的记录) ,RFC1122 中规定条目即使在使用时也启动超时，但是很多实现是在每次使用条目后重新启动超时. arp 也允许管理员设置缓存条目永远不超时. 

以下来自 RFC1122: 


> 地址解析协议（ARP）的实现[LINK：2]必须提供一种刷新过期缓存的机制条目。
如果此机制涉及超时，则应为可以配置超时值。

> 一种防止ARP泛洪的机制（反复发送对相同IP地址的ARP请求（高速率）必须包括在内。


### ARP poisoning ARP 病毒是什么?

有主机假扮其他主机对 ARP 请求做出响应

### RARP 协议是什么？

逆地址解析协议（Reverse Address Resolution Protocol，RARP），是一种网络协议，互联网工程任务组（IETF）在RFC903中描述了RARP[1]。RARP使用与ARP相同的报头结构，作用与ARP相反。RARP用于将MAC地址转换为IP地址。其因为较限于IP地址的运用以及其他的一些缺点，因此渐为更新的BOOTP或DHCP所取代。目前已经很少使用(以前主要用于无盘工作站的系统, 需要系统管理员手动配置).

### ARP 报文格式

[报文格式](https://www.notion.so/71849d9f7f634dcbaf63c5e2fde8f1bd)

|数据类型   |长度(位)|长度(字节)|备注              |
|-------|-----|------|----------------|
|目标以太网地址|48   |6     |                |
|源以太网地址 |48   |6     |                |
|帧类型    |16   |2     |以上为 14字节以太网首部   |
|硬件类型   |16   |2     |以下为 28字节ARP请求/响应|
|协议类型   |16   |2     |                |
|硬件地址长度 |8    |1     |                |
|协议地址长度 |8    |1     |                |
|操作码    |16   |2     |                |
|源硬件地址  |48   |6     |                |


![ARP%20%E5%8D%8F%E8%AE%AE%E5%B0%8F%E7%BB%93%201bc985ea01c9464fa303d863579da1be/Untitled%203.png](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/arp/3.png)

## Recite

## Review

## 参考

1. ARP wiki 包含报文格式
    1. [https://en.wikipedia.org/wiki/Address_Resolution_Protocol](https://en.wikipedia.org/wiki/Address_Resolution_Protocol)
    2. [https://zh.wikipedia.org/wiki/地址解析协议](https://zh.wikipedia.org/wiki/%E5%9C%B0%E5%9D%80%E8%A7%A3%E6%9E%90%E5%8D%8F%E8%AE%AE)
2. arp 协议内容
    1. [https://www.erg.abdn.ac.uk/users/gorry/course/inet-pages/arp.html](https://www.erg.abdn.ac.uk/users/gorry/course/inet-pages/arp.html)
3. ARP 欺骗
    1. [https://zh.wikipedia.org/wiki/ARP欺騙](https://zh.wikipedia.org/wiki/ARP%E6%AC%BA%E9%A8%99)
4. Gratuitous ARP 免费ARP
    1. [https://wiki.wireshark.org/Gratuitous_ARP](https://wiki.wireshark.org/Gratuitous_ARP)
5. TCP/IP 详解 卷1  第4章 地址解析协议
6. RFC1122 关于 ARP 超时
    1. [https://tools.ietf.org/html/rfc1122#page-22](https://tools.ietf.org/html/rfc1122#page-22)
7. arp not found
    1. `yum install net-tools`
    2. 或者直接查看 `cat /proc/net/arp`