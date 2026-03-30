---
title: "Kafka: The coordinator is not available 分析"
description: "kafka 源码分析"
publishDate: "3 Sep 2020"
tags: ["写作", "kafka"]
---

## 概述

题图 8月初拍的夕阳

我遇到的问题是, 本地调试时, producer 正常使用, consumer 无法消费, 也没有任何 error/warn 日志报出, 打开 debug 日志发现 Group coordinator lookup failed: The coordinator is not available.

### 小结

为了方便查阅, 先在开头写个小结

这个问题的本质是 **__consumer_offsets 分区不可用**

由于 `__consumer_offsets` 分区所在 broker 不可用, 导致无法消费, client 端一直在请求 Find coordinator  但是一直返回 `The coordinator is not available.`


### 本地单机解决方案步骤简述


1. 查看  `__consumer_offsets` 分区情况
    1. 可以用 kafka-topics.sh 比较方便
        1. `kafka-topics.sh --describe --zookeeper 192.168.31.203:2181 --topic __consumer_offsets`
        2. **如果看到 leader 为 None , 那你的错误跟我这边的错误类似**
        3. **示例**: `Topic: __consumer_offsets	Partition: 3	Leader: none	Replicas: 1001	Isr: 1001`
        4. 这里你可以看到有一个 ISR 1001 的 broker id , 说明 `__consumer_offsets` 在 1001 上有存在副本, 我们需要将这台服务器启动起来
    2. 也可以用 zookeeper 客户端 zkCli.sh
        1. `get /brokers/topics/__consumer_offsets/partitions/0/state`
2. 将之前你关掉的 broker  启动起来 (如果 broker.id = 1001, 那这个 id 一般是kafka 自动生成的)
3. 检查 `__consumer_offsets` 的 leader 是否正常了
    1. `kafka-topics.sh --describe --zookeeper 192.168.31.203:2181 --topic`
    2. 如果 leader 不为 None ,则可以正常消费了

想要了解问题排查思路的, 可以看下去

## 问题描述

在本地调试 kafka 源码时, server 端配置正常, 也正常使用 producer , 但 consumer 一直接收不到数据 (无法消费数据, 但也没有 info 及以上的日志出现 )

为了查找错误, 我在本地打开了 `org.apache.kafka.clients.consumer.internals.AbstractCoordinator` 的日志, 部分日志如下

可以看到 client 一直在发送 FindCoordinator 请求, 但是一直返回 **Group coordinator lookup failed: The coordinator is not available.** 

```plain
11:18:31,479 main DEBUG org.apache.kafka.clients.consumer.internals.AbstractCoordinator [] - [Consumer clientId=consumer-group-for-test-topic-1, groupId=group-for-test-topic] Sending FindCoordinator request to broker 192.168.31.203:9092 (id: 0 rack: null)
11:18:31,480 main DEBUG org.apache.kafka.clients.consumer.internals.AbstractCoordinator [] - [Consumer clientId=consumer-group-for-test-topic-1, groupId=group-for-test-topic] Received FindCoordinator response ClientResponse(receivedTimeMs=1599016711480, latencyMs=1, disconnected=false, requestHeader=RequestHeader(apiKey=FIND_COORDINATOR, apiVersion=3, clientId=consumer-group-for-test-topic-1, correlationId=7), responseBody=FindCoordinatorResponseData(throttleTimeMs=0, errorCode=15, errorMessage='The coordinator is not available.', nodeId=-1, host='', port=-1))
11:18:31,480 main DEBUG org.apache.kafka.clients.consumer.internals.AbstractCoordinator [] - [Consumer clientId=consumer-group-for-test-topic-1, groupId=group-for-test-topic] Group coordinator lookup failed: The coordinator is not available.
11:18:31,481 main DEBUG org.apache.kafka.clients.consumer.internals.AbstractCoordinator [] - [Consumer clientId=consumer-group-for-test-topic-1, groupId=group-for-test-topic] Coordinator discovery failed, refreshing metadata
```

