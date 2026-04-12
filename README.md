<h1 align="center">
  Giraffe Tree 🦒
</h1>

<p align="center">
  记录思考与生活
</p>

<p align="center">
  <a href="https://giraffe-tree.github.io/">访问博客</a>
</p>

## 简介

这是一个基于 [Astro](https://astro.build) 构建的个人博客，使用 Astro Cactus 主题。用于记录技术学习、生活思考和日常笔记。

## 技术栈

- **Astro v6** - 静态站点生成器
- **Tailwind CSS v4** - 样式框架
- **MD & MDX** - 文章写作支持
- **Pagefind** - 站内搜索
- **Satori** - 自动生成 Open Graph 图片

## 目录

1. [快速开始](#快速开始)
2. [常用命令](#常用命令)
3. [配置说明](#配置说明)
4. [添加文章](#添加文章)
   - [文章 Frontmatter](#文章-frontmatter)
   - [笔记 Frontmatter](#笔记-frontmatter)
5. [搜索功能](#搜索功能)

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 `http://localhost:3000` 查看博客。

## 常用命令

| 命令 | 作用 |
| :--- | :--- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本到 `./dist/` |
| `pnpm postbuild` | 构建 Pagefind 搜索索引 |
| `pnpm preview` | 本地预览构建结果 |

## 配置说明

主要配置文件：`src/site.config.ts`

```typescript
export const siteConfig: SiteConfig = {
  url: "https://giraffe-tree.github.io/",
  title: "Giraffe Tree",
  author: "Giraffe Tree",
  description: "记录思考与生活",
  lang: "zh-CN",
  // ...
};
```

## 添加文章

### 文章

将 `.md` 或 `.mdx` 文件放入 `src/content/post/` 目录。

### 笔记

将 `.md` 或 `.mdx` 文件放入 `src/content/note/` 目录。

### 文章 Frontmatter

| 属性 | 说明 |
| ---- | ---- |
| `title` | 文章标题（必填） |
| `description` | SEO 描述（必填） |
| `publishDate` | 发布日期（必填） |
| `updatedDate` | 更新日期（可选） |
| `tags` | 标签数组（可选） |
| `coverImage` | 封面图配置（可选） |
| `draft` | 草稿标记（可选，默认 false） |

示例：

```yaml
---
title: "文章标题"
description: "文章简介"
publishDate: 2026-04-12
tags: ["astro", "blog"]
---
```

### 笔记 Frontmatter

| 属性 | 说明 |
| ---- | ---- |
| `title` | 笔记标题（必填） |
| `description` | 描述（可选） |
| `publishDate` | 发布日期（必填） |

## 搜索功能

使用 [Pagefind](https://pagefind.app/) 实现站内搜索。搜索索引在构建时自动生成，需要运行 `pnpm postbuild` 来创建。

---

<p align="center">
  <a href="https://giraffe-tree.github.io/">🦒 Giraffe Tree</a>
</p>
