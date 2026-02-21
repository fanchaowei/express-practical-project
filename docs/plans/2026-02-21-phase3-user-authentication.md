# 阶段三：用户认证系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现基础的用户登录认证系统，包括用户数据模型、JWT机制、密码加密和鉴权中间件

**Architecture:** 在现有三层架构基础上，添加认证相关的工具类（PasswordUtil、JwtUtil）、Repository、Service、Controller 和 Middleware，实现完整的认证流程。

**Tech Stack:** Express.js, TypeScript, Prisma, bcryptjs, jsonwebtoken

**参考文档:** [docs/plan/phase-3.md](../plan/phase-3.md)

---

## Task 1: 更新环境变量配置

**Files:**
- Modify: `.env`
- Modify: `.env.example`

**Step 1: 编辑 .env 文件**

添加 JWT 配置和默认管理员账户配置：

```env
# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 默认管理员账户 (用于seed)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123456
```

**Step 2: 更新 .env.example**

同步更新 `.env.example` 文件，添加相同的配置项。

**Verification:**

```bash
# 检查环境变量是否正确配置
cat .env | grep -E "(JWT_SECRET|DEFAULT_ADMIN)"
```

---

## Task 2: 设计数据库模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加 User 模型**

在 `prisma/schema.prisma` 中添加：

```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

**Step 2: 创建数据库迁移**

```bash
npx prisma migrate dev --name add_user_model
```

**Step 3: 生成 Prisma Client**

```bash
npm run prisma:generate
```

**Verification:**

```bash
# 检查迁移文件是否生成
ls -la prisma/migrations/ | grep add_user_model
# 检查 Prisma Client 是否生成
node -e "const { PrismaClient } = require('@prisma/client'); console.log('Prisma Client OK')"
```

---

## Task 3: 创建工具函数

**Files:**
- Create: `src/utils/password.util.ts`
- Create: `src/utils/jwt.util.ts`

**Step 1: 创建密码加密工具**

在 `src/utils/password.util.ts` 中创建：

```typescript
import bcrypt from 'bcryptjs';

/**
 * 密码加密工具
 */
export class PasswordUtil {
  /**
   * 加密密码
   */
  static async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * 验证密码
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

**Step 2: 创建 JWT 工具**

在 `src/utils/jwt.util.ts` 中创建：

```typescript
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * JWT工具类
 */
export class JwtUtil {
  /**
   * 生成JWT token
   */
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  /**
   * 验证JWT token
   */
  static verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * 解码token（不验证签名）
   */
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/utils/password.util.ts src/utils/jwt.util.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 4: 创建数据访问层

**Files:**
- Create: `src/repositories/user.repository.ts`

**Step 1: 创建 UserRepository**

在 `src/repositories/user.repository.ts` 中创建：

```typescript
import prisma from '../config/database';
import { User } from '@prisma/client';

/**
 * 用户数据访问层
 */
export class UserRepository {
  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * 根据ID查找用户
   */
  static async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 创建用户
   */
  static async create(data: {
    username: string;
    password: string;
    role?: string;
  }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/repositories/user.repository.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 5: 创建业务逻辑层

**Files:**
- Create: `src/services/auth.service.ts`

**Step 1: 创建 AuthService**

在 `src/services/auth.service.ts` 中创建：

```typescript
import { UserRepository } from '../repositories/user.repository';
import { PasswordUtil } from '../utils/password.util';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';
import { UnauthorizedError } from '../types';

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * 认证服务
 */
export class AuthService {
  /**
   * 用户登录
   */
  static async login(username: string, password: string): Promise<LoginResponse> {
    // 1. 查找用户
    const user = await UserRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 2. 验证密码
    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 3. 生成token
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    const token = JwtUtil.generateToken(payload);

    // 4. 返回结果（不包含密码）
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/services/auth.service.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 6: 创建控制器层

**Files:**
- Create: `src/controllers/auth.controller.ts`

**Step 1: 创建 AuthController**

在 `src/controllers/auth.controller.ts` 中创建：

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../types';

/**
 * 认证控制器
 */
export class AuthController {
  /**
   * 用户登录
   */
  static login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      throw new ValidationError('用户名和密码不能为空');
    }

    // 调用服务层
    const result = await AuthService.login(username, password);

    // 返回成功响应
    return ResponseUtil.success(res, result, '登录成功');
  });
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/controllers/auth.controller.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 7: 创建路由

**Files:**
- Create: `src/routes/auth.routes.ts`
- Modify: `src/routes/index.ts`

**Step 1: 创建认证路由**

在 `src/routes/auth.routes.ts` 中创建：

```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', AuthController.login);

export default router;
```

**Step 2: 更新主路由**

修改 `src/routes/index.ts`，集成认证路由：

```typescript
import { Router } from 'express';
import { ResponseUtil } from '../utils/response';
import authRoutes from './auth.routes';

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

// 认证路由
router.use('/api/v1/auth', authRoutes);

export default router;
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/routes/auth.routes.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 8: 创建鉴权中间件

**Files:**
- Create: `src/middlewares/auth.middleware.ts`
- Modify: `src/middlewares/index.ts`

**Step 1: 创建 JWT 鉴权中间件**

在 `src/middlewares/auth.middleware.ts` 中创建：

```typescript
import { Request, Response, NextFunction } from 'express';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';
import { UnauthorizedError } from '../types';

// 扩展Express的Request类型，添加user属性
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT认证中间件
 * 验证请求头中的token，并将用户信息挂载到req.user
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('缺少认证令牌');
    }

    // 2. 解析token（格式：Bearer <token>）
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('认证令牌格式错误');
    }

    const token = parts[1];

    // 3. 验证token
    const payload = JwtUtil.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedError('认证令牌无效或已过期');
    }

    // 4. 将用户信息挂载到request
    req.user = payload;

    next();
  } catch (error) {
    next(error);
  }
};
```

**Step 2: 导出鉴权中间件**

修改 `src/middlewares/index.ts`：

```typescript
export * from './errorHandler';
export * from './notFound';
export * from './requestLogger';
export * from './auth.middleware';
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/middlewares/auth.middleware.ts
# 检查 TypeScript 编译
npx tsc --noEmit
```

---

## Task 9: 创建 Seed 脚本

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: 创建 seed 脚本**

在 `prisma/seed.ts` 中创建：

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始数据库种子...');

  // 读取环境变量
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456';

  // 检查管理员是否已存在
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    console.log('⚠️  管理员账户已存在，跳过创建');
    return;
  }

