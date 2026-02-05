# 阶段一：项目初始化与环境搭建

## 目标

搭建完整的开发环境，确保项目可以正常运行，为后续开发打下坚实基础。

## 前置条件

在开始之前，请确保已安装以下工具：

- **Node.js**: v18.x 或更高版本（当前使用 v22.x）
- **npm**: 随 Node.js 一起安装
- **Docker**: 用于运行 PostgreSQL 数据库
- **Docker Compose**: 用于容器编排
- **Git**: 版本控制工具

验证安装：
```bash
node --version    # 应显示 v22.x.x
npm --version     # 应显示 npm 版本
docker --version  # 应显示 Docker 版本
docker-compose --version  # 应显示 Docker Compose 版本
git --version     # 应显示 Git 版本
```

---

## 步骤 1：Git 配置与 .gitignore

### 1.1 配置 .gitignore

创建 `.gitignore` 文件，防止敏感信息和不必要的文件被提交到版本控制。

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

### 1.2 初始提交

```bash
git add .gitignore
git commit -m "chore: 添加 .gitignore 配置"
```

---

## 步骤 2：Node.js 项目初始化

### 2.1 初始化 package.json

```bash
npm init -y
```

### 2.2 安装核心依赖

#### 生产依赖

```bash
npm install express @prisma/client dotenv cors helmet express-rate-limit bcryptjs jsonwebtoken multer
```

**依赖说明**：
- `express`: Web 框架
- `@prisma/client`: Prisma ORM 客户端
- `dotenv`: 环境变量管理
- `cors`: 跨域资源共享
- `helmet`: 安全头部设置
- `express-rate-limit`: 请求频率限制
- `bcryptjs`: 密码加密
- `jsonwebtoken`: JWT 生成和验证
- `multer`: 文件上传处理

#### 开发依赖

```bash
npm install -D typescript @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/multer ts-node-dev prisma eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-prettier
```

**依赖说明**：
- `typescript`: TypeScript 编译器
- `@types/*`: TypeScript 类型定义
- `ts-node-dev`: 开发时自动重启（支持 TypeScript）
- `prisma`: Prisma CLI 工具
- `eslint` 相关: 代码检查
- `prettier` 相关: 代码格式化

### 2.3 配置 package.json scripts

编辑 `package.json`，添加以下 scripts：

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

**Scripts 说明**：
- `dev`: 开发模式，自动重启
- `build`: 编译 TypeScript 到 JavaScript
- `start`: 生产模式启动
- `prisma:generate`: 生成 Prisma Client
- `prisma:migrate`: 运行数据库迁移
- `prisma:studio`: 打开 Prisma 可视化界面
- `lint`: 代码检查
- `lint:fix`: 自动修复代码问题
- `format`: 格式化代码

---

## 步骤 3：TypeScript 配置

### 3.1 创建 tsconfig.json

```bash
npx tsc --init
```

### 3.2 配置 tsconfig.json

编辑 `tsconfig.json`，使用以下配置：

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

**配置说明**：
- `target`: 编译目标 ES 版本
- `outDir`: 编译输出目录
- `rootDir`: 源代码根目录
- `strict`: 启用严格类型检查
- `sourceMap`: 生成 source map 便于调试

---

## 步骤 4：ESLint 和 Prettier 配置

### 4.1 创建 .eslintrc.json

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

### 4.2 创建 .prettierrc

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

### 4.3 创建 .eslintignore

```
node_modules
dist
coverage
*.config.js
```

---

## 步骤 5：环境变量配置

### 5.1 创建 .env 文件

在项目根目录创建 `.env` 文件：

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

**重要提示**：
- `JWT_SECRET` 必须在生产环境中更换为强密码
- 不要将 `.env` 文件提交到 Git
- `DATABASE_URL` 需要直接写入完整的连接字符串，不支持变量替换

### 5.2 创建 .env.example

创建 `.env.example` 作为模板（可以提交到 Git）：

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

---

## 步骤 6：Docker 环境配置

### 6.1 创建 docker-compose.yml

在项目根目录创建 `docker-compose.yml`：

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

