# 阶段五：测试与优化

## 目标

确保代码质量和性能，为生产环境做准备，建立可靠的测试基础设施。

## 前置条件

- 已完成 [阶段四：影片收藏子系统](./phase-4.md)
- 项目可以正常启动并提供 API 服务
- 数据库运行正常

---

## 分阶段实施策略

考虑到这是学习项目，且需要与前端对接调试，将阶段五分为两个子阶段：

### **阶段 5A：立即优化（现在可做）**

**特点：** 低风险、不影响现有功能、不需要额外学习成本

包含内容：
- ✅ 添加数据库索引（性能提升）
- ✅ 优化 Prisma 查询（减少数据传输）
- ✅ 完善错误处理

**适合时机：** 在前端对接之前完成，可以提升前端调试时的性能

### **阶段 5B：测试与安全加固（后续学习）**

**特点：** 需要学习新技术、有一定复杂度、适合深入学习时进行

包含内容：
- 📚 测试环境搭建与测试编写（Vitest + Supertest）
- 📚 输入验证（Zod）
- 📚 安全中间件（XSS、CSRF 等）
- 📚 请求频率限制增强

**适合时机：** 前端对接完成后，有时间深入学习测试和安全最佳实践时进行

---

## 核心功能设计

### 一、数据库索引优化（阶段 5A）

#### 需要添加的索引

```prisma
// prisma/schema.prisma

model Movie {
  id          Int         @id @default(autoincrement())
  title       String
  type        String
  rating      Float?
  releaseYear Int?
  comment     String?     @db.Text
  coverImage  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  images      Image[]
  movieTags   MovieTag[]

  // 新增索引
  @@index([type])              // 按类型筛选（高频查询）
  @@index([rating])            // 按评分排序（高频查询）
  @@index([releaseYear])       // 按年份筛选（中频查询）
  @@index([createdAt])         // 按创建时间排序（中频查询）
  @@map("movies")
}

model Image {
  id        Int      @id @default(autoincrement())
  path      String
  movieId   Int
  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  // 新增索引
  @@index([movieId])   // 查询影片图片（高频查询）
  @@map("images")
}
```

#### 索引说明

| 表名 | 索引字段 | 使用场景 | 优先级 | 预期收益 |
|------|---------|---------|--------|---------|
| Movie | `type` | `?type=movie` 类型筛选 | 高 | 查询速度 ↑ 50-80% |
| Movie | `rating` | `?sortBy=rating` 评分排序 | 高 | 排序速度 ↑ 60-90% |
| Movie | `releaseYear` | `?minYear=2020&maxYear=2023` | 中 | 范围查询 ↑ 40-60% |
| Movie | `createdAt` | `?sortBy=createdAt` 默认排序 | 中 | 排序速度 ↑ 50-70% |
| Image | `movieId` | 查询影片的所有图片 | 高 | 关联查询 ↑ 70-90% |

#### 实施步骤

1. 更新 `prisma/schema.prisma` 添加索引
2. 生成迁移文件：`npx prisma migrate dev --name add_indexes`
3. 应用迁移到数据库
4. 验证索引创建成功

**风险：** 低。索引只会提升查询性能，不会影响现有功能。

---

### 二、Prisma 查询优化（阶段 5A）

#### 优化 1：列表查询使用 `select` 精确返回字段

**问题：** 当前列表查询返回所有字段（包括大文本 `comment`），浪费带宽。

**优化方案：**

```typescript
// src/repositories/movie.repository.ts

/**
 * 查询影片列表(优化版：精确返回字段)
 */
static async findMany(params: {
  where?: Prisma.MovieWhereInput;
  orderBy?: Prisma.MovieOrderByWithRelationInput;
  skip?: number;
  take?: number;
}) {
  return prisma.movie.findMany({
    where: params.where,
    select: {
      id: true,
      title: true,
      type: true,
      rating: true,
      releaseYear: true,
      // comment: false,  // 列表不需要评语（避免传输大文本）
      createdAt: true,
      updatedAt: true,
      images: {
        where: { isCover: true },
        select: {
          id: true,
          path: true,
        },
      },
      movieTags: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: params.orderBy,
    skip: params.skip,
    take: params.take,
  });
}
```

**收益：** 减少 30-50% 的数据传输量，提升列表加载速度。

#### 优化 2：更新操作使用事务

**问题：** `update` 方法中删除标签和创建标签不在事务中，可能导致数据不一致。

**优化方案：**

```typescript
// src/repositories/movie.repository.ts

/**
 * 更新影片信息(使用事务保证一致性)
 */
static async update(
  id: number,
  data: {
    title?: string;
    type?: string;
    rating?: number;
    releaseYear?: number;
    comment?: string;
    tagIds?: number[];
  }
) {
  return prisma.$transaction(async (tx) => {
    // 如果更新标签，先删除旧关联
    if (data.tagIds !== undefined) {
      await tx.movieTag.deleteMany({
        where: { movieId: id },
      });
    }

    // 更新影片信息
    return tx.movie.update({
      where: { id },
      data: {
        title: data.title,
        type: data.type,
        rating: data.rating,
        releaseYear: data.releaseYear,
        comment: data.comment,
        ...(data.tagIds !== undefined && {
          movieTags: {
            create: data.tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: {
        images: true,
        movieTags: {
          include: {
            tag: true,
          },
        },
      },
    });
  });
}
```

