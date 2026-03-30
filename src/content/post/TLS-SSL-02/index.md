---
title: "TLS/SSL 入门 02 - RSA,DH密钥交换"
description: "RSA,DH密钥交换"
publishDate: "1 Feb 2021"
tags: ["写作", "网络协议"]
---

# TLS/SSL 入门 02 - RSA,DH密钥交换


## 概述


## RSA

### 算法分析

RSA 的算法原理网上有很多, 我这边就不多说了, 下面两张图来自极客时间

- 加密过程

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/rsa.png)

- 解密过程

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/rsa-de.png)

### 讲讲为什么 RSA 是安全的 ?

讲到安全, 那我们反过来想想怎么破解 RSA

- 根据上面的图, 想要破解, 翻译过来的问题就是
	-  我们已知 k, n,   需要计算出 d (私钥)
- 我们要知道 d, 就需要拿到 v
- 而要拿到 v 需要拿到 p, q
- 但对 n (一个很大的数) 做因式分解非常困难

#### 关于为什么大数因式分解很困难

了解下 One-way function , 顺着计算易，逆着计算难.

- google 吧

## 非对称加密传输对称密钥

### 原理

使用 **非对称加密传输对称密钥** 的原理都是一样的, 如下图

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/RSA%20%E9%9D%9E%E5%AF%B9%E7%A7%B0%E5%8A%A0%E5%AF%86.jpg)

### 为什么现在不用非对称加密传输对称密钥

因为没有前向保密性 Forward secrecy.

- RSA 秘钥交换是通过客户端生成对称密钥, 并且通过服务器的公钥加密后传输给服务器的
- 如果有个中间人保存了全部报文, 等到破解服务器私钥之后, 就可以用私钥解密这个对称密钥, 从而破解出里面的内容

## DH 密钥交换

它可以让双方在完全没有对方任何预先信息的条件下通过不安全信道创建起一个密钥。这个密钥可以在后续的通讯中作为对称密钥来加密通讯内容。

### 基本原理

简单来说, 现在有两个素数 p 和 q, 当已知 x 时, 求 y 容易, 但已知 y 求 x 很难

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/dh-1.png)

- client 端通过 `private key 2` 和 `public key 1` 生成密钥 X1
- server 端通过 `private key 1` 和 `public key 2` 生成密钥 X2
- 而通过下面的机制算法可以使得 X1= X2 = K (下图中的K )
    - 由此就可以作为 client 和 server 通讯的 对称密钥

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/dh-2.png)

![](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/2021/01/tls/dh-3.png)


### 问题

1. 中间人攻击
	- todo
2. 计算慢
	- 后面出现了一种基于 ECC 椭圆曲线的交换算法也就是 ECDHE(最后一个E是ephermeral)
	- 相比于 DH 密钥交换, ECC 可以减少一定量的计算
	- 关于ECC 椭圆曲线的知识 可以看看阿贝尔群
	- 而 ECC 相比于 RSA, 相同长度的密钥, ECC 的加密强度更好, 性能更好


## 参考

1. 单向陷门函数
	- One-way function
	- https://zh.wikipedia.org/wiki/%E5%96%AE%E5%90%91%E5%87%BD%E6%95%B8
2. 阮一峰 RSA
	- https://www.ruanyifeng.com/blog/2013/06/rsa_algorithm_part_one.html
3. DH 密钥交换原理
	- https://www.zhihu.com/question/29383090/answer/1649199245
	- https://en.wikipedia.org/wiki/Discrete_logarithm#
4. 阿贝尔群
	- 阿贝尔群（Abelian group）也称为交换群（commutative group）或可交换群，它是满足其元素的运算不依赖于它们的次序（交换律公理）的群。阿贝尔群推广了整数集合的加法运算。阿贝尔群以挪威数学家尼尔斯·阿贝尔命名。
	- 欠了两块钱的我 =.=
5. Forward secrecy 前向保密性
    - [https://en.wikipedia.org/wiki/Forward_secrecy](https://en.wikipedia.org/wiki/Forward_secrecy)
	- 在密码学中，前向保密（英语：Forward Secrecy，FS），有时也被称为完全前向保密（英语：Perfect Forward Secrecy，PFS）[1]，是密码学中通讯协议的安全属性，指的是长期使用的主密钥泄漏不会导致过去的会话密钥泄漏。[2]前向保密能够保护过去进行的通讯不受密码或密钥在未来暴露的威胁。[3]如果系统具有前向保密性，就可以保证在私钥泄露时历史通讯的安全，即使系统遭到主动攻击也是如此。





