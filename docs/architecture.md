# 项目架构文档

> 本文档说明项目的整体架构设计、目录结构、各层职责以及开发规范。

---

## 目录结构

```
src/
├── config/          # 配置文件
│   ├── database.ts  # Prisma 数据库客户端（含 adapter 配置）
│   ├── env.ts       # 环境变量配置与验证
│   └── upload.ts    # 文件上传配置（multer）
├── controllers/     # 控制器层
│   ├── auth.controller.ts   # 认证控制器（登录接口）
│   ├── movie.controller.ts  # 影片控制器（CRUD）
│   └── tag.controller.ts    # 标签控制器（CRUD）
├── services/        # 服务层
│   ├── auth.service.ts      # 认证服务（登录业务逻辑）
│   ├── movie.service.ts     # 影片服务（业务逻辑）
│   └── tag.service.ts       # 标签服务（业务逻辑）
├── repositories/    # 数据访问层
│   ├── user.repository.ts   # 用户数据访问
│   ├── movie.repository.ts  # 影片数据访问
│   └── tag.repository.ts    # 标签数据访问
├── middlewares/     # 中间件
│   ├── errorHandler.ts      # 全局错误处理
│   ├── notFound.ts          # 404 路由处理
│   ├── requestLogger.ts     # 请求日志记录
│   ├── auth.middleware.ts   # JWT 认证中间件
│   └── index.ts             # 统一导出
├── routes/          # 路由定义
│   ├── index.ts         # 主路由（含健康检查）
│   ├── auth.routes.ts   # 认证路由
│   ├── movie.routes.ts  # 影片路由
│   └── tag.routes.ts    # 标签路由
├── utils/           # 工具函数
│   ├── response.ts       # 统一响应格式工具
│   ├── logger.ts         # 日志工具
│   ├── asyncHandler.ts   # 异步路由错误处理包装器
│   ├── password.util.ts  # 密码加密工具（bcrypt）
│   ├── jwt.util.ts       # JWT 生成与验证工具
│   └── file.util.ts      # 文件操作工具
├── types/           # TypeScript 类型定义
│   ├── response.ts  # API 响应类型接口
│   ├── error.ts     # 自定义错误类型
│   └── index.ts     # 统一导出
├── app.ts           # Express 应用配置（中间件注册）
└── index.ts         # 应用入口（启动、关闭逻辑）
```

---

## 三层架构职责

采用 **Controller → Service → Repository** 三层架构，每层只负责自己的工作：

### Controller 层（控制器）

- 接收 HTTP 请求（`req`）
- 验证请求参数（格式、必填项）
- 调用 Service 层处理业务
- 返回 HTTP 响应（`res`）

```typescript
// 示例：UserController
async getUser(req: Request, res: Response) {
  const { id } = req.params;
  const user = await userService.findById(id); // 调用 Service 层
  ResponseUtil.success(res, user);              // 返回响应
}
```

### Service 层（服务）

- 实现业务逻辑（如：注册时检查邮箱是否重复）
- 调用 Repository 层获取数据
- 处理数据转换和业务规则
- 不直接接触 HTTP 对象（`req`、`res`）

```typescript
// 示例：UserService
async findById(id: string) {
  const user = await userRepository.findById(id); // 调用 Repository 层
  if (!user) throw new NotFoundError('用户不存在');
  return user;
}
```

### Repository 层（数据仓库）

- 执行数据库查询（封装 Prisma 操作）
- 返回原始数据（不包含业务逻辑）
- 隔离数据库实现细节

```typescript
// 示例：UserRepository
async findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
```

---

## 统一响应格式

所有 API 接口返回固定的 JSON 结构，方便前端统一处理。

### 成功响应

```json
{
  "success": true,
  "message": "Success",
  "data": { "id": 1, "name": "张三" },
  "timestamp": "2026-02-19T08:00:00.000Z"
}
```

### 错误响应

```json
{
  "success": false,
  "message": "用户不存在",
  "error": "详细错误信息（仅开发环境显示）",
  "timestamp": "2026-02-19T08:00:00.000Z"
}
```

