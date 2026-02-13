# 阶段三：用户认证系统

## 目标

实现基础的用户登录认证系统，为后续业务功能提供身份验证能力。

## 前置条件

- 已完成 [阶段一：项目初始化与环境搭建](./phase-1.md)
- 已完成 [阶段二：项目架构搭建](./phase-2.md)
- Docker 容器正常运行
- 开发服务器可以正常启动

---

## 核心功能

1. **用户数据模型** - 在数据库中创建User表，存储用户基本信息
2. **登录接口** - POST `/api/v1/auth/login`，验证用户名密码，返回JWT token
3. **JWT机制** - 生成和验证token的工具函数
4. **密码加密** - 使用bcrypt安全存储密码
5. **鉴权中间件** - 验证JWT的中间件（开发但不应用，留待阶段4使用）
6. **管理员账户初始化** - 通过seed脚本自动创建预设管理员

---

## 步骤 1：更新环境变量

### 1.1 编辑 .env 文件

添加管理员账户配置：

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

# 默认管理员账户 (用于seed)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123456
```

### 1.2 更新 .env.example

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

# 默认管理员账户 (用于seed)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123456
```

---

## 步骤 2：设计数据库模型

### 2.1 编辑 prisma/schema.prisma

添加User模型：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

### 2.2 创建数据库迁移

```bash
npx prisma migrate dev --name add_user_model
```

这会：
- 在数据库中创建 `users` 表
- 在 `prisma/migrations/` 目录下生成迁移文件

### 2.3 生成 Prisma Client

```bash
npm run prisma:generate
```

### 🤔 为什么这样做

**1. 为什么password字段不叫passwordHash？**
- 虽然存储的是hash值，但对外的语义就是"密码"
- 应用层不需要知道内部是hash还是其他加密方式
- 保持字段名简洁，实现细节在代码中处理

**2. 为什么使用@@map("users")？**
- Prisma模型名用单数（User），符合面向对象习惯
- 数据库表名用复数（users），符合SQL命名惯例
- `@@map`让两者都符合各自领域的最佳实践

**3. 为什么需要role字段？**
- 虽然当前只有管理员，但预留扩展能力
- 后续可以根据role实现权限控制（如：只有admin能删除数据）
- 成本很低（一个字段），但避免未来的数据迁移

---

## 步骤 3：创建工具函数

### 3.1 创建 src/utils/password.util.ts

密码加密和验证工具：

```typescript
import bcrypt from 'bcryptjs';

/**
 * 密码加密工具
 */
export class PasswordUtil {
  /**
   * 加密密码
   * @param password 明文密码
   * @returns 加密后的hash
   */
  static async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * 验证密码
   * @param password 明文密码
   * @param hash 存储的hash值
   * @returns 是否匹配
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

### 3.2 创建 src/utils/jwt.util.ts

JWT生成和验证工具：

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
   * @param payload token载荷
   * @returns token字符串
   */
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  /**
   * 验证JWT token
   * @param token token字符串
   * @returns 解码后的payload，验证失败返回null
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
   * @param token token字符串
   * @returns 解码后的payload
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

### 🤔 为什么这样做

**1. 为什么bcrypt.genSalt(10)？**
- `10`是salt rounds（加密轮数）
- 轮数越高越安全，但计算越慢
- 10是安全性和性能的平衡点，业界标准
- 每增加1轮，计算时间翻倍

**2. 为什么verifyToken返回null而不是抛出错误？**
- Token验证失败是正常业务场景（过期、伪造等）
- 返回null让调用方更方便判断
- 避免在业务代码中频繁使用try-catch

**3. 为什么需要decodeToken方法？**
- 有时需要查看token内容而不验证签名
- 例如：调试、日志记录、客户端解析token信息
- 注意：不验证签名意味着不能信任数据

---

## 步骤 4：创建数据访问层

### 4.1 创建 src/repositories/user.repository.ts

```typescript
import prisma from '../config/database';
import { User } from '@prisma/client';

/**
 * 用户数据访问层
 */
