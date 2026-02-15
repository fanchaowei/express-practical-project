# 项目架构搭建实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建完整的三层架构基础设施，包括统一的错误处理、响应格式和中间件配置

**Architecture:** 采用 Controller-Service-Repository 三层架构模式，确保职责分离。Controller 处理 HTTP 请求，Service 实现业务逻辑，Repository 负责数据访问。通过统一的错误处理和响应格式提升代码一致性和可维护性。

**Tech Stack:** Express.js, TypeScript, Prisma, Helmet (安全), CORS

**参考文档:** [docs/plan/phase-2.md](../plan/phase-2.md)

---

## Task 1: 创建环境配置文件

**Files:**
- Create: `src/config/env.ts`
- Create: `.env.example`
- Modify: `src/config/database.ts`

**Step 1: 创建环境变量配置**

在 `src/config/env.ts` 中创建：

```typescript
import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  UPLOAD_DIR: string;
  MAX_FILE_SIZE: number;
}

const getEnvConfig = (): EnvConfig => {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  };
};

export const env = getEnvConfig();

// 验证必需的环境变量
export const validateEnv = () => {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
};
```

**Step 2: 创建 .env.example 模板**

创建 `.env.example` 文件：

```bash
# 应用配置
NODE_ENV=development
PORT=3000

# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# JWT 配置
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

**Step 3: 更新数据库配置**

修改 `src/config/database.ts`：

```typescript
import { PrismaClient } from '@prisma/client';
import { env } from './env';

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 测试数据库连接
export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// 优雅关闭数据库连接
export const disconnectDatabase = async () => {
  await prisma.$disconnect();
  console.log('Database disconnected');
};

export default prisma;
```

**Step 4: 提交配置文件**

```bash
git add src/config/env.ts src/config/database.ts .env.example
git commit -m "feat: 添加环境变量配置和验证

- 实现环境变量类型定义
- 添加必需变量验证
- 创建 .env.example 模板
- 更新数据库配置，支持连接测试"
```

---

## Task 2: 创建类型定义

**Files:**
- Create: `src/types/response.ts`
- Create: `src/types/error.ts`
- Create: `src/types/index.ts`

**Step 1: 创建响应类型定义**

在 `src/types/response.ts` 中：

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}
```

**Step 2: 创建错误类型定义**

在 `src/types/error.ts` 中：

```typescript
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
```

**Step 3: 创建类型导出文件**

在 `src/types/index.ts` 中：

```typescript
export * from './response';
export * from './error';
```

**Step 4: 提交类型定义**

```bash
git add src/types/
git commit -m "feat: 添加 TypeScript 类型定义

- 添加统一响应格式类型
- 添加自定义错误类型（AppError 及子类）
- 统一导出所有类型"
```

---

## Task 3: 创建工具函数

**Files:**
- Create: `src/utils/response.ts`
- Create: `src/utils/logger.ts`
- Create: `src/utils/asyncHandler.ts`

**Step 1: 创建响应工具函数**

在 `src/utils/response.ts` 中：

```typescript
import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export class ResponseUtil {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string = 'Error',
    statusCode: number = 500,
    error?: string
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Success'
  ): Response {
    const response: PaginatedResponse<T> = {
      success: true,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(200).json(response);
  }
}
```

**Step 2: 创建日志工具**

在 `src/utils/logger.ts` 中：

```typescript
import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (meta) {
      console[level](logMessage, meta);
    } else {
      console[level](logMessage);
    }
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: any) {
    if (env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }
}

export const logger = new Logger();
```

**Step 3: 创建异步错误处理包装器**

在 `src/utils/asyncHandler.ts` 中：

```typescript
import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

**Step 4: 提交工具函数**

```bash
git add src/utils/
git commit -m "feat: 添加工具函数

