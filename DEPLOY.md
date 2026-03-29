# 部署指南

本文档介绍如何将 Astro 站点部署到 GitHub Pages。

## 部署方式

本项目使用 **GitHub Actions** 自动构建并部署到 GitHub Pages。

## 前置条件

- GitHub 仓库已启用 Pages 功能
- 仓库包含 `pnpm-lock.yaml`（使用 pnpm 管理依赖）

## GitHub Pages 设置步骤

1. 进入仓库 **Settings → Pages → Build and deployment**

2. **Source** 选择 `GitHub Actions`

   > 不要选择 "Deploy from a branch"，那会使用 Jekyll 构建，导致 Astro 文件解析失败。

3. 确保存在 `.github/workflows/astro.yml` 工作流文件

4. 推送到 `master` 分支将自动触发部署

## 工作流说明

`.github/workflows/astro.yml` 执行以下步骤：

1. **检出代码** - 获取最新源码
2. **检测包管理器** - 自动识别 pnpm/yarn/npm
3. **设置 Node.js** - 使用 Node 20 并缓存依赖
4. **安装依赖** - 运行 `pnpm install`
5. **构建 Astro** - 生成静态站点到 `dist/` 目录
6. **上传产物** - 将构建结果作为 Pages 部署素材
7. **部署到 Pages** - 发布到 GitHub Pages

## 本地验证构建

在推送前，建议先在本地验证构建是否成功：

```bash
# 安装依赖
pnpm install

# 运行 Astro 检查
pnpm astro check

# 构建生产版本
pnpm build
```

构建成功后，产物位于 `dist/` 目录。

## 常见问题

### 1. 缓存依赖失败

**错误信息**：
```
Error: Some specified paths were not resolved, unable to cache dependencies.
```

**原因**：`actions/setup-node` 使用了错误的缓存配置，找不到 `package-lock.json`。

**解决**：确保 `astro.yml` 中的 `detect-package-manager` 步骤正确检测 `pnpm-lock.yaml`。如果已修复但仍报错，检查工作流文件是否最新。

---

### 2. Jekyll 构建错误

**错误信息**：
```
YAML Exception reading /github/workspace/src/... .astro
Invalid YAML front matter in /github/workspace/src/... .astro
```

**原因**：GitHub Pages 源设置为 "Deploy from a branch"，GitHub 使用 Jekyll 自动构建，但 Jekyll 无法解析 `.astro` 文件。

**解决**：
1. 进入 **Settings → Pages → Build and deployment**
2. 将 **Source** 改为 `GitHub Actions`
3. 重新触发部署（推送新提交或手动运行 workflow）

---

### 3. 部署后页面 404

**原因**：
- 首次启用 Pages 后需要几分钟生效
- `BASE_URL` 配置不正确

**解决**：
1. 等待 2-5 分钟后刷新
2. 检查 `astro.config.ts` 中的 `base` 配置是否与仓库名一致
3. 查看 Actions 运行状态确认部署成功

---

## 手动触发部署

如需手动重新部署：

1. 进入仓库 **Actions** 标签
2. 选择 **"Deploy Astro site to Pages"** 工作流
3. 点击 **Run workflow** → 选择分支 → **Run workflow**

## 部署地址

部署成功后，站点可通过以下地址访问：

```
https://<username>.github.io/<repository-name>/
```

如果是用户/组织站点（仓库名为 `<username>.github.io`），地址为：

```
https://<username>.github.io/
```
