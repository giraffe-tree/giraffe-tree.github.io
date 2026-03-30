---
title: "间隙锁加锁规则"
description: "mysql"
publishDate: "5 Mar 2021"
tags: ["写作", "mysql", "database"]
---

---
title: 间隙锁加锁规则
---
## 概述

1. 加锁的基本单位是 next-key lock 前开后闭区间。

1. 查找过程中访问到的对象才会加锁。

1. 具体执行的时候，是要分成间隙锁和行锁两段来执行的。

1. 索引上的等值查询，给唯一索引加锁的时候，next-key lock 退化为行锁。

1. 索引上的等值查询，向右遍历时且最后一个值不满足等值条件的时候，next-key lock 退化为间隙锁。

已知bug：唯一索引上的范围查询会访问到不满足条件的第一个值为止。

  

## 规则实践

## 注意

- 以下测试结果基于 mysql 5.7.25 默认使用 InnoDB 引擎, 隔离级别为可重复读;
  - mysql Ver 14.14 Distrib 

## 请在每次测试前重载数据

``` plain text
drop table z3;

CREATE TABLE `test`.`z3` (
  `id` INT NOT NULL,
  `b` INT NULL,
  `c` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `b` (`b` ASC));

INSERT INTO z3 (id, b, c)
VALUES (10, 10, 10),
  (30, 30, 30),
  (50, 50, 50),
  (70, 70, 70),
  (90, 90, 90);
```

表中数据如下:

``` plain text
mysql> select * from z3;
+----+------+------+
| id | b    | c    |
+----+------+------+
| 10 |   10 |   10 |
| 30 |   30 |   30 |
| 50 |   50 |   50 |
| 70 |   70 |   70 |
| 90 |   90 |   90 |
+----+------+------+
5 rows in set (0.00 sec)
```

  

## 等值查询中的间隙锁

在执行过程中，通过树搜索的方式定位记录的时候，用的是“等值查询”的方法。

Session 2 | Session 1 | 备注 | Index
---|---|---
 | `begin;` |  | 
 | `select * from z3 where id=45 for update;` | 在主键索引上加间隙锁 (30,50)
id=45 不存在 | 
`insert into z3 values (29,31,31);` |  | 正常执行 | 
`update z3 set b=b+1 where id = 30;` |  | 正常执行 | 
`insert into z3 values (31,31,31);` |  | __Blocked__ | 
`insert into z3 values (49,31,31);` |  | __Blocked__ | 
`update z3 set b=b+1 where id = 50;` |  | 正常执行 | 
`insert into z3 values (51,31,31);` |  | 正常执行 | 
 |  |  | 

## 非唯一索引等值间隙锁

Session 2 | Session 1 | 备注 | Index
---|---|---
 | `begin;` |  | 
 | `select * from z3 where b=45 for update;` | 在二级索引 `b` 上加上 间隙锁 (30,50)  | 
`insert into z3 values (29,29,0);` |  | 正常执行 | 
`insert into z3 values (28,30,0);` |  | 正常执行 | 
`update z3 set c=c+1 where b = 30;` |  | 正常执行 | 
`insert into z3 values (31,30,0);` |  | blocked | 
`insert into z3 values (27,31,0);` |  | blocked | 
`insert into z3 values (49,50,0);` |  | blocked | 
`update z3 set c=c+1 where b = 50;` |  | 正常执行 | 
`insert into z3 values (48,51,0);` |  | 正常执行 | 
`insert into z3 values (51,51,0);` |  | 正常执行 | 

  

  

## 主键索引范围锁

  

Session 2 | Session 1 | 执行结果 | 备注 | Index
---|---|---
 | `begin;` |  |  | 
 | `select * from z3 where id>45 and id < 55 for update;` | 在聚簇索引 `id` 上加上 next-key 锁 (30,50] 与 (50,70] |  | 