- 实现统一响应工具（成功、错误、分页）
- 实现日志工具（info、warn、error、debug）
- 实现异步错误处理包装器"
```

---

## Task 4: 创建中间件

**Files:**
- Create: `src/middlewares/errorHandler.ts`
- Create: `src/middlewares/notFound.ts`
- Create: `src/middlewares/requestLogger.ts`
- Create: `src/middlewares/index.ts`

**Step 1: 创建错误处理中间件**

在 `src/middlewares/errorHandler.ts` 中：

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { env } from '../config/env';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 处理自定义错误
  if (err instanceof AppError) {
    return ResponseUtil.error(
      res,
      err.message,
      err.statusCode,
      env.NODE_ENV === 'development' ? err.stack : undefined
    );
  }

  // 处理 Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    return ResponseUtil.error(res, 'Database error', 400);
  }

  // 处理验证错误
  if (err.name === 'ValidationError') {
    return ResponseUtil.error(res, err.message, 400);
  }

  // 默认错误
  return ResponseUtil.error(
    res,
    'Internal server error',
    500,
    env.NODE_ENV === 'development' ? err.message : undefined
  );
};
```

**Step 2: 创建 404 处理中间件**

在 `src/middlewares/notFound.ts` 中：

```typescript
import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../types';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};
```

**Step 3: 创建请求日志中间件**

在 `src/middlewares/requestLogger.ts` 中：

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
};
```

**Step 4: 创建中间件导出文件**

在 `src/middlewares/index.ts` 中：

```typescript
export * from './errorHandler';
export * from './notFound';
export * from './requestLogger';
```

**Step 5: 提交中间件**

```bash
git add src/middlewares/
git commit -m "feat: 添加全局中间件

- 实现统一错误处理中间件
- 实现 404 路由处理中间件
- 实现请求日志中间件
- 统一导出所有中间件"
```

---

## Task 5: 创建路由结构

**Files:**
- Create: `src/routes/index.ts`

**Step 1: 创建主路由文件**

在 `src/routes/index.ts` 中：

```typescript
import { Router } from 'express';
import { ResponseUtil } from '../utils/response';

const router = Router();

// 健康检查路由
router.get('/health', (req, res) => {
  ResponseUtil.success(res, {
    status: 'ok',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API 版本路由
router.get('/api/v1', (req, res) => {
  ResponseUtil.success(res, {
    version: '1.0.0',
    message: 'API is running',
  });
});

export default router;
```

**Step 2: 提交路由文件**

```bash
git add src/routes/
git commit -m "feat: 创建基础路由结构

- 添加健康检查路由
- 添加 API 版本路由"
```

---

## Task 6: 重构应用入口

**Files:**
- Create: `src/app.ts`
- Modify: `src/index.ts`

**Step 1: 创建 Express 应用配置文件**

在 `src/app.ts` 中：

```typescript
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFound, requestLogger } from './middlewares';
import routes from './routes';

const app: Application = express();

// 安全中间件
app.use(helmet());
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? [] : '*', // 生产环境需配置具体域名
    credentials: true,
  })
);

// 请求频率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制 100 个请求
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(env.UPLOAD_DIR));

// 请求日志
app.use(requestLogger);

// 路由
app.use('/', routes);

// 404 处理
app.use(notFound);

// 错误处理
app.use(errorHandler);

export default app;
```

**Step 2: 更新应用启动文件**

修改 `src/index.ts`：

```typescript
import app from './app';
import { env, validateEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

// 验证环境变量
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation failed:', error);
  process.exit(1);
}

// 启动服务器
const startServer = async () => {
  try {
    // 连接数据库
    await connectDatabase();

    // 启动 HTTP 服务器
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
    });

    // 优雅关闭
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Server closed');
        process.exit(0);
      });

      // 强制关闭超时
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

**Step 3: 提交应用入口**

```bash
git add src/app.ts src/index.ts
git commit -m "feat: 重构应用入口和配置

- 创建独立的 Express 应用配置文件
- 集成所有中间件（安全、CORS、限流、日志）
- 实现优雅关闭机制
- 添加数据库连接和环境验证"
```

---

## Task 7: 创建 uploads 目录

**Files:**
- Create: `uploads/.gitkeep`

**Step 1: 创建上传目录**