  // 加密密码
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  // 创建管理员账户
  const admin = await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('✅ 管理员账户创建成功:');
  console.log(`   用户名: ${admin.username}`);
  console.log(`   角色: ${admin.role}`);
  console.log(`   ID: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: 配置 package.json**

在 `package.json` 中添加：

```json
{
  "scripts": {
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

**Step 3: 运行 Seed 脚本**

```bash
npm run prisma:seed
```

**Verification:**

```bash
# 检查 seed 脚本输出
npm run prisma:seed
# 使用 Prisma Studio 查看数据
npm run prisma:studio
```

---

## Task 10: 测试验证

**Files:** N/A (测试阶段)

**Step 1: 启动开发服务器**

```bash
npm run dev
```

应该看到：
```
✅ Database connected successfully
🚀 Server is running on http://localhost:3000
```

**Step 2: 测试登录接口（成功场景）**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'
```

应该返回包含 token 的成功响应。

**Step 3: 测试登录接口（失败场景）**

测试密码错误：
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'
```

测试缺少参数：
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'
```

**Verification:**

所有测试都应返回正确的响应格式和状态码。

---

## Task 11: 代码优化和提交

**Files:** N/A (代码整理阶段)

**Step 1: 格式化代码**

```bash
npm run format
```

**Step 2: 检查代码**

```bash
npm run lint
```

如果有错误，运行：
```bash
npm run lint:fix
```

**Step 3: 提交代码**

```bash
git add .
git commit -m "feat: 实现用户认证系统

- 添加User数据模型和数据库迁移
- 实现密码加密工具（bcrypt）
- 实现JWT生成和验证工具
- 实现用户数据访问层（Repository）
- 实现认证业务逻辑层（Service）
- 实现登录接口（Controller + Routes）
- 实现JWT鉴权中间件（开发但未应用）
- 添加seed脚本初始化管理员账户
- 添加登录接口测试"
```

**Verification:**

```bash
# 检查提交状态
git log -1 --oneline
git status
```

---

## 完成检查清单

- [x] 环境变量已更新（JWT_SECRET、管理员账户配置）
- [x] User 模型已添加到 schema.prisma
- [x] 数据库迁移已完成，users 表已创建
- [x] Prisma Client 已生成
- [x] 密码工具（hash/compare）已实现
- [x] JWT 工具（generate/verify）已实现
- [x] UserRepository 已实现
- [x] AuthService 已实现
- [x] AuthController 已实现
- [x] 认证路由已创建并集成
- [x] JWT 鉴权中间件已实现
- [x] Seed 脚本已创建并成功运行
- [x] 管理员账户已创建（通过 seed）
- [x] 登录接口测试通过（成功和失败场景）
- [x] 代码格式化和检查通过
- [x] 代码已提交到 Git

---

## 注意事项

1. **安全性**：密码必须使用 bcrypt 加密，永远不存储明文
2. **错误信息**：用户不存在和密码错误返回相同错误信息，防止用户枚举
3. **JWT Secret**：生产环境必须更换默认的 JWT_SECRET
4. **中间件应用**：鉴权中间件在此阶段只开发不应用，留待阶段四使用
5. **测试验证**：每个功能实现后都要进行验证，确保正常工作
