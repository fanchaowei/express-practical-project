# 阶段二：项目架构搭建

## 目标

建立清晰的三层架构目录结构和代码组织方式，搭建项目的基础设施代码，为后续业务开发提供统一的开发规范和工具。

## 前置条件

- 已完成 [阶段一：项目初始化与环境搭建](./phase-1.md)
- 开发服务器可以正常启动
- Docker 容器正常运行

---

## 步骤 1：创建三层架构目录结构

### 1.1 创建目录

```bash
mkdir -p src/{config,controllers,services,repositories,middlewares,routes,utils,types}
mkdir -p logs
```

### 1.2 目录说明

```
src/
├── config/          # 配置文件（数据库、环境变量等）
├── controllers/     # 控制器层（处理 HTTP 请求和响应）
├── services/        # 业务逻辑层（核心业务逻辑）
├── repositories/    # 数据访问层（数据库操作）
├── middlewares/     # 中间件（鉴权、日志、错误处理等）
├── routes/          # 路由定义
├── utils/           # 工具函数
├── types/           # TypeScript 类型定义
└── index.ts         # 应用入口
```

**三层架构说明**：
- **Controller**: 接收请求 → 调用 Service → 返回响应
- **Service**: 处理业务逻辑 → 调用 Repository → 返回结果
- **Repository**: 执行数据库操作 → 返回数据

---

## 步骤 2：配置管理

### 2.1 创建 src/config/env.ts

环境变量配置文件：

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

### 2.2 更新 src/config/database.ts

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

---

## 步骤 3：类型定义

### 3.1 创建 src/types/response.ts

统一响应格式类型：

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

### 3.2 创建 src/types/error.ts

错误类型定义：

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

### 3.3 创建 src/types/index.ts

导出所有类型：

```typescript
export * from './response';
export * from './error';
```

---

## 步骤 4：工具函数

### 4.1 创建 src/utils/response.ts

统一响应格式工具：

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

### 4.2 创建 src/utils/logger.ts

日志工具：

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

### 4.3 创建 src/utils/asyncHandler.ts

异步错误处理包装器：

```typescript
import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

---

## 步骤 5：中间件

### 5.1 创建 src/middlewares/errorHandler.ts

全局错误处理中间件：

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

### 5.2 创建 src/middlewares/notFound.ts

404 处理中间件：

```typescript
import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../types';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};
```

### 5.3 创建 src/middlewares/requestLogger.ts

请求日志中间件：

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

### 5.4 创建 src/middlewares/index.ts

导出所有中间件：

```typescript
export * from './errorHandler';
export * from './notFound';
export * from './requestLogger';
```

---

## 步骤 6：路由结构

### 6.1 创建 src/routes/index.ts

主路由文件：

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

---

## 步骤 7：重构应用入口

### 7.1 创建 src/app.ts

Express 应用配置：

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

### 7.2 更新 src/index.ts

应用启动文件：

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

---

## 步骤 8：测试架构

### 8.1 启动开发服务器

```bash
npm run dev
```

应该看到：
```
✅ Database connected successfully
🚀 Server is running on http://localhost:3000
📝 Environment: development
```

### 8.2 测试健康检查接口

```bash
curl http://localhost:3000/health
```

应该返回：
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "ok",
    "uptime": 12.345,
    "environment": "development"
  },
  "timestamp": "2026-02-05T..."
}
```

### 8.3 测试 API 版本接口

```bash
curl http://localhost:3000/api/v1
```

### 8.4 测试 404 处理

```bash
curl http://localhost:3000/nonexistent
```

应该返回：
```json
{
  "success": false,
  "message": "Route /nonexistent not found",
  "timestamp": "2026-02-05T..."
}
```

### 8.5 测试请求日志

查看终端输出，应该能看到每个请求的日志：
```
[2026-02-05T...] [INFO] GET /health 200 - 5ms
```

---

## 步骤 9：代码格式化和检查

### 9.1 格式化代码

```bash
npm run format
```

### 9.2 检查代码

```bash
npm run lint
```