export class UserRepository {
  /**
   * 根据用户名查找用户
   * @param username 用户名
   * @returns 用户对象或null
   */
  static async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * 根据ID查找用户
   * @param id 用户ID
   * @returns 用户对象或null
   */
  static async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 创建用户
   * @param data 用户数据
   * @returns 创建的用户对象
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

### 🤔 为什么这样做

**1. 为什么Repository只做数据库操作？**
- 遵循单一职责原则
- Repository不关心业务逻辑，只负责数据存取
- 方便测试：可以轻松mock Repository
- 方便替换：如果将来换ORM或数据库，只需修改Repository层

**2. 为什么使用静态方法？**
- UserRepository不需要实例状态
- 静态方法调用更简洁：`UserRepository.findByUsername()`
- 符合工具类的使用习惯

---

## 步骤 5：创建业务逻辑层

### 5.1 创建 src/services/auth.service.ts

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
   * @param username 用户名
   * @param password 密码
   * @returns 登录结果（token和用户信息）
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

### 🤔 为什么这样做

**1. 为什么用户不存在和密码错误返回相同的错误信息？**
- 安全考虑：防止攻击者枚举用户名
- 如果返回"用户不存在"，攻击者就知道哪些用户名是有效的
- 如果返回"密码错误"，攻击者就知道用户名存在，可以专门破解密码
- 统一的错误信息是业界安全标准

**2. 为什么返回数据不包含密码？**
- 即使是hash值也不应该暴露
- 前端永远不需要密码信息
- 减少密码hash泄露的风险

**3. 为什么Service层处理业务逻辑而不是Controller？**
- Controller只负责HTTP层面的事情（解析请求、返回响应）
- Service包含可复用的业务逻辑
- 如果将来需要其他认证方式（如OAuth），可以复用Service

---

## 步骤 6：创建控制器层

### 6.1 创建 src/controllers/auth.controller.ts

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

### 🤔 为什么这样做

**1. 为什么使用asyncHandler包装？**
- Express不会自动捕获async函数中的错误
- asyncHandler将Promise错误传递给错误处理中间件
- 避免在每个async函数中写try-catch

**2. 为什么在Controller验证参数而不是Service？**
- Controller负责HTTP请求验证
- Service假设参数已经验证过，专注业务逻辑
- 如果将来有其他入口调用Service（如CLI工具），可以自行验证

**3. 为什么使用静态方法？**
- Controller不需要实例状态
- 符合函数式风格，更容易理解和测试

---

## 步骤 7：创建路由

### 7.1 创建 src/routes/auth.routes.ts

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

### 7.2 更新 src/routes/index.ts

集成认证路由：

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

---

## 步骤 8：创建鉴权中间件

### 8.1 创建 src/middlewares/auth.middleware.ts

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

### 8.2 更新 src/middlewares/index.ts

导出鉴权中间件：

```typescript
export * from './errorHandler';
export * from './notFound';
export * from './requestLogger';
export * from './auth.middleware';
```

### 🤔 为什么这样做

**1. 为什么token格式是"Bearer <token>"？**
- Bearer是OAuth 2.0标准的token类型
- 表示"持有这个token的人可以访问资源"
- 业界标准格式，前后端都遵循同一规范

**2. 为什么需要扩展Express.Request类型？**
- TypeScript需要知道`req.user`的类型
- 通过declaration merging扩展Express的类型定义
- 获得完整的类型提示和检查

**3. 为什么这个中间件不直接应用到路由？**
- 阶段3的目标是开发基础设施
- 阶段4实现影片收藏功能时再应用鉴权
- 先把工具做好，再使用工具

---

## 步骤 9：创建Seed脚本

### 9.1 创建 prisma/seed.ts

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

### 9.2 配置 package.json

添加seed脚本配置：

```json
{
  "name": "practical-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\""
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### 9.3 运行Seed脚本

```bash
npm run prisma:seed
```

应该看到输出：

```
🌱 开始数据库种子...
✅ 管理员账户创建成功:
   用户名: admin
   角色: admin
   ID: 1
```

### 🤔 为什么这样做

**1. 为什么需要seed脚本？**
- 自动化初始数据创建，避免手动插入SQL
- 团队成员可以快速搭建相同的开发环境
- 测试环境可以快速重置数据

**2. 为什么检查管理员是否存在？**
- seed脚本可能被多次运行
- 避免重复创建导致unique约束错误
- 幂等性：多次运行结果相同

**3. 为什么在seed中也加密密码？**
- seed创建的是真实数据，必须加密
- 保持数据一致性：所有密码都是hash存储
- 即使是开发环境也要养成安全习惯

---

## 步骤 10：测试验证

### 10.1 启动开发服务器

```bash
npm run dev
```

应该看到：

```
✅ Database connected successfully
🚀 Server is running on http://localhost:3000
📝 Environment: development
```

### 10.2 测试登录接口（成功场景）

使用curl测试：

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'
```

应该返回：

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  },
  "timestamp": "2026-02-13T..."
}
```

### 10.3 测试登录接口（失败场景）

**场景1：密码错误**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'
```