`insert into z3 values (29,29,0);` |  | 正常执行 | 检查左边界 | 
`insert into z3 values (28,30,0);` |  | 正常执行 |  | 
`update z3 set c=c+1 where b = 30;` |  | 正常执行 |  | 
`insert into z3 values (31,30,0);` |  | blocked |  | 
`insert into z3 values (49,50,0);` |  | blocked | 检查中间交界处 | 
`update z3 set c=c+1 where id=50;` |  | blocked |  | 
`insert into z3 values (51,50,0);` |  | blocked |  | 
`insert into z3 values (69,0,0);` |  | blocked | 检查右边界 | 
`insert into z3 values (70,0,0);` |  | blocked | 甚至没有触发主键重复, 就直接阻塞了 | 
`update z3 set c= c+1 where id =70;` |  | blocked |  | 
`insert into z3 values (71,0,11);` |  | 正常执行 |  | 
 |  |  |  | 
 |  |  |  | 
 |  |  |  | 

  

## 非唯一索引范围锁

  

Session 2 | Session 1 | 执行结果 | 备注 | Index
---|---|---
 | `begin;` |  |  | 
 | `select * from z3 where b > 45 and b < 55 for update;` | 在二级索引 b 上加上 next-key 锁 (30,50] 与 (50,70] |  | 
`insert into z3 values (29,29,0);` |  | 正常执行 | 检查左边界 | 
`insert into z3 values (28,30,0);` |  | 正常执行 |  | 
`update z3 set c=c+1 where b = 30;` |  | 正常执行 |  | 
`insert into z3 values (31,30,0);` |  | blocked |  | 
`insert into z3 values (49,50,0);` |  | blocked | 检查中间交界处 | 
`update z3 set c=c+1 where id=50;` |  | blocked |  | 
`insert into z3 values (51,50,0);` |  | blocked |  | 
`insert into z3 values (69,0,0);` |  | blocked | 检查右边界 | 
`insert into z3 values (70,0,0);` |  | blocked | 甚至没有触发主键重复, 就直接阻塞了 | 
`update z3 set c= c+1 where id =70;` |  | blocked |  | 
`insert into z3 values (71,0,11);` |  | 正常执行 |  | 
 |  |  |  | 
 |  |  |  | 
 |  |  |  | 

  

  

## 唯一索引范围锁中的 bug

  

Session 2 | Session 1 | 执行结果 | 备注 | Index
---|---|---
 | `begin;` |  |  | 
 | `select * from z3 where id>45 and id <= 50 for update;` | 在聚簇索引 `id` 上加上 next-key 锁 (30,50] , 但由于 mysql 的 bug 会再向后扫描一个记录, 而查找过程中访问到的对象才会加锁, 所以增大了锁范围 (50,70] |  | 
`insert into z3 values (29,29,0);` |  | 正常执行 | 检查左边界 | 
`insert into z3 values (28,30,0);` |  | 正常执行 |  | 
`update z3 set c=c+1 where b = 30;` |  | 正常执行 |  | 
`insert into z3 values (31,30,0);` |  | blocked |  | 
`insert into z3 values (49,50,0);` |  | blocked | 检查中间交界处 | 
`update z3 set c=c+1 where id=50;` |  | blocked |  | 
`insert into z3 values (51,50,0);` |  | blocked |  | 
`insert into z3 values (69,0,0);` |  | blocked | 检查右边界 | 
`insert into z3 values (70,0,0);` |  | blocked | 这里也没有触发主键重复, 就直接阻塞了 | 
`update z3 set c= c+1 where id =70;` |  | blocked |  | 
`insert into z3 values (71,0,11);` |  | 正常执行 |  | 
 |  |  |  | 
 |  |  |  | 
 |  |  |  | 

  

## insert 一条新记录

- insert 一条新记录的时候, 只会加行锁

- 但是如果没有进行 insert , 而是 



  

## 同语义的sql但是锁范围不一样

  

``` plain text
select * from z3 where id = 80 for update;
select * from z3 where id > 79 and id < 81 for update ;
```

  

## 间隙锁范围扩大

  



  

  

  

  

  
  