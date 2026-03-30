---
title: "IOC / DI / DIP 小记"
description: "ioc"
publishDate: "6 Jan 2021"
tags: ["写作", "编程思想"]
---

# IOC / DI / DIP 小记

- 题图为川西某个雨后朦胧的山

## Survey

- 理解 IOC / DI / DIP 究竟是什么 ?

## Question

1. IOC ( Inversion Of Control ) 控制反转是什么?  
2. DI ( Dependency Injection ) 依赖注入是什么? 
3. 依赖注入框架（DI Framework）是什么 ?  为什么要有依赖注入框架 ? 
4. DIP ( Dependency Inversion Principle ) 依赖倒置(反转)原则是什么?
5. 控制反转、依赖倒置、依赖注入，这三者有何区别和联系？
6. 基于接口进行 依赖注入 有什么好处? 

## Read

### IOC ( Inversion Of Control ) 是什么? 控制反转是什么?

控制反转是一个比较笼统的设计思想，并不是一种具体的实现方法，一般用来指导框架层面的设计

> 框架提供了一个可扩展的代码骨架，用来组装对象、管理整个执行流程。程序员利用框架进行开发的时候，只需要往预留的扩展点上，添加跟自己业务相关的代码，就可以利用框架来驱动整个程序流程的执行。

> 这里的“控制”指的是对程序执行流程的控制，而“反转”指的是在没有使用框架之前，程序员自己控制整个程序的执行。**在使用框架之后，整个程序的执行流程可以通过框架来控制。流程的控制权从程序员“反转”到了框架。**

### DI ( Dependency Injection ) 依赖注入是什么?

依赖注入和控制反转恰恰相反，它是一种具体的编码技巧。

> **不**通过 new() 的方式**在 类内部 创建依赖类对象**，而是将依赖的类对象在外部创建好之后，通过构造函数、函数参数等方式传递（或注入）给类使用。

### 依赖注入框架（DI Framework）是什么 ?  为什么要有依赖注入框架 ?

DI framework 具体的实现中有 Java 中的 Spring framework 等, 由 DI 框架来自动创建对象、管理对象的生命周期、依赖注入等原本需要程序员来做的事情。

> 在实际的软件开发中，一些项目可能会涉及几十、上百、甚至几百个类，类对象的创建和依赖注入会变得非常复杂。如果这部分工作都是靠程序员自己写代码来完成，容易出错且开发成本也比较高。而对象创建和依赖注入的工作，本身跟具体的业务无关，我们完全可以抽象成框架来自动完成。而这个框架就是 **依赖注入框架**

### DIP ( Dependency Inversion Principle ) 依赖倒置(反转)原则是什么?

依赖倒置原则通俗说就是，高层模块不依赖低层模块，而是都依赖抽象接口，这个抽象接口通常是由高层模块定义，低层模块实现。

- Don’t call me，I will call you.
- 依赖倒置强调：接口使用者定义接口，而不是接口实现者定义接口。

> Tomcat 是运行 Java Web 应用程序的容器。我们编写的 Web 应用程序代码只需要部署在 Tomcat 容器下，便可以被 Tomcat 容器调用执行。按照之前的划分原则，Tomcat 就是高层模块，我们编写的 Web 应用程序代码就是低层模块。**Tomcat 和应用程序代码之间并没有直接的依赖关系，两者都依赖同一个“抽象”，也就是 Servlet 规范。**Servlet 规范不依赖具体的 Tomcat 容器和应用程序的实现细节，而 Tomcat 容器和应用程序依赖 Servlet 规范。

### 控制反转、依赖反转(倒置)、依赖注入，这三者有何区别和联系？

不看上面的内容, 请复述

### 基于接口进行 依赖注入 有什么好处?

1. 联想到 开闭原则, 提高了可扩展性

## Recite

## Review

## 参考

1. SOLID  - 依赖反转
    1. [https://time.geekbang.org/column/article/177444](https://time.geekbang.org/column/article/177444)
    2. Don't call me , I will call you  好莱坞原则
    3. 这里的“控制”指的是对程序执行流程的控制，而“反转”指的是在没有使用框架之前，程序员自己控制整个程序的执行。**在使用框架之后，整个程序的执行流程可以通过框架来控制。流程的控制权从程序员“反转”到了框架**。
2. spring 与 IOC 
    1. 参考 spring-core 官方文档 [https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#spring-core](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#spring-core) 
    2. Foremost amongst these is the Spring Framework’s Inversion of Control (IoC) container.
    3. spring 框架中, 最重要的技术就是 IOC 容器
3. **相对于细节的多变性,抽象的东西要稳定的多**