```bash
mkdir -p uploads
touch uploads/.gitkeep
```

**Step 2: 更新 .gitignore**

确保 `.gitignore` 中包含：

```bash
# 上传的文件不提交，但保留目录
uploads/*
!uploads/.gitkeep
```

**Step 3: 提交目录结构**

```bash
git add uploads/.gitkeep .gitignore
git commit -m "chore: 创建文件上传目录"
```

---

## Task 8: 测试架构

**Step 1: 编译检查**

```bash
npm run build
```

Expected: TypeScript 编译成功，无错误

**Step 2: 代码检查和格式化**

```bash
npm run lint
npm run format
```

Expected: 无 lint 错误，代码已格式化

**Step 3: 启动开发服务器**

```bash
npm run dev
```

Expected 输出:
```
✅ Database connected successfully
[2026-02-15T...] [INFO] 🚀 Server is running on http://localhost:3000
[2026-02-15T...] [INFO] 📝 Environment: development
```

**Step 4: 测试健康检查接口**

在新终端执行：

```bash
curl http://localhost:3000/health
```

Expected 响应:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "ok",
    "uptime": 1.234,
    "environment": "development"
  },
  "timestamp": "2026-02-15T..."
}
```

**Step 5: 测试 API 版本接口**

```bash
curl http://localhost:3000/api/v1
```

Expected 响应:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "version": "1.0.0",
    "message": "API is running"
  },
  "timestamp": "2026-02-15T..."
}
```

**Step 6: 测试 404 处理**

```bash
curl http://localhost:3000/nonexistent
```

Expected 响应:
```json
{
  "success": false,
  "message": "Route /nonexistent not found",
  "timestamp": "2026-02-15T..."
}
```

**Step 7: 测试请求日志**

观察终端输出，应该能看到：
```
[2026-02-15T...] [INFO] GET /health 200 - 5ms
[2026-02-15T...] [INFO] GET /api/v1 200 - 3ms
[2026-02-15T...] [INFO] GET /nonexistent 404 - 2ms
```

**Step 8: 停止服务器**

按 `Ctrl+C` 停止服务器，观察优雅关闭：
```
[2026-02-15T...] [INFO] SIGINT received, shutting down gracefully...
Database disconnected
[2026-02-15T...] [INFO] Server closed
```

---

## Task 9: 创建架构文档

**Files:**
- Create: `docs/architecture.md`

**Step 1: 编写架构说明文档**

在 `docs/architecture.md` 中：

```markdown
# 项目架构文档

## 目录结构

\`\`\`
src/
├── config/          # 配置文件
│   ├── database.ts  # Prisma 数据库客户端
│   └── env.ts       # 环境变量配置
├── controllers/     # 控制器层（待添加）
├── services/        # 服务层（待添加）
├── repositories/    # 数据访问层（待添加）
├── middlewares/     # 中间件
│   ├── errorHandler.ts     # 错误处理
│   ├── notFound.ts         # 404 处理
│   ├── requestLogger.ts    # 请求日志
│   └── index.ts
├── routes/          # 路由定义
│   └── index.ts     # 主路由
├── utils/           # 工具函数
│   ├── response.ts       # 响应工具
│   ├── logger.ts         # 日志工具
│   └── asyncHandler.ts   # 异步处理
├── types/           # TypeScript 类型定义
│   ├── response.ts  # 响应类型
│   ├── error.ts     # 错误类型
│   └── index.ts
├── app.ts           # Express 应用配置
└── index.ts         # 应用入口
\`\`\`

## 三层架构职责

### Controller 层
- 接收 HTTP 请求
- 验证请求参数
- 调用 Service 层
- 返回 HTTP 响应

### Service 层
- 实现业务逻辑
- 调用 Repository 层
- 处理业务规则和数据转换

### Repository 层
- 执行数据库操作
- 封装 Prisma 查询
- 返回原始数据

## 统一响应格式

### 成功响应
\`\`\`json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "timestamp": "2026-02-15T..."
}
\`\`\`

### 错误响应
\`\`\`json
{
  "success": false,
  "message": "Error message",
  "error": "Error details (dev only)",
  "timestamp": "2026-02-15T..."
}
\`\`\`

### 分页响应
\`\`\`json
{
  "success": true,
  "message": "Success",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2026-02-15T..."
}
\`\`\`

## 错误处理流程

1. 业务代码抛出错误（AppError 或其子类）
2. asyncHandler 捕获异步错误
3. errorHandler 中间件统一处理
4. 返回标准化错误响应

## 中间件配置

### 安全中间件
- **Helmet**: 设置安全相关的 HTTP 头
- **CORS**: 跨域资源共享配置
- **Rate Limit**: API 速率限制（15分钟 100 次请求）

### 功能中间件
- **Request Logger**: 请求日志记录
- **Body Parser**: 请求体解析（限制 10MB）
- **Error Handler**: 统一错误处理

## 开发最佳实践

1. **DRY (Don't Repeat Yourself)** - 统一的响应和错误处理
2. **YAGNI (You Aren't Gonna Need It)** - 只实现当前需要的功能
3. **关注点分离** - Controller/Service/Repository 各司其职
4. **错误处理** - 使用自定义错误类型，统一处理
5. **类型安全** - 充分利用 TypeScript 类型系统
\`\`\`

**Step 2: 提交文档**

```bash
git add docs/architecture.md
git commit -m "docs: 添加项目架构文档