### 分页响应

```json
{
  "success": true,
  "message": "Success",
  "data": [{ "id": 1 }, { "id": 2 }],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2026-02-19T08:00:00.000Z"
}
```

---

## 错误处理流程

```
业务代码抛出错误
       ↓
asyncHandler 捕获（Promise.catch）
       ↓
Express 将错误传给 next(err)
       ↓
errorHandler 中间件统一处理
       ↓
返回标准化错误 JSON 响应
```

### 自定义错误类型

| 错误类 | HTTP 状态码 | 使用场景 |
|--------|------------|---------|
| `AppError` | 500 | 通用服务器错误（基类） |
| `ValidationError` | 400 | 请求参数格式错误 |
| `UnauthorizedError` | 401 | 未登录或 Token 无效 |
| `ForbiddenError` | 403 | 无权限访问 |
| `NotFoundError` | 404 | 资源不存在 |
| `ConflictError` | 409 | 资源冲突（如邮箱已注册） |

---

## 中间件配置

中间件的注册顺序很重要，Express 按注册顺序依次执行：

```
请求进入
   ↓
1. Helmet（安全头）
   ↓
2. CORS（跨域配置）
   ↓
3. Rate Limit（速率限制，仅 /api 路径）
   ↓
4. Body Parser（解析 JSON 请求体）
   ↓
5. Static Files（静态文件 /uploads）
   ↓
6. Request Logger（记录请求日志）
   ↓
7. Routes（路由处理）
   ↓
8. 404 Handler（未匹配路由）
   ↓
9. Error Handler（统一错误处理）
```

### 安全中间件

| 中间件 | 作用 |
|--------|------|
| **Helmet** | 自动设置安全相关的 HTTP 响应头（防 XSS、点击劫持等） |
| **CORS** | 配置跨域资源共享，控制哪些域名可以访问 API |
| **Rate Limit** | 限制单个 IP 的请求频率（15分钟内最多 100 次） |

---

## 数据库配置（Prisma 7）

本项目使用 Prisma 7，其配置方式与旧版本有所不同：

- **`prisma/schema.prisma`**：定义数据模型
- **`prisma.config.ts`**（根目录）：配置数据源 URL（Prisma 7 新方式）
- **Driver Adapter**：使用 `@prisma/adapter-pg` 连接 PostgreSQL

数据库通过 Docker Compose 启动，使用 PostgreSQL 15。

### 数据库索引

为提升查询性能，已为高频查询字段添加索引：

| 表名 | 索引字段 | 使用场景 |
|------|---------|---------|
| Movie | type | 按类型筛选 |
| Movie | rating | 按评分排序 |
| Movie | releaseYear | 按年份筛选 |
| Movie | createdAt | 按创建时间排序 |
| Image | movieId | 查询影片图片 |

这些索引能够显著提升影片列表查询的性能，特别是在数据量增长后。

---

## 认证系统架构

### JWT 认证流程

```
客户端登录
   ↓
POST /api/v1/auth/login { username, password }
   ↓
AuthController（验证参数）
   ↓
AuthService（验证用户、密码）
   ↓
UserRepository（查询数据库）
   ↓
PasswordUtil.compare（验证密码）
   ↓
JwtUtil.generateToken（生成 JWT）
   ↓
返回 { token, user }
```

### 受保护路由访问流程

```
客户端请求受保护资源
   ↓
Headers: Authorization: Bearer <token>
   ↓
authMiddleware 中间件拦截
   ↓
JwtUtil.verifyToken（验证 JWT）
   ↓
req.user = payload（挂载用户信息）
   ↓
路由处理函数（可通过 req.user 获取用户信息）
```

### 认证相关工具

| 工具类 | 职责 | 主要方法 |
|--------|------|---------|
| **PasswordUtil** | 密码加密与验证 | `hash(password)` - 加密密码<br>`compare(password, hash)` - 验证密码 |
| **JwtUtil** | JWT 令牌管理 | `generateToken(payload)` - 生成 JWT<br>`verifyToken(token)` - 验证 JWT<br>`decodeToken(token)` - 解码 JWT（不验证） |

