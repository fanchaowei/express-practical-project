# 阶段一：项目初始化与环境搭建 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 从零开始搭建完整的 Express.js + TypeScript + Prisma + PostgreSQL 开发环境，创建基础项目结构，确保所有工具链正常工作。

**架构:** 采用标准的 Node.js 项目结构，使用 TypeScript 进行类型安全开发，Docker Compose 管理 PostgreSQL 数据库，Prisma 作为 ORM，配置完整的代码质量工具链（ESLint + Prettier）。

**技术栈:** Express.js, TypeScript, Prisma, PostgreSQL, Docker, ESLint, Prettier

---

## Task 1: Git 配置与 .gitignore

**文件:**
- Create: `.gitignore`

**Step 1: 创建 .gitignore 文件**

创建 `.gitignore` 文件，内容如下：

```gitignore
# 依赖
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 环境变量
.env
.env.local
.env.*.local

# 构建产物
dist/
build/
*.tsbuildinfo

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# 操作系统
.DS_Store
Thumbs.db

# 日志
logs/
*.log

# 测试覆盖率
coverage/
.nyc_output/

# 上传文件（开发阶段）
uploads/
```

**Step 2: 验证 .gitignore 创建**

运行: `cat .gitignore`
预期: 显示文件内容

**Step 3: 提交 .gitignore**

```bash
git add .gitignore
git commit -m "chore: 添加 .gitignore 配置"
```

---

## Task 2: 初始化 Node.js 项目

**文件:**
- Create: `package.json`

**Step 1: 初始化 package.json**

运行: `npm init -y`
预期: 创建默认的 package.json 文件

**Step 2: 验证 package.json 创建**

运行: `cat package.json`
预期: 显示 JSON 配置文件

**Step 3: 提交初始 package.json**

```bash
git add package.json
git commit -m "chore: 初始化 Node.js 项目"
```

---

## Task 3: 安装生产依赖

**文件:**
- Modify: `package.json`
- Create: `package-lock.json`

**Step 1: 安装生产依赖**

运行:
```bash
npm install express @prisma/client dotenv cors helmet express-rate-limit bcryptjs jsonwebtoken multer
```

预期: 依赖安装成功，package.json 更新

**Step 2: 验证依赖安装**

运行: `npm list --depth=0`
预期: 显示已安装的生产依赖

**Step 3: 提交依赖变更**

```bash
git add package.json package-lock.json
git commit -m "chore: 安装生产依赖

- express: Web 框架
- @prisma/client: Prisma ORM 客户端
- dotenv: 环境变量管理
- cors: 跨域资源共享
- helmet: 安全头部设置
- express-rate-limit: 请求频率限制
- bcryptjs: 密码加密
- jsonwebtoken: JWT 生成和验证
- multer: 文件上传处理"
```

---

## Task 4: 安装开发依赖

**文件:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: 安装开发依赖**

运行:
```bash
npm install -D typescript @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/multer ts-node-dev prisma eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-prettier
```

预期: 开发依赖安装成功

**Step 2: 验证依赖安装**

运行: `npm list --depth=0`
预期: 显示所有依赖（包括 devDependencies）

**Step 3: 提交开发依赖**

```bash
git add package.json package-lock.json
git commit -m "chore: 安装开发依赖

- typescript: TypeScript 编译器
- @types/*: TypeScript 类型定义
- ts-node-dev: 开发时自动重启
- prisma: Prisma CLI 工具
- eslint 相关: 代码检查
- prettier 相关: 代码格式化"
```

---

## Task 5: 配置 package.json scripts

**文件:**
- Modify: `package.json`

**Step 1: 添加 scripts 配置**

在 package.json 中添加 scripts 字段：

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```

**Step 2: 验证 scripts 配置**

运行: `npm run`
预期: 显示所有可用的 npm scripts

**Step 3: 提交 scripts 配置**

```bash
git add package.json
git commit -m "chore: 配置 npm scripts

- dev: 开发模式，自动重启
- build: 编译 TypeScript
- start: 生产模式启动
- prisma:*: Prisma 相关命令
- lint/format: 代码质量工具"
```

---

## Task 6: 配置 TypeScript

**文件:**
- Create: `tsconfig.json`

**Step 1: 初始化 TypeScript 配置**

运行: `npx tsc --init`
预期: 创建 tsconfig.json 文件

**Step 2: 替换 tsconfig.json 内容**

将 tsconfig.json 替换为以下配置：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: 验证 TypeScript 配置**

运行: `cat tsconfig.json`
预期: 显示配置内容

**Step 4: 提交 TypeScript 配置**

```bash
git add tsconfig.json
git commit -m "chore: 配置 TypeScript

