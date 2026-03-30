#!/usr/bin/env node
/**
 * 迁移 Jekyll 文章到 Astro 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = '/Users/giraffetree/Documents/giraffetree/project/code/ideas/blog-posts/_posts';
const TARGET_DIR = '/Users/giraffetree/Documents/giraffetree/project/code/ideas/giraffe-tree.github.io/src/content/post';
const SOURCE_IMG_DIR = '/Users/giraffetree/Documents/giraffetree/project/code/ideas/blog-posts/img';
const TARGET_IMG_DIR = '/Users/giraffetree/Documents/giraffetree/project/code/ideas/giraffe-tree.github.io/public/img/blog';

// 月份名称映射
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 解析 Jekyll frontmatter
 */
function parseJekyllFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatterText = match[1];
  const body = match[2];

  // 解析 YAML frontmatter
  const frontmatter = {};
  const lines = frontmatterText.split('\n');
  let currentKey = null;
  let currentList = null;

  for (const line of lines) {
    // 列表项
    if (line.trim().startsWith('- ') && currentKey) {
      if (!currentList) {
        currentList = [];
        frontmatter[currentKey] = currentList;
      }
      currentList.push(line.trim().substring(2).trim());
      continue;
    }

    // 键值对
    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      currentKey = keyValueMatch[1];
      currentList = null;
      let value = keyValueMatch[2].trim();

      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      frontmatter[currentKey] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * 转换日期格式
 */
function convertDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * 从文件名提取 slug 和日期
 */
function parseFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!match) return null;

  return {
    date: match[1],
    slug: match[2]
  };
}

/**
 * 转换为 Astro frontmatter
 */
function convertToAstroFrontmatter(jekyllFrontmatter, filename) {
  const { date, slug } = parseFilename(filename);
  const publishDate = convertDate(jekyllFrontmatter.date || date);

  // 转换 tags
  let tags = [];
  if (jekyllFrontmatter.tags) {
    if (Array.isArray(jekyllFrontmatter.tags)) {
      tags = jekyllFrontmatter.tags;
    } else if (typeof jekyllFrontmatter.tags === 'string') {
      tags = jekyllFrontmatter.tags.split(/[\s,]+/).filter(Boolean);
    }
  }

  // 构建 description（使用 subtitle 或截取正文）
  let description = jekyllFrontmatter.subtitle || '';
  if (!description && jekyllFrontmatter.excerpt) {
    description = jekyllFrontmatter.excerpt;
  }

  return {
    title: jekyllFrontmatter.title || 'Untitled',
    description: description,
    publishDate: publishDate,
    tags: tags.length > 0 ? tags : undefined
  };
}

/**
 * 序列化 Astro frontmatter
 */
function serializeAstroFrontmatter(frontmatter) {
  const lines = ['---'];

  lines.push(`title: "${frontmatter.title}"`);

  if (frontmatter.description) {
    lines.push(`description: "${frontmatter.description}"`);
  }

  lines.push(`publishDate: "${frontmatter.publishDate}"`);

  if (frontmatter.tags && frontmatter.tags.length > 0) {
    lines.push(`tags: ["${frontmatter.tags.join('", "')}"]`);
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * 处理文章内容中的图片路径
 */
function processImagePaths(body, slug) {
  // 转换 ![](img/...) 为 ![](~/assets/img/blog/...)
  // 保留相对路径，我们稍后会复制图片
  return body;
}

/**
 * 迁移单篇文章
 */
function migratePost(filename) {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const content = fs.readFileSync(sourcePath, 'utf-8');

  const parsed = parseJekyllFrontmatter(content);
  if (!parsed) {
    console.log(`⚠️  跳过 ${filename}: 无法解析 frontmatter`);
    return null;
  }

  const { frontmatter, body } = parsed;
  const { slug } = parseFilename(filename);

  // 创建目标目录
  const targetPostDir = path.join(TARGET_DIR, slug);
  if (!fs.existsSync(targetPostDir)) {
    fs.mkdirSync(targetPostDir, { recursive: true });
  }

  // 转换 frontmatter
  const astroFrontmatter = convertToAstroFrontmatter(frontmatter, filename);
  const newFrontmatter = serializeAstroFrontmatter(astroFrontmatter);
  const newBody = processImagePaths(body, slug);

  // 写入新文件
  const targetPath = path.join(targetPostDir, 'index.md');
  const newContent = `${newFrontmatter}\n${newBody}`;
  fs.writeFileSync(targetPath, newContent, 'utf-8');

  console.log(`✅ 已迁移: ${filename} -> ${targetPath}`);

  return {
    slug,
    originalHeaderImg: frontmatter['header-img'],
    targetDir: targetPostDir
  };
}

/**
 * 复制图片资源
 */
function copyImages(migratedPosts) {
  // 确保目标图片目录存在
  if (!fs.existsSync(TARGET_IMG_DIR)) {
    fs.mkdirSync(TARGET_IMG_DIR, { recursive: true });
  }

  // 复制所有图片
  function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ 已复制图片: ${srcPath} -> ${destPath}`);
      }
    }
  }

  copyDirRecursive(SOURCE_IMG_DIR, TARGET_IMG_DIR);
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始迁移文章...\n');

  // 确保目标目录存在
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 获取所有文章
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`📚 发现 ${files.length} 篇文章\n`);

  const migratedPosts = [];

  for (const filename of files) {
    try {
      const result = migratePost(filename);
      if (result) migratedPosts.push(result);
    } catch (error) {
      console.error(`❌ 迁移失败 ${filename}:`, error.message);
    }
  }

  console.log(`\n📦 开始复制图片资源...`);
  copyImages(migratedPosts);

  console.log(`\n✨ 迁移完成！共迁移 ${migratedPosts.length} 篇文章`);
}

main();
