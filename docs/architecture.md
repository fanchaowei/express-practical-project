# 项目架构文档

> 本文档说明项目的整体架构设计、目录结构、各层职责以及开发规范。

---

## 目录结构

```
src/
├── config/          # 配置文件
│   ├── database.ts  # Prisma 数据库客户端（含 adapter 配置）
│   └── env.ts       # 环境变量配置与验证
├── controllers/     # 控制器层（待添加）
├── services/        # 服务层（待添加）
├── repositories/    # 数据访问层（待添加）
├── middlewares/     # 中间件
│   ├── errorHandler.ts     # 全局错误处理
│   ├── notFound.ts         # 404 路由处理
│   ├── requestLogger.ts    # 请求日志记录
│   └── index.ts            # 统一导出
├── routes/          # 路由定义
│   └── index.ts     # 主路由（含健康检查）
├── utils/           # 工具函数
│   ├── response.ts       # 统一响应格式工具
│   ├── logger.ts         # 日志工具
│   └── asyncHandler.ts   # 异步路由错误处理包装器
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
- **Driver Adapter**：使用 `@prisma/adapter-better-sqlite3` 连接 SQLite

开发环境使用 SQLite（文件型数据库），生产环境可切换为 PostgreSQL。

---

## 开发最佳实践

1. **DRY（不要重复自己）** — 使用 `ResponseUtil` 统一响应，使用 `AppError` 统一错误
2. **关注点分离** — Controller/Service/Repository 各司其职，不越界
3. **错误处理** — 使用 `asyncHandler` 包装异步路由，避免遗漏错误
4. **类型安全** — 充分利用 TypeScript 类型，避免运行时错误
5. **环境变量** — 所有配置通过环境变量管理，不硬编码敏感信息
6. **优雅关闭** — 监听 `SIGTERM`/`SIGINT` 信号，安全关闭服务器和数据库连接