- 严格模式
- 源码映射
- ES2020 目标
- CommonJS 模块"
```

---

## Task 7: 配置 ESLint

**文件:**
- Create: `.eslintrc.json`
- Create: `.eslintignore`

**Step 1: 创建 .eslintrc.json**

创建 `.eslintrc.json` 文件：

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "warn"
  }
}
```

**Step 2: 创建 .eslintignore**

创建 `.eslintignore` 文件：

```
node_modules
dist
coverage
*.config.js
```

**Step 3: 验证 ESLint 配置**

运行: `cat .eslintrc.json`
预期: 显示 ESLint 配置

**Step 4: 提交 ESLint 配置**

```bash
git add .eslintrc.json .eslintignore
git commit -m "chore: 配置 ESLint

- TypeScript 支持
- Prettier 集成
- 自定义规则"
```

---

## Task 8: 配置 Prettier

**文件:**
- Create: `.prettierrc`

**Step 1: 创建 .prettierrc**

创建 `.prettierrc` 文件：

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Step 2: 验证 Prettier 配置**

运行: `cat .prettierrc`
预期: 显示 Prettier 配置

**Step 3: 提交 Prettier 配置**

```bash
git add .prettierrc
git commit -m "chore: 配置 Prettier

- 单引号
- 分号
- 行宽 100
- 2 空格缩进"
```

---

## Task 9: 配置环境变量

**文件:**
- Create: `.env`
- Create: `.env.example`

**Step 1: 创建 .env 文件**

创建 `.env` 文件：

```env
# 应用配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=practical_project

# Prisma 数据库连接
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/practical_project?schema=public"

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

**Step 2: 创建 .env.example**

创建 `.env.example` 文件（模板）：

```env
# 应用配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=practical_project

# Prisma 数据库连接
DATABASE_URL="postgresql://postgres:your_password_here@localhost:5432/practical_project?schema=public"

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

**Step 3: 验证环境变量文件**

运行: `cat .env.example`
预期: 显示模板内容

**Step 4: 提交 .env.example**

```bash
git add .env.example
git commit -m "chore: 添加环境变量模板

- 应用配置
- 数据库连接
- JWT 配置
- 文件上传配置"
```

注意: .env 文件不应提交到 Git（已在 .gitignore 中）

---

## Task 10: 配置 Docker Compose

**文件:**
- Create: `docker-compose.yml`

**Step 1: 创建 docker-compose.yml**

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: practical-project-db
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-practical_project}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

volumes:
  postgres_data:
    driver: local

networks:
  app-network:
    driver: bridge
```

**Step 2: 验证 Docker Compose 配置**

运行: `cat docker-compose.yml`
预期: 显示 Docker 配置

**Step 3: 提交 Docker 配置**

```bash
git add docker-compose.yml
git commit -m "chore: 配置 Docker Compose

- PostgreSQL 15 Alpine
- 数据持久化
- 端口映射 5432
- 独立网络"
```

---

## Task 11: 启动 Docker 容器

**文件:**
- None (运行时操作)

**Step 1: 启动 Docker 容器**

运行: `docker-compose up -d`
预期: 容器启动成功

**Step 2: 验证容器状态**

运行: `docker-compose ps`
预期: 显示 practical-project-db 容器状态为 Up

**Step 3: 测试数据库连接**

运行: `docker exec -it practical-project-db psql -U postgres -d practical_project`
预期: 成功连接到数据库

在 psql 中运行: `\l`
预期: 显示数据库列表

退出 psql: `\q`

---

## Task 12: 初始化 Prisma

**文件:**
- Create: `prisma/schema.prisma`

**Step 1: 初始化 Prisma**

运行: `npx prisma init`
预期: 创建 prisma 目录和 schema.prisma 文件

**Step 2: 配置 schema.prisma**

编辑 `prisma/schema.prisma`，替换为：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 后续会在这里添加数据模型
```

**Step 3: 测试 Prisma 连接**

运行: `npx prisma db push`
预期: 成功连接到数据库

**Step 4: 生成 Prisma Client**

运行: `npm run prisma:generate`
预期: Prisma Client 生成成功

**Step 5: 提交 Prisma 配置**

```bash
git add prisma/schema.prisma
git commit -m "chore: 初始化 Prisma ORM

- 配置 PostgreSQL 数据源
- 生成 Prisma Client"
```

---

## Task 13: 创建项目目录结构

**文件:**
- Create: `src/` (目录)
- Create: `uploads/` (目录)
- Create: `logs/` (目录)

**Step 1: 创建目录结构**

运行:
```bash
mkdir -p src/{config,controllers,services,repositories,middlewares,routes,utils,types}
mkdir -p uploads
mkdir -p logs
```