### 数据模型

**User 模型**（`prisma/schema.prisma`）

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

### 认证 API 端点

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录 | 无 |

**登录请求示例：**

```json
{
  "username": "admin",
  "password": "admin123456"
}
```

**登录响应示例：**

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
  "timestamp": "2026-02-21T11:11:18.854Z"
}
```

### 安全特性

1. **密码加密**：使用 bcrypt 哈希算法（salt rounds: 10）
2. **JWT 过期时间**：默认 7 天（可通过 `JWT_EXPIRES_IN` 环境变量配置）
3. **防用户枚举**：用户不存在和密码错误返回相同错误信息
4. **密码不返回**：登录响应中不包含密码字段
5. **Token 格式验证**：必须使用 `Bearer <token>` 格式

---

## 开发最佳实践

1. **DRY（不要重复自己）** — 使用 `ResponseUtil` 统一响应，使用 `AppError` 统一错误
2. **关注点分离** — Controller/Service/Repository 各司其职，不越界
3. **错误处理** — 使用 `asyncHandler` 包装异步路由，避免遗漏错误
4. **类型安全** — 充分利用 TypeScript 类型，避免运行时错误
5. **环境变量** — 所有配置通过环境变量管理，不硬编码敏感信息
6. **优雅关闭** — 监听 `SIGTERM`/`SIGINT` 信号，安全关闭服务器和数据库连接

---

## 影片收藏系统架构

### 数据模型设计

影片收藏系统使用 4 个数据表，通过 Prisma 管理关系：

```prisma
// 影片表
model Movie {
  id          Int         @id @default(autoincrement())
  title       String      // 标题
  type        String      // 类型: movie/tv/anime/anime_movie
  rating      Float?      // 评分 (0-10)
  releaseYear Int?        // 上映年份
  comment     String?     @db.Text  // 个人评语
  coverImage  String?     // 封面图片相对路径
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  images      Image[]     // 一对多关系：一个影片有多张图片
  movieTags   MovieTag[]  // 多对多关系：影片-标签中间表

  @@map("movies")
}

// 图片表
model Image {
  id        Int      @id @default(autoincrement())
  path      String   // 图片相对路径
  movieId   Int      // 外键：所属影片 ID
  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@map("images")
}

// 标签表
model Tag {
  id        Int        @id @default(autoincrement())
  name      String     @unique  // 标签名称（唯一）
  createdAt DateTime   @default(now())

  movieTags MovieTag[]  // 多对多关系：标签-影片中间表

  @@map("tags")
}

// 影片-标签关联表（多对多中间表）
model MovieTag {
  movieId Int
  tagId   Int
  movie   Movie @relation(fields: [movieId], references: [id], onDelete: Cascade)
  tag     Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([movieId, tagId])  // 复合主键
  @@map("movie_tags")
}
```

### 关系说明

| 关系类型 | 说明 | 实现方式 |
|---------|------|---------|
| **一对多** | Movie ↔ Image | `@relation` + 外键 `movieId`<br>删除影片时级联删除图片 (`onDelete: Cascade`) |
| **多对多** | Movie ↔ Tag | 通过中间表 `MovieTag` 实现<br>删除影片/标签时级联删除关联记录 |

### 文件上传架构

**文件存储结构：**

```
uploads/
└── movies/
    ├── uuid-timestamp.jpg
    ├── uuid-timestamp.png
    └── ...