如果有错误，运行：
```bash
npm run lint:fix
```

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
git commit -m "feat: 搭建项目三层架构和基础设施

- 创建三层架构目录结构
- 实现统一错误处理机制
- 实现统一响应格式
- 配置全局中间件（CORS、Helmet、Rate Limit）
- 添加日志工具和请求日志
- 实现优雅关闭机制
- 添加健康检查和 API 版本接口"
```

---

## 阶段二完成检查清单

- [ ] 三层架构目录结构已创建
- [ ] 环境变量配置和验证完成
- [ ] 数据库连接配置完成
- [ ] TypeScript 类型定义完成
- [ ] 工具函数（响应、日志、异步处理）完成
- [ ] 全局中间件（错误处理、404、日志）完成
- [ ] 路由结构搭建完成
- [ ] Express 应用配置完成
- [ ] 优雅关闭机制实现
- [ ] 健康检查接口正常工作
- [ ] 请求日志正常输出
- [ ] 错误处理正常工作
- [ ] 代码格式化和检查通过
- [ ] 代码已提交到 Git

---

## 项目结构总览

完成阶段二后，项目结构如下：

```
practical-project/
├── src/
│   ├── config/
│   │   ├── database.ts      # 数据库配置
│   │   └── env.ts            # 环境变量配置
│   ├── controllers/          # 控制器（待添加）
│   ├── services/             # 服务层（待添加）
│   ├── repositories/         # 数据访问层（待添加）
│   ├── middlewares/
│   │   ├── errorHandler.ts  # 错误处理中间件
│   │   ├── notFound.ts       # 404 中间件
│   │   ├── requestLogger.ts  # 请求日志中间件
│   │   └── index.ts
│   ├── routes/
│   │   └── index.ts          # 主路由
│   ├── utils/
│   │   ├── response.ts       # 响应工具
│   │   ├── logger.ts         # 日志工具
│   │   └── asyncHandler.ts   # 异步处理工具
│   ├── types/
│   │   ├── response.ts       # 响应类型
│   │   ├── error.ts          # 错误类型
│   │   └── index.ts
│   ├── app.ts                # Express 应用配置
│   └── index.ts              # 应用入口
├── prisma/
│   └── schema.prisma
├── uploads/                  # 上传文件目录
├── logs/                     # 日志目录
├── .env
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## 架构设计说明

### 三层架构职责

**Controller 层**：
- 接收 HTTP 请求
- 验证请求参数
- 调用 Service 层
- 返回 HTTP 响应

**Service 层**：
- 实现业务逻辑
- 调用 Repository 层
- 处理业务规则和数据转换

**Repository 层**：
- 执行数据库操作
- 封装 Prisma 查询
- 返回原始数据

### 错误处理流程

1. 业务代码抛出错误（AppError 或其子类）
2. asyncHandler 捕获异步错误
3. errorHandler 中间件统一处理
4. 返回标准化错误响应

### 响应格式规范

**成功响应**：
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "timestamp": "2026-02-05T..."
}
```

**错误响应**：
```json
{
  "success": false,
  "message": "Error message",
  "error": "Error details (dev only)",
  "timestamp": "2026-02-05T..."
}
```

**分页响应**：
```json
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
  "timestamp": "2026-02-05T..."
}
```

---

## 常见问题

### Q1: 服务器启动失败

**检查**：
1. 环境变量是否配置正确
2. 端口 3000 是否被占用：`lsof -i :3000`
3. 数据库是否正常运行

### Q2: TypeScript 编译错误

**解决方案**：
```bash
# 清理并重新编译
rm -rf dist
npm run build
```

### Q3: 中间件顺序问题

**注意**：
- 错误处理中间件必须放在最后
- 404 中间件放在所有路由之后
- 请求日志放在路由之前

### Q4: CORS 错误

**解决方案**：
在 `src/app.ts` 中配置 CORS：
```typescript
app.use(cors({
  origin: ['http://localhost:5173'], // 添加前端地址
  credentials: true,
}));
```

---

## 下一步

完成阶段二后，进入 [阶段三：用户认证系统](./phase-3.md)。