预期: 目录创建成功

**Step 2: 验证目录结构**

运行: `tree -L 2 -d src`
或: `find src -type d`

预期: 显示完整的目录结构

**Step 3: 创建 .gitkeep 保持空目录**

运行:
```bash
touch src/config/.gitkeep
touch src/controllers/.gitkeep
touch src/services/.gitkeep
touch src/repositories/.gitkeep
touch src/middlewares/.gitkeep
touch src/routes/.gitkeep
touch src/utils/.gitkeep
touch src/types/.gitkeep
touch uploads/.gitkeep
touch logs/.gitkeep
```

**Step 4: 提交目录结构**

```bash
git add src/ uploads/.gitkeep logs/.gitkeep
git commit -m "chore: 创建项目目录结构

- src/config: 配置文件
- src/controllers: 控制器层
- src/services: 业务逻辑层
- src/repositories: 数据访问层
- src/middlewares: 中间件
- src/routes: 路由定义
- src/utils: 工具函数
- src/types: 类型定义
- uploads: 文件上传目录
- logs: 日志目录"
```

---

## Task 14: 创建数据库配置文件

**文件:**
- Create: `src/config/database.ts`

**Step 1: 创建 database.ts**

创建 `src/config/database.ts` 文件：

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
```

**Step 2: 验证文件创建**

运行: `cat src/config/database.ts`
预期: 显示数据库配置代码

**Step 3: 提交数据库配置**

```bash
git add src/config/database.ts
git commit -m "feat: 添加数据库配置

- 初始化 Prisma Client
- 开发环境启用查询日志"
```

---

## Task 15: 创建应用入口文件

**文件:**
- Create: `src/index.ts`

**Step 1: 创建 index.ts**

创建 `src/index.ts` 文件：

```typescript
import express from 'express';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 测试路由
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});
```

**Step 2: 验证文件创建**

运行: `cat src/index.ts`
预期: 显示应用入口代码

**Step 3: 提交应用入口**

```bash
git add src/index.ts
git commit -m "feat: 添加应用入口文件

- Express 应用初始化
- 基础中间件配置
- 健康检查路由
- 环境变量加载"
```

---

## Task 16: 测试开发服务器

**文件:**
- None (运行时测试)

**Step 1: 启动开发服务器**

运行: `npm run dev`

预期输出:
```
🚀 Server is running on http://localhost:3000
📝 Environment: development
```

**Step 2: 测试健康检查接口**

在新终端运行: `curl http://localhost:3000/health`

预期输出:
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2026-02-14T..."
}
```

**Step 3: 停止开发服务器**

在原终端按 `Ctrl+C` 停止服务器

---

## Task 17: 测试 TypeScript 编译

**文件:**
- Create: `dist/` (编译输出)

**Step 1: 编译 TypeScript**

运行: `npm run build`
预期: 编译成功，无错误

**Step 2: 验证编译输出**

运行: `ls -la dist/`
预期: 显示编译后的 JavaScript 文件

运行: `cat dist/index.js | head -20`
预期: 显示编译后的代码

**Step 3: 测试编译后的代码**

运行: `npm start`
预期: 服务器启动成功

在新终端测试: `curl http://localhost:3000/health`
预期: 返回正常响应

停止服务器: `Ctrl+C`

---

## Task 18: 测试代码质量工具

**文件:**
- None (代码检查)

**Step 1: 运行 ESLint 检查**

运行: `npm run lint`
预期: 可能有警告（no-console），但无错误

**Step 2: 运行 Prettier 格式化**

运行: `npm run format`
预期: 代码格式化完成

**Step 3: 再次运行 lint**

运行: `npm run lint`
预期: 确认代码符合规范

---

## Task 19: 测试 Prisma Studio

**文件:**
- None (UI 工具)

**Step 1: 启动 Prisma Studio**

运行: `npm run prisma:studio`
预期: 浏览器自动打开 http://localhost:5555

**Step 2: 验证 Prisma Studio**

在浏览器中:
- 检查是否能看到数据库连接
- 确认没有数据表（因为还没有定义模型）

**Step 3: 关闭 Prisma Studio**

在终端按 `Ctrl+C` 停止 Prisma Studio

---

## Task 20: 最终验证和文档

**文件:**
- Create: `docs/plans/phase-1-completion-checklist.md`

**Step 1: 创建完成清单**

创建 `docs/plans/phase-1-completion-checklist.md`：