应该返回：

```json
{
  "success": false,
  "message": "用户名或密码错误",
  "timestamp": "2026-02-13T..."
}
```

**场景2：用户不存在**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"notexist","password":"123456"}'
```

应该返回相同的错误信息（安全考虑）。

**场景3：缺少参数**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'
```

应该返回：

```json
{
  "success": false,
  "message": "用户名和密码不能为空",
  "timestamp": "2026-02-13T..."
}
```

### 10.4 验证JWT Token

访问 [jwt.io](https://jwt.io/)，将获取的token粘贴进去，可以看到解码后的payload：

```json
{
  "userId": 1,
  "username": "admin",
  "role": "admin",
  "iat": 1707849600,
  "exp": 1708454400
}
```

### 10.5 使用Prisma Studio查看数据

```bash
npm run prisma:studio
```

浏览器打开 http://localhost:5555，可以看到users表中的管理员记录。

---

## 步骤 11：代码优化和提交

### 11.1 格式化代码

```bash
npm run format
```

### 11.2 检查代码

```bash
npm run lint
```

如果有错误，运行：

```bash
npm run lint:fix
```

### 11.3 查看变更

```bash
git status
```

### 11.4 提交代码

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

---

## 阶段三完成检查清单

- [ ] User模型已添加到schema.prisma
- [ ] 数据库迁移已完成，users表已创建
- [ ] Prisma Client已生成
- [ ] 密码工具（hash/compare）已实现
- [ ] JWT工具（generate/verify）已实现
- [ ] UserRepository已实现
- [ ] AuthService已实现
- [ ] AuthController已实现
- [ ] 认证路由已创建并集成
- [ ] JWT鉴权中间件已实现
- [ ] Seed脚本已创建并成功运行
- [ ] 管理员账户已创建（通过seed）
- [ ] 登录接口测试通过（成功和失败场景）
- [ ] Token可以正常生成和解码
- [ ] 代码格式化和检查通过
- [ ] 代码已提交到Git

---

## 项目结构总览

完成阶段三后，新增的文件结构：

```
practical-project/
├── src/
│   ├── controllers/
│   │   └── auth.controller.ts      # 认证控制器
│   ├── services/
│   │   └── auth.service.ts         # 认证服务
│   ├── repositories/
│   │   └── user.repository.ts      # 用户数据访问
│   ├── middlewares/
│   │   └── auth.middleware.ts      # JWT鉴权中间件
│   ├── routes/
│   │   ├── auth.routes.ts          # 认证路由
│   │   └── index.ts                # 更新：集成认证路由
│   └── utils/
│       ├── password.util.ts        # 密码工具
│       └── jwt.util.ts             # JWT工具
├── prisma/
│   ├── schema.prisma               # 更新：添加User模型
│   ├── seed.ts                     # Seed脚本
│   └── migrations/                 # 数据库迁移文件
└── .env                            # 更新：添加管理员配置
```

---

## 认证流程图

```
┌─────────┐
│  客户端  │
└────┬────┘
     │ POST /api/v1/auth/login
     │ { username, password }
     ▼
┌─────────────────────┐
│  AuthController     │ ◄─── 验证请求参数
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   AuthService       │
└─────────┬───────────┘
          │
          ├─► UserRepository.findByUsername()  ◄─── 查询数据库
          │
          ├─► PasswordUtil.compare()           ◄─── 验证密码
          │
          └─► JwtUtil.generateToken()          ◄─── 生成Token
          │
          ▼
┌─────────────────────┐
│  返回Token和用户信息 │
└─────────────────────┘
```

---

## 常见问题

### Q1: 登录接口返回500错误

**可能原因**：
1. 数据库连接失败
2. 用户表不存在
3. Seed脚本没有运行

**解决方案**：

```bash
# 检查数据库连接
docker-compose ps

# 重新运行迁移
npx prisma migrate dev

# 重新运行seed
npm run prisma:seed
```

### Q2: Token验证失败

**可能原因**：
1. JWT_SECRET配置错误
2. Token格式错误
3. Token已过期

**解决方案**：

检查环境变量：

```bash
# 确认JWT_SECRET已配置
cat .env | grep JWT_SECRET
```

检查token格式（应该是 `Bearer <token>`）。

### Q3: 密码验证总是失败

**可能原因**：
1. Seed脚本中的密码加密方式不一致
2. 密码输入错误

**解决方案**：

重新创建管理员账户：

```bash
# 删除现有用户（在Prisma Studio中）
npm run prisma:studio

# 重新运行seed
npm run prisma:seed
```

### Q4: TypeScript类型错误：req.user不存在

**解决方案**：

确保在 `src/middlewares/auth.middleware.ts` 中添加了类型扩展：

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
```

### Q5: bcrypt相关错误

**可能原因**：
bcrypt的native模块编译问题

**解决方案**：

```bash
# 重新安装
npm uninstall bcryptjs
npm install bcryptjs
```

---

## 安全最佳实践

### 1. 密码安全

- ✅ 使用bcrypt加密，永远不存储明文密码
- ✅ Salt rounds设置为10（平衡安全和性能）
- ✅ 登录失败不透露具体原因

### 2. JWT安全

- ✅ JWT_SECRET必须足够复杂，至少32个字符
- ✅ 生产环境必须更换默认的JWT_SECRET
- ✅ Token有效期不要太长（当前7天，生产环境建议更短）

### 3. 环境变量安全

- ✅ 敏感信息存储在.env文件
- ✅ .env已添加到.gitignore
- ✅ .env.example作为模板，不包含真实密钥

### 4. API安全

- ✅ 统一的错误信息，防止信息泄露
- ✅ 请求体大小限制（已在app.ts配置）
- ✅ 请求频率限制（已在app.ts配置）

---

## 进阶知识

### JWT工作原理

JWT由三部分组成，用`.`分隔：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
|          Header          |              Payload              |           Signature          |
```

- **Header**: 算法和token类型
- **Payload**: 用户数据（不加密，只是Base64编码）
- **Signature**: 用密钥签名，防止篡改

### Bcrypt工作原理

```
明文密码: admin123456
        ↓
生成随机salt: $2b$10$N9qo8uLOickgx2ZMRZoMye
        ↓
使用salt加密10轮
        ↓
最终hash: $2b$10$N9qo8uLOickgx2ZMRZoMye.IcBGmH4J3
```

每次加密相同的密码，生成的hash都不同（因为salt随机），但都能验证成功。

### 三层架构的数据流

```
HTTP Request
    ↓
Controller (处理请求格式)
    ↓
Service (业务逻辑)
    ↓
Repository (数据访问)
    ↓
Database
    ↓
Repository (返回数据)
    ↓
Service (处理数据)
    ↓
Controller (格式化响应)
    ↓
HTTP Response
```

---

## 下一步

完成阶段三后，进入 [阶段四：影片收藏子系统](./phase-4.md)。

在阶段四中，我们将：
1. 设计影片相关的数据模型（Movie、Image、Tag等）
2. 实现图片上传功能
3. 实现影片CRUD接口
4. **应用JWT鉴权中间件**，保护影片接口
5. 实现高级查询功能（筛选、分页、排序）