为什么 在 server 端看似正常的情况下, 客户端会有 `The coordinator is not available.` 的错误返回?

### 环境

为了更好的复现, 下面是我本地的环境


* 平台
    * windows 10
* client 端
    * kafka 2.6.0
    * java 8_161
* server 端
    * 基于 kafka trunk 分支  2020.7.12 KAFKA-10247  2.7.0-SNAPSHOT
        * 源码地址:[https://github.com/giraffe-tree/kafka](https://github.com/giraffe-tree/kafka)
    * java 8_161

## 探究步骤

### 思路


1. 一般检查的思路都是从 kafka server 端 `KafkaApis` 这个类开始, 从 FindCoordinator request 开始查起

    * 找到  handleFindCoordinatorRequest
    * 从下图可以看到 topic  `__consumer_offsets` 的 leader 为 -1
        * 说明 `__consumer_offsets` 的 leader 不可用, 所以协调器也不可用
        * 所以到这里, 第一步的问题已经有答案了, `__consumer_offsets` 这个 topic 下的分区 leader 不可用, 所以这里我们提出了第二个问题
            * `__consumer_offsets` 的 leader 为什么不可用? leader 选举失败了么?

    ![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/09/rMlmGXmOyKmg8IeO.png)


2. 一个不通过源码的判断方法, 方便排查问题
    1. 知道了不能消费消息的原因是 分区 leader 不存在引起的, 我们就可以通过 kafka-topic 脚本来进行判断了
    2. `kafka-topics.sh --describe --zookeeper 192.168.31.203:2181 --topic __consumer_offsets`

        * 这个命令会输出分区对应的 leader isr 等
        * 可以看到这里的 leader 为 none , 显然 leader 不存在
        * **这里其实有个伏笔, 当时我没有注意到, 我在配置中设置的 broker.id =0, 但在这里显示的 1001**

    ```plain
	Topic: __consumer_offsets	Partition: 0	Leader: none	Replicas: 1001	Isr: 1001
	Topic: __consumer_offsets	Partition: 1	Leader: none	Replicas: 1001	Isr: 1001
	Topic: __consumer_offsets	Partition: 2	Leader: none	Replicas: 1001	Isr: 1001
	Topic: __consumer_offsets	Partition: 3	Leader: none	Replicas: 1001	Isr: 1001
    ```

3. 我们尝试解决第二个问题 `__consumer_offsets` 的 leader 为什么不可用?
    * 这部分就要讲到 分区 leader 选举过程
        * 即 Kafka 主题的某个分区推选 Leader 副本的过程
    * 我们找到 Election 这个 object, 这个是 kafka 中用于选举的对象
    * 可以看到下图中, 副本列表(assignment)中有一个为 1001 , isr 中有一个也是 1001 , 而存活的副本(liveReplicas)数为 0
        * 可能你还没有明白, 这里最奇怪的地方就在于,**我在 kafka 启动的配置中, 配置的 broker.id = 0 和这里的 1001 对不上**
        * 别急, 我们先看下去

    ![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/09/91B3ULZQ9nnPX0Pr.png)

    ![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/09/G1QWx92FH1WIomFI.png)


    * 我们看看 liveReplica 是怎么算出的
        * 进入 controllerContext.isReplicaOnline 方法
        * **我们发现存活的 brokerId 为 0**
            * 咦, 这不就跟我配置的对上了么!
            * 但是 这个 1001 是怎么来的呢?

    ![图片](https://open-chen.oss-cn-hangzhou.aliyuncs.com/open/blog/2020/09/7cUofmWQxx1m2hnz.png)


4. 分区副本所在的 brokerId = 1001 是怎么来的?

    * 我查找了下 kafka 的官方文档, 详见参考 [1]
    * 如果没有给 kafka 配置一个 broker.id . 则 会有一个唯一的 broker.id 自动生成
        * 这个 id 会从 reserved.broker.max.id + 1 开始生成
        * 而 reserved.broker.max.id 的默认值 为 1000
    * 现在真相大白了? **1001 是 kafka 自动生成的一个broker id**
    * **原因是我通过 docker 启动一台 kafka , 且没有设置 broker.id , 而之后没有清空 zookeeper, 并且关闭了这台 kafka**

5. 为什么我配置的 broker.id 是 1 ,  副本列表中显示的 broker id 却是 1001 呢?

    * 看起来像是在某个地方存了 分区-broker 信息, 而 kafka 启动后的 id 变过, 所以导致 kafka  认为 1001 这个 broker 没有起来, 而所有的 ISR 都在 broker  1001 上 , 所以选举失败.
    * 这里我查看了 zookeeper 里记录的分区信息
        * `get /brokers/topics/__consumer_offsets/partitions/0/state`
                * 示例
                * {"controller_epoch":41,"leader":-1,"version":1,"leader_epoch":0,"isr":[1001]}

6. 解决方案
    1. 方案1: 启动一台 broker.id = 1001 的 kafka 服务器
        1. 相当于你要恢复 `__consumer_offsets` 的 leader 选举, 所有 isr 副本
        2. 但是请注意检查 `__consumer_offsets` 的副本情况
        3. `kafka-topics.sh --describe --zookeeper 192.168.31.203:2181 --topic __consumer_offsets`
    2. 方案2: 在本地环境单机中, 可以直接删除 zookeeper 中 `__consumer_offsets` 的数据 **(高风险, 生产禁用)**, 然后还是按照 `broker.id=0` 启动, 订阅消费, 它会自动创建 `__consumer_offsets` topic (或者你也可以手动创建)

        1. `deleteall /brokers/topics/__consumer_offsets` 然后重启 kafka (broker.id=0)

## 问题复现方法


1. 本地启动一台 `broker.id =0` 的 broker , 默认的副本为 1 ,  创建  `__consumer_offsets` 之后关闭 broker (可以创建一个任意的 topic, 消费者订阅主题后,  kafka 内部就会自动创建 `__consumer_offsets`)
    1. 可以通过 `kafka-topics.sh --describe --zookeeper 192.168.31.203:2181 --topic __consumer_offsets`检查是否创建成功
2. 再启动一台 broker.id = 1 的 broker , 消费任意主题, 就会出现无法消费任何数据, 也没有 info 级别日志
    1. 这时开启 debug 日志, 就会看到 `Group coordinator lookup failed: The coordinator is not available.`

## 思考

这个问题本质上是由 `__consumer_offsets` 分区不可用引起的, 除非 分区副本所在的 broker 启动起来, 否则无法解决这个问题.

而默认 `offsets.topic.replication.factor` 参数(默认是3, 用于设置 `__consumer_offsets` 创建时的副本数 参考[2] ) 在单机启动时似乎只会创建 1个副本

所以最佳实践:**请手动创建 __consumer_offsets 主题, 并指定 分区 和 副本数**

```plain
kafka-topics.sh --zookeeper 192.168.31.203:2181  --create --topic __consumer_offsets --partitions 50  --replication-factor 3
```


## 参考


1. broker id
    1. 如果没有给 kafka 配置一个 `broker.id`  则 会有一个唯一的 `broker.id` 自动生成
    2. 这个 id 会从 `reserved.broker.max.id` + 1 开始生成
    3. 而 `reserved.broker.max.id` 的默认值 为 1000
    4. [https://kafka.apache.org/documentation/#broker.id](https://kafka.apache.org/documentation/#broker.id)
    5. [https://kafka.apache.org/documentation/#reserved.broker.max.id](https://kafka.apache.org/documentation/#reserved.broker.max.id)
2. `__consumer_offsets` 默认副本数 `offsets.topic.replication.factor`
    1. [http://kafka.apache.org/documentation/#offsets.topic.replication.factor](http://kafka.apache.org/documentation/#offsets.topic.replication.factor)