**收益：** 保证数据一致性，避免更新失败时出现脏数据。

#### 实施步骤

1. 修改 `src/repositories/movie.repository.ts`
2. 手动测试列表查询和更新功能
3. 对比优化前后的响应大小（通过浏览器 Network 面板）

**风险：** 低。修改仅优化查询，不改变业务逻辑。

---

### 三、测试系统设计（阶段 5B）

#### 技术选型

- **测试框架：** Vitest（速度快、TypeScript 集成好）
- **API 测试：** Supertest（HTTP 集成测试）
- **测试数据：** @faker-js/faker（生成随机测试数据）
- **覆盖率：** c8（代码覆盖率报告）

#### 目录结构

```
tests/
├── setup.ts                    # 测试全局配置
├── helpers/
│   ├── testDb.ts              # 测试数据库工具
│   └── authHelper.ts          # 测试认证辅助函数
├── unit/                       # 单元测试
│   ├── services/
│   │   ├── auth.service.test.ts
│   │   └── movie.service.test.ts
│   └── utils/
│       ├── jwt.util.test.ts
│       └── password.util.test.ts
└── integration/                # 集成测试（API 测试）
    ├── auth.test.ts            # 登录接口测试
    ├── movie.test.ts           # 影片 CRUD 测试
    └── movie-query.test.ts     # 影片筛选查询测试
```

#### 测试覆盖范围（核心流程）

**1. 认证系统**
- 单元测试：JWT 生成/验证、密码加密/比较
- 集成测试：登录成功、登录失败（用户名错误、密码错误）、Token 验证

**2. 影片 CRUD**
- 集成测试：创建影片、查询详情、更新影片、删除影片

**3. 影片查询**
- 集成测试：分页查询、类型筛选、评分筛选、标签筛选、组合筛选、排序

#### 测试数据库策略

- 使用独立的测试数据库：`practical_project_test`
- 每个测试套件运行前清理数据
- 使用 Prisma 的 `prisma.$transaction` 或手动清理

#### 实施步骤

1. 安装依赖：`npm install -D vitest supertest @faker-js/faker @types/supertest c8`
2. 配置 `vitest.config.ts`
3. 创建测试数据库和清理脚本
4. 编写测试辅助工具
5. 编写核心业务测试
6. 运行测试并查看覆盖率报告

**验收标准：** 核心业务流程测试覆盖率 > 70%

---

### 四、安全加固设计（阶段 5B）

#### 4.1 输入验证（Zod）

**目录结构：**

```
src/
├── validations/              # Zod schemas
│   ├── auth.validation.ts    # 登录验证
│   ├── movie.validation.ts   # 影片验证
│   └── common.validation.ts  # 通用验证（分页等）
└── middlewares/
    └── validate.middleware.ts # 验证中间件
```

**示例 Schema：**

```typescript
// src/validations/movie.validation.ts
import { z } from 'zod';

export const createMovieSchema = z.object({
  body: z.object({
    title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
    type: z.enum(['movie', 'tv', 'anime', 'anime_movie'], {
      errorMap: () => ({ message: '无效的影片类型' }),
    }),
    rating: z.number().min(0).max(10).optional(),
    releaseYear: z.number().int().min(1900).max(2100).optional(),
    comment: z.string().optional(),
    tagIds: z.array(z.number().int().positive()).optional(),
  }),
});

export const queryMoviesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    type: z.enum(['movie', 'tv', 'anime', 'anime_movie']).optional(),
    minRating: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    maxRating: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    minYear: z.string().regex(/^\d+$/).transform(Number).optional(),
    maxYear: z.string().regex(/^\d+$/).transform(Number).optional(),
    tagIds: z.string().transform((val) => val.split(',').map(Number)).optional(),
    keyword: z.string().optional(),
    sortBy: z.enum(['rating', 'releaseYear', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
});
```

**验证中间件：**

```typescript
// src/middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../types/error';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        next(new ValidationError(messages.join('; ')));
      } else {
        next(error);
      }
    }
  };
};
```

**使用方式：**

```typescript
// src/routes/movie.routes.ts
import { validate } from '../middlewares/validate.middleware';
import { createMovieSchema, queryMoviesSchema } from '../validations/movie.validation';

router.post('/', authMiddleware, validate(createMovieSchema), MovieController.create);
router.get('/', authMiddleware, validate(queryMoviesSchema), MovieController.getAll);
```

#### 4.2 安全中间件配置

**新增中间件：**

1. **XSS 防护** (`xss-clean`)
   - 清理请求体、查询参数中的 XSS 攻击代码