```markdown
# 阶段一完成检查清单

## 环境验证

- [x] Node.js v22.x 已安装
- [x] Docker 和 Docker Compose 已安装
- [x] Git 已配置

## 项目配置

- [x] Git 配置完成，.gitignore 已创建
- [x] package.json 配置完成，所有依赖已安装
- [x] TypeScript 配置完成，可以正常编译
- [x] ESLint 和 Prettier 配置完成

## Docker 和数据库

- [x] Docker 容器正常运行
- [x] PostgreSQL 数据库可以连接
- [x] 环境变量配置完成（.env 和 .env.example）

## Prisma

- [x] Prisma 初始化完成，可以连接数据库
- [x] Prisma Client 生成成功
- [x] Prisma Studio 可以正常打开

## 项目结构

- [x] 基础项目结构已创建
- [x] 所有必要目录已建立
- [x] 数据库配置文件已创建
- [x] 应用入口文件已创建

## 功能测试

- [x] 开发服务器可以正常启动
- [x] 健康检查接口返回正常
- [x] TypeScript 编译成功
- [x] 生产模式启动正常
- [x] 代码检查工具正常工作

## 版本控制

- [x] 所有变更已提交到 Git
- [x] 提交信息符合规范
- [x] 敏感信息未提交（.env）

## 完成时间

- 开始时间: ___________
- 完成时间: ___________
- 总耗时: ___________

## 下一步

进入 [阶段二：项目架构搭建](./phase-2.md)
```

**Step 2: 提交完成清单**

```bash
git add docs/plans/phase-1-completion-checklist.md
git commit -m "docs: 添加阶段一完成检查清单"
```

**Step 3: 查看所有提交**

运行: `git log --oneline`
预期: 显示所有完成的提交记录

---

## Task 21: 清理和最终提交

**文件:**
- None

**Step 1: 清理构建产物**

运行: `rm -rf dist/`
预期: 删除编译输出（不提交到 Git）

**Step 2: 查看 Git 状态**

运行: `git status`
预期: 工作区干净，所有变更已提交

**Step 3: 创建最终总结提交**

如果有未提交的小改动，统一提交：

```bash
git add .
git commit -m "chore: 完成阶段一项目初始化

阶段一所有任务已完成：
- ✅ Git 和依赖配置
- ✅ TypeScript 和代码质量工具
- ✅ Docker 和 PostgreSQL
- ✅ Prisma ORM
- ✅ 项目目录结构
- ✅ 基础应用入口
- ✅ 所有功能测试通过

下一步: 进入阶段二 - 项目架构搭建"
```

---

## 验证命令总结

完成所有任务后，运行以下命令进行最终验证：

```bash
# 1. 检查 Docker 容器
docker-compose ps

# 2. 检查依赖安装
npm list --depth=0

# 3. 编译 TypeScript
npm run build

# 4. 启动开发服务器
npm run dev

# 5. 测试健康检查（新终端）
curl http://localhost:3000/health

# 6. 停止服务器
# Ctrl+C

# 7. 运行代码检查
npm run lint

# 8. 查看 Git 提交记录
git log --oneline

# 9. 查看 Git 状态
git status
```

所有命令都应该成功执行，无错误输出。

---

## 常见问题排查

### Docker 容器无法启动
```bash
# 查看日志
docker-compose logs postgres

# 重启容器
docker-compose down
docker-compose up -d
```

### 端口被占用
```bash
# 检查端口占用
lsof -i :3000  # Express 端口
lsof -i :5432  # PostgreSQL 端口

# 修改 .env 中的 PORT 配置
```

### Prisma 无法连接
```bash
# 验证 DATABASE_URL 配置
cat .env | grep DATABASE_URL

# 测试数据库连接
docker exec -it practical-project-db psql -U postgres -l
```

### TypeScript 编译错误
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 清理编译缓存
rm -rf dist/
npm run build
```

---

## 预计时间

- **总任务数**: 21 个任务
- **预计总时间**: 45-60 分钟
  - 配置文件创建: 15-20 分钟
  - 依赖安装: 10-15 分钟
  - Docker 和数据库: 10-15 分钟
  - 测试验证: 10-15 分钟

---

## 成功标准

阶段一成功完成的标准：

1. ✅ 所有配置文件已创建并正确配置
2. ✅ Docker 容器运行正常
3. ✅ PostgreSQL 可以连接
4. ✅ Prisma 可以连接数据库
5. ✅ 开发服务器可以启动
6. ✅ 健康检查接口正常响应
7. ✅ TypeScript 编译无错误
8. ✅ ESLint 检查通过
9. ✅ 所有变更已提交到 Git
10. ✅ 项目目录结构完整

完成后，项目已具备：
- 完整的开发环境
- 类型安全的 TypeScript 配置
- 规范的代码质量工具链
- 可运行的 Express 服务器
- 可连接的 PostgreSQL 数据库
- 清晰的项目结构

可以进入阶段二的项目架构搭建！