**配置说明**：
- `image`: 使用 PostgreSQL 15 Alpine 版本（体积小）
- `ports`: 映射端口 5432
- `environment`: 数据库配置（从环境变量读取，有默认值）
- `volumes`: 数据持久化
- `networks`: 创建独立网络

### 6.2 启动 Docker 容器

```bash
docker-compose up -d
```

### 6.3 验证容器运行

```bash
docker-compose ps
```

应该看到 `practical-project-db` 容器状态为 `Up`。

### 6.4 测试数据库连接

```bash
docker exec -it practical-project-db psql -U postgres -d practical_project
```

成功连接后，输入 `\q` 退出。

---

## 步骤 7：Prisma 初始化

### 7.1 初始化 Prisma

```bash
npx prisma init
```

这会创建：
- `prisma/` 目录
- `prisma/schema.prisma` 文件

### 7.2 配置 schema.prisma

编辑 `prisma/schema.prisma`：

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

### 7.3 测试 Prisma 连接

```bash
npx prisma db push
```

如果成功，说明 Prisma 已经可以连接到数据库。

### 7.4 生成 Prisma Client

```bash
npm run prisma:generate
```

---

## 步骤 8：创建基础项目结构

### 8.1 创建目录结构

```bash
mkdir -p src/{config,controllers,services,repositories,middlewares,routes,utils,types}
mkdir -p uploads
mkdir -p logs
```

### 8.2 创建基础文件

#### src/index.ts（应用入口）

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

#### src/config/database.ts（数据库配置）

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
```

---

## 步骤 9：验证环境搭建

### 9.1 启动开发服务器

```bash
npm run dev
```

应该看到：
```
🚀 Server is running on http://localhost:3000
📝 Environment: development
```

### 9.2 测试健康检查接口

在浏览器或使用 curl 访问：

```bash
curl http://localhost:3000/health
```

应该返回：
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2026-02-05T..."
}
```

### 9.3 测试 TypeScript 编译

```bash
npm run build
```

检查 `dist/` 目录是否生成了编译后的 JavaScript 文件。

### 9.4 测试代码检查

```bash
npm run lint
```

### 9.5 测试 Prisma Studio

```bash
npm run prisma:studio
```

浏览器会自动打开 Prisma Studio 界面（http://localhost:5555）。

---

## 步骤 10：提交代码

### 10.1 查看变更

```bash
git status
```

### 10.2 添加文件

```bash
git add .
```

### 10.3 提交

```bash
git commit -m "chore: 完成项目初始化和环境搭建

- 配置 TypeScript、ESLint、Prettier
- 配置 Docker 和 PostgreSQL
- 初始化 Prisma
- 创建基础项目结构
- 添加健康检查接口"
```

---

## 阶段一完成检查清单

- [ ] Git 配置完成，.gitignore 已创建
- [ ] package.json 配置完成，所有依赖已安装
- [ ] TypeScript 配置完成，可以正常编译
- [ ] ESLint 和 Prettier 配置完成
- [ ] Docker 容器正常运行
- [ ] PostgreSQL 数据库可以连接
- [ ] 环境变量配置完成（.env 和 .env.example）
- [ ] Prisma 初始化完成，可以连接数据库
- [ ] 基础项目结构已创建
- [ ] 开发服务器可以正常启动
- [ ] 健康检查接口返回正常
- [ ] 代码已提交到 Git

---

## 常见问题

### Q1: Docker 容器启动失败

**解决方案**：
```bash
# 查看日志
docker-compose logs postgres

# 重启容器
docker-compose down
docker-compose up -d
```

### Q2: Prisma 无法连接数据库

**检查**：
1. Docker 容器是否运行：`docker-compose ps`
2. DATABASE_URL 是否正确配置
3. 端口 5432 是否被占用：`lsof -i :5432`

### Q3: TypeScript 编译错误

**解决方案**：
```bash
# 清理缓存
rm -rf node_modules dist
npm install
npm run build
```

### Q4: ts-node-dev 启动慢

**优化**：
在 package.json 中添加 `--transpile-only` 标志（已包含在配置中）。

---

## 下一步

完成阶段一后，进入 [阶段二：项目架构搭建](./phase-2.md)。