2. **CSRF 防护** (`csurf`)
   - 对于纯 API 应用，CSRF 防护是可选的
   - 如果前端使用 Cookie 存储 Token，建议启用

3. **增强请求频率限制** (`express-rate-limit`)
   - 全局限制：15 分钟 100 次
   - 登录接口：15 分钟 5 次（防暴力破解）
   - 上传接口：1 小时 20 次

**中间件注册顺序：**

```typescript
// src/app.ts
app.use(helmet());                    // 安全头
app.use(cors(corsOptions));           // 跨域
app.use(xssClean());                  // XSS 防护（新增）
app.use(apiLimiter);                  // 频率限制（增强配置）
app.use(express.json());              // Body 解析
app.use(express.static('uploads'));   // 静态文件
app.use(requestLogger);               // 请求日志
// app.use(csrfProtection);           // CSRF（可选）
app.use('/api', routes);              // 路由
```

**环境变量：**

```env
# 安全配置
RATE_LIMIT_WINDOW_MS=900000           # 15分钟
RATE_LIMIT_MAX_REQUESTS=100           # 最大请求数
LOGIN_RATE_LIMIT_MAX=5                # 登录最大失败次数
UPLOAD_RATE_LIMIT_MAX=20              # 上传最大次数
CSRF_ENABLED=false                    # CSRF 开关
```

#### 实施步骤

1. 安装依赖：`npm install zod xss-clean csurf`
2. 创建 validation schemas
3. 实现 validate 中间件
4. 集成到路由中
5. 添加安全中间件
6. 更新环境变量
7. 手动测试验证（发送恶意输入）

**验收标准：**
- 所有核心接口添加输入验证
- 恶意输入被正确拦截
- 错误信息清晰友好

---

## 实施优先级总结

### 🚀 阶段 5A：立即优化（建议现在完成）

**预计时间：** 1-2 小时

| 任务 | 难度 | 收益 | 风险 |
|------|------|------|------|
| 添加数据库索引 | ⭐ | 🔥🔥🔥 | 低 |
| 优化列表查询（select） | ⭐⭐ | 🔥🔥 | 低 |
| 更新操作使用事务 | ⭐⭐ | 🔥🔥 | 低 |

**完成后效果：**
- 列表查询速度提升 50-80%
- API 响应大小减少 30-50%
- 数据一致性保证

**适合场景：**
- 前端对接前完成，让前端调试时体验更好
- 不影响现有功能，可以放心操作

---

### 📚 阶段 5B：测试与安全（建议前端对接后学习）

**预计时间：** 8-12 小时（学习 + 实践）

| 任务 | 学习成本 | 收益 | 紧急度 |
|------|---------|------|--------|
| 测试环境搭建 | ⭐⭐⭐ | 🔥🔥🔥 | 中 |
| 编写核心测试 | ⭐⭐⭐⭐ | 🔥🔥🔥 | 中 |
| Zod 输入验证 | ⭐⭐⭐ | 🔥🔥 | 低 |
| XSS/CSRF 防护 | ⭐⭐ | 🔥 | 低 |
| 频率限制增强 | ⭐ | 🔥 | 低 |

**完成后效果：**
- 测试保障代码质量
- 深入理解测试驱动开发
- 掌握企业级安全最佳实践

**适合场景：**
- 前端基本功能对接完成后
- 有时间深入学习测试和安全知识时
- 准备面试或提升技能时

---

## 验收标准

### 阶段 5A 验收

- ✅ 数据库迁移成功，5 个新索引创建完成
- ✅ 列表查询不再返回 `comment` 字段
- ✅ 更新影片标签操作在事务中执行
- ✅ 手动测试：所有现有功能正常工作
- ✅ 性能对比：列表查询响应更快

### 阶段 5B 验收

- ✅ 核心业务流程测试覆盖率 > 70%
- ✅ 所有测试通过（绿色状态）
- ✅ 所有核心 API 接口添加 Zod 验证
- ✅ 安全中间件已配置并启用
- ✅ 手动验证：恶意输入被正确拦截
- ✅ 文档更新：测试运行说明、安全配置说明

---

## 相关文档

- [阶段一：项目初始化](./phase-1.md)
- [阶段二：项目架构搭建](./phase-2.md)
- [阶段三：用户认证系统](./phase-3.md)
- [阶段四：影片收藏子系统](./phase-4.md)
- [项目架构文档](../architecture.md)

---

## 学习资源

**测试相关：**
- [Vitest 官方文档](https://vitest.dev/)
- [Supertest GitHub](https://github.com/ladjs/supertest)
- [测试驱动开发（TDD）入门](https://jestjs.io/docs/getting-started)

**安全相关：**
- [Zod 官方文档](https://zod.dev/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js 安全最佳实践](https://expressjs.com/en/advanced/best-practice-security.html)

**性能优化：**
- [Prisma 性能优化指南](https://www.prisma.io/docs/guides/performance-and-optimization)
- [数据库索引原理](https://use-the-index-luke.com/)