- 说明三层架构模式和职责
- 记录目录结构
- 提供开发最佳实践指南"
```

---

## Task 10: 最终验证和标记完成

**Step 1: 运行完整测试套件**

```bash
# 重新启动服务器
npm run dev
```

在另一个终端：

```bash
# 测试所有端点
curl http://localhost:3000/health
curl http://localhost:3000/api/v1
curl http://localhost:3000/nonexistent

# 停止服务器
```

**Step 2: 验证代码质量**

```bash
npm run lint
npm run build
```

Expected: 无错误

**Step 3: 查看 Git 历史**

```bash
git log --oneline -10
```

Expected: 看到本阶段所有提交记录

**Step 4: 创建完成标记**

```bash
git tag -a v0.2.0 -m "阶段二完成: 项目架构搭建

完成内容:
✅ 三层架构目录结构
✅ 环境变量配置和验证
✅ TypeScript 类型定义
✅ 统一响应和错误处理
✅ 全局中间件（安全、日志、错误）
✅ 基础路由结构
✅ 优雅关闭机制
✅ 架构文档

参考: docs/plan/phase-2.md
实施计划: docs/plans/2026-02-15-project-architecture-setup.md"
```

**Step 5: 更新 README 进度**

在 `README.md` 的阶段二部分添加完成标记：

```markdown
### 阶段二：项目架构搭建 ✅

**目标**: 建立清晰的项目目录结构和代码组织方式

**状态**: 已完成

📖 **[设计文档](docs/plan/phase-2.md)**
📋 **[实施计划](docs/plans/2026-02-15-project-architecture-setup.md)**
📚 **[架构文档](docs/architecture.md)**
```

**Step 6: 最终提交**

```bash
git add README.md
git commit -m "docs: 更新 README，标记阶段二完成

阶段二已完成所有任务，可进入阶段三"
```

---

## 完成检查清单

- [ ] 环境变量配置和验证完成
- [ ] 数据库连接配置完成
- [ ] TypeScript 类型定义完成（响应、错误）
- [ ] 工具函数完成（响应、日志、异步处理）
- [ ] 全局中间件完成（错误处理、404、日志）
- [ ] 路由结构搭建完成
- [ ] Express 应用配置完成
- [ ] 优雅关闭机制实现
- [ ] 健康检查接口正常工作
- [ ] 请求日志正常输出
- [ ] 错误处理正常工作
- [ ] 代码格式化和检查通过
- [ ] 架构文档已创建
- [ ] 所有代码已提交到 Git
- [ ] 已创建版本标签

## 下一步

阶段二完成后，进入 **阶段三：用户认证系统**

需要实施计划吗？