```

**上传配置（`src/config/upload.ts`）：**

```typescript
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// 存储配置
const storage = multer.diskStorage({
  destination: 'uploads/movies',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器：只允许图片类型
const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('不支持的文件类型'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB 限制
});
```

**安全特性：**

1. **文件类型验证**：仅允许 JPG、PNG、WEBP 格式
2. **文件大小限制**：最大 5MB（可通过环境变量配置）
3. **UUID 命名**：避免文件名冲突和路径遍历攻击
4. **事务一致性**：创建/删除失败时自动清理已上传的文件

### API 端点设计

#### 影片接口

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/movies` | 创建影片（支持上传多张图片） | ✅ |
| GET | `/api/v1/movies` | 查询影片列表（支持筛选、分页、排序） | ✅ |
| GET | `/api/v1/movies/:id` | 查询影片详情 | ✅ |
| PUT | `/api/v1/movies/:id` | 更新影片信息 | ✅ |
| DELETE | `/api/v1/movies/:id` | 删除影片（级联删除图片和标签关联） | ✅ |
| POST | `/api/v1/movies/:id/images` | 添加图片到影片 | ✅ |
| DELETE | `/api/v1/movies/:id/images/:imageId` | 删除影片的图片 | ✅ |

#### 标签接口

| 方法 | 路径 | 功能 | 鉴权 | 权限 |
|------|------|------|------|------|
| POST | `/api/v1/tags` | 创建标签 | ✅ | 仅管理员 |
| GET | `/api/v1/tags` | 查询所有标签 | ✅ | - |

### 高级查询功能

**查询影片列表支持的筛选参数：**

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `page` | number | 页码（默认 1） | `?page=2` |
| `limit` | number | 每页条数（默认 10，最大 100） | `?limit=20` |
| `type` | string | 影片类型 | `?type=movie` |
| `tagIds` | string | 标签 ID 列表（逗号分隔） | `?tagIds=1,2,3` |
| `minRating` | number | 最低评分 | `?minRating=8.0` |
| `maxRating` | number | 最高评分 | `?maxRating=9.5` |
| `minYear` | number | 最早年份 | `?minYear=2020` |
| `maxYear` | number | 最晚年份 | `?maxYear=2023` |
| `keyword` | string | 关键词搜索（标题、评语） | `?keyword=星际` |
| `sortBy` | string | 排序字段 | `?sortBy=rating` |
| `order` | string | 排序方向（asc/desc） | `?order=desc` |

**示例请求：**

```bash
# 查询评分 8.0 以上的科幻电影，按评分降序排列
GET /api/v1/movies?type=movie&tagIds=1&minRating=8.0&sortBy=rating&order=desc
```

**查询实现特点：**

1. **动态条件构建**：根据传入参数动态构建 Prisma `where` 条件
2. **关键词搜索**：使用 `contains` + `mode: 'insensitive'` 实现大小写不敏感搜索
3. **标签筛选**：使用嵌套关系查询 `some` 匹配标签
4. **性能优化**：
   - 列表查询只返回封面图（不返回所有图片）
   - 使用 `include` 避免 N+1 查询
   - 限制最大查询条数

### 业务流程示例

**创建影片流程：**

```
客户端上传表单（multipart/form-data）
   ↓
multer 中间件处理文件上传
   ↓
MovieController（验证参数）
   ↓
MovieService（业务逻辑）
   ├─ 验证标签是否存在
   ├─ 使用事务创建影片、图片、标签关联
   └─ 失败时自动清理已上传的文件
   ↓
MovieRepository（数据库操作）
   ↓
返回创建的影片数据（含图片列表和标签）
```

**删除影片流程（级联删除）：**

```
客户端发送删除请求
   ↓
MovieController（验证影片 ID）
   ↓
MovieService（业务逻辑）
   ├─ 查询影片及关联的图片
   ├─ 删除数据库记录（级联删除图片和标签关联）
   └─ 删除文件系统中的图片文件
   ↓
返回删除成功
```

### 关键技术实现

1. **事务管理**：创建影片时使用 Prisma 事务确保数据一致性
2. **文件清理**：删除操作失败时自动清理已上传的文件
3. **级联删除**：使用 `onDelete: Cascade` 自动清理关联数据
4. **权限控制**：创建标签接口仅管理员可访问（通过 `req.user.role` 验证）
5. **数据验证**：Controller 和 Service 层都进行数据验证
