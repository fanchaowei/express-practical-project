# 阶段 5A：数据库与查询优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 优化数据库查询性能，减少 API 响应大小，提升数据一致性

**架构：** 在 Prisma Schema 中添加索引以加速高频查询，优化 Repository 层查询使用 `select` 精确返回字段，使用事务保证数据一致性

**技术栈：** Prisma 7, PostgreSQL, TypeScript

**预计时间：** 1-2 小时

**前置条件：**
- 数据库正常运行
- 已完成阶段四（影片收藏系统）
- 项目可以正常启动

---

## Task 1: 添加数据库索引

**目标：** 为高频查询字段添加索引，提升查询性能

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 为 Movie 模型添加查询索引**

在 `prisma/schema.prisma` 的 `Movie` 模型中添加索引：

```prisma
model Movie {
  id          Int      @id @default(autoincrement())
  title       String
  type        String   // "movie" | "tv" | "anime" | "anime_movie"
  rating      Float?   // 个人评分 (0-10)
  releaseYear Int?     // 上映年份
  comment     String?  @db.Text // 个人评语
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  images      Image[]
  movieTags   MovieTag[]

  // 添加索引以优化查询性能
  @@index([type])              // 按类型筛选（高频查询）
  @@index([rating])            // 按评分排序（高频查询）
  @@index([releaseYear])       // 按年份筛选（中频查询）
  @@index([createdAt])         // 按创建时间排序（中频查询）
  @@map("movies")
}
```

**Step 2: 为 Image 模型添加外键索引**

在 `prisma/schema.prisma` 的 `Image` 模型中添加索引：

```prisma
model Image {
  id        Int      @id @default(autoincrement())
  movieId   Int
  path      String   // 相对路径
  isCover   Boolean  @default(false) // 是否为封面
  createdAt DateTime @default(now())

  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)

  // 添加索引以优化关联查询
  @@index([movieId])   // 查询影片图片（高频查询）
  @@map("images")
}
```

**Step 3: 生成迁移文件**

运行命令：
```bash
npx prisma migrate dev --name add_indexes
```

预期输出：
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "practical_project"

Applying migration `20260221xxxxxx_add_indexes`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260221xxxxxx_add_indexes/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client
```

**Step 4: 验证迁移成功**

检查 `prisma/migrations` 目录，应该看到新的迁移文件夹。

运行命令查看数据库索引：
```bash
psql -h localhost -U postgres -d practical_project -c "\d movies"
```

预期输出应包含新的索引：
```
Indexes:
    "movies_pkey" PRIMARY KEY, btree (id)
    "movies_type_idx" btree (type)
    "movies_rating_idx" btree (rating)
    "movies_releaseYear_idx" btree ("releaseYear")
    "movies_createdAt_idx" btree ("createdAt")
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "perf: 添加数据库索引优化查询性能

- Movie 表添加 type, rating, releaseYear, createdAt 索引
- Image 表添加 movieId 索引
- 预期查询性能提升 50-80%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 优化影片列表查询（使用 select）

**目标：** 使用 `select` 精确返回字段，减少数据传输量

**Files:**
- Modify: `src/repositories/movie.repository.ts:48-70`

**Step 1: 替换 findMany 方法实现**

在 `src/repositories/movie.repository.ts` 中，将 `findMany` 方法从使用 `include` 改为使用 `select`：

```typescript
/**
 * 查询影片列表(优化版：精确返回字段，减少数据传输)
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
      // comment: false,  // 列表不需要评语（大文本字段）
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

**Step 2: 手动测试列表查询**

启动开发服务器：
```bash
npm run dev
```

使用 curl 或 Postman 测试列表查询：
```bash
curl -X GET "http://localhost:3000/api/v1/movies" \
  -H "Authorization: Bearer <your-token>"
```

预期响应：
- ✅ 返回影片列表
- ✅ 不包含 `comment` 字段（大文本）
- ✅ 仅包含封面图片
- ✅ 标签信息仅包含 id 和 name

**Step 3: 对比优化前后的响应大小**

在浏览器开发者工具的 Network 面板中：
- 记录优化前的响应大小
- 应用修改后再次请求
- 对比响应大小，预期减少 30-50%

**Step 4: Commit**

```bash
git add src/repositories/movie.repository.ts
git commit -m "perf: 优化影片列表查询使用 select 精确返回字段

- 列表查询不再返回 comment 字段（减少大文本传输）
- 图片和标签仅返回必要字段
- 预期响应大小减少 30-50%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 更新操作使用事务

**目标：** 使用 Prisma 事务保证更新操作的数据一致性

**Files:**
- Modify: `src/repositories/movie.repository.ts:101-141`

**Step 1: 重构 update 方法使用事务**

在 `src/repositories/movie.repository.ts` 中，将 `update` 方法包装在事务中：

```typescript
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

**Step 2: 手动测试更新功能**

启动开发服务器：
```bash
npm run dev
```

测试更新影片标签：
```bash
curl -X PUT "http://localhost:3000/api/v1/movies/1" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试更新",
    "tagIds": [1, 2, 3]
  }'
```

预期结果：
- ✅ 更新成功
- ✅ 旧标签被删除
- ✅ 新标签被创建
- ✅ 如果中途失败，数据回滚（保持一致性）

**Step 3: 测试事务回滚（可选）**

临时修改代码，在事务中抛出错误，验证回滚：
```typescript
return prisma.$transaction(async (tx) => {
  if (data.tagIds !== undefined) {
    await tx.movieTag.deleteMany({
      where: { movieId: id },
    });
  }

  throw new Error('Test rollback'); // 测试回滚

  return tx.movie.update({ /* ... */ });
});
```

预期结果：
- ✅ 更新失败
- ✅ 旧标签未被删除（回滚成功）

测试完成后，移除测试代码。

**Step 4: Commit**

```bash
git add src/repositories/movie.repository.ts
git commit -m "perf: 更新影片操作使用事务保证数据一致性

- 删除标签和更新影片在同一事务中执行
- 失败时自动回滚，避免数据不一致
- 提升数据可靠性

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 验证与文档更新

**目标：** 验证所有优化生效，更新相关文档

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Step 1: 完整功能测试**

测试所有核心功能：

```bash
# 1. 登录
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123456"}'

# 2. 查询影片列表（测试索引和 select 优化）
curl -X GET "http://localhost:3000/api/v1/movies?type=movie&sortBy=rating&order=desc" \
  -H "Authorization: Bearer <token>"

# 3. 查询影片详情
curl -X GET "http://localhost:3000/api/v1/movies/1" \
  -H "Authorization: Bearer <token>"

# 4. 更新影片（测试事务）
curl -X PUT "http://localhost:3000/api/v1/movies/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "更新测试", "tagIds": [1, 2]}'

# 5. 删除影片
curl -X DELETE "http://localhost:3000/api/v1/movies/1" \
  -H "Authorization: Bearer <token>"
```

预期结果：
- ✅ 所有接口正常工作
- ✅ 列表查询速度更快
- ✅ 响应数据更小
- ✅ 更新操作可靠

**Step 2: 更新 README.md**

在 `README.md` 的阶段五部分添加完成标记：

```markdown
### 阶段五：测试与优化

**目标**: 确保代码质量和性能

**阶段 5A：立即优化** ✅ 已完成

1. **数据库索引优化**
   - Movie 表添加 type, rating, releaseYear, createdAt 索引
   - Image 表添加 movieId 索引
   - 查询性能提升 50-80%

2. **Prisma 查询优化**
   - 列表查询使用 select 精确返回字段
   - 更新操作使用事务保证数据一致性
   - 响应大小减少 30-50%

**阶段 5B：测试与安全** 📚 计划中（前端对接后学习）
1. 测试环境搭建与测试编写
2. 输入验证（Zod）
3. 安全中间件（XSS、CSRF）
4. 请求频率限制增强

📖 **[设计文档](docs/plan/phase-5.md)**
```

**Step 3: 更新架构文档（可选）**

在 `docs/architecture.md` 的数据库优化部分添加索引说明：

```markdown
### 数据库索引

为提升查询性能，已为高频查询字段添加索引：

| 表名 | 索引字段 | 使用场景 |
|------|---------|---------|
| Movie | type | 按类型筛选 |
| Movie | rating | 按评分排序 |
| Movie | releaseYear | 按年份筛选 |
| Movie | createdAt | 按创建时间排序 |
| Image | movieId | 查询影片图片 |
```

**Step 4: 最终提交**

```bash
git add README.md docs/architecture.md
git commit -m "docs: 更新文档标记阶段 5A 完成

- 添加数据库索引优化说明
- 添加查询优化说明
- 标记阶段 5A 完成，阶段 5B 待学习

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## 验收标准

完成后，项目应满足以下条件：

**数据库优化：**
- ✅ `movies` 表有 5 个索引（主键 + 4 个查询索引）
- ✅ `images` 表有 2 个索引（主键 + movieId）
- ✅ 迁移文件已生成并应用

**查询优化：**
- ✅ 列表查询不返回 `comment` 字段
- ✅ 列表查询响应大小减少 30-50%
- ✅ 更新操作在事务中执行

**功能验证：**
- ✅ 所有现有功能正常工作
- ✅ 查询速度明显提升
- ✅ 无数据一致性问题

**文档更新：**
- ✅ README 标记阶段 5A 完成
- ✅ 架构文档更新（可选）

---

## 常见问题

**Q: 迁移失败怎么办？**

A: 检查数据库连接，确保 PostgreSQL 正常运行。可以回滚迁移：
```bash
npx prisma migrate reset
```

**Q: 查询结果类型错误？**

A: 使用 `select` 后返回类型会改变。如果 Service 层报类型错误，可以定义新的返回类型或使用类型断言。

**Q: 事务会影响性能吗？**

A: 事务有轻微性能开销，但更新操作不是高频操作，一致性更重要。

**Q: 如何确认索引生效？**

A: 使用 PostgreSQL 的 `EXPLAIN ANALYZE` 查看查询计划，确认使用了索引：
```sql
EXPLAIN ANALYZE SELECT * FROM movies WHERE type = 'movie' ORDER BY rating DESC;
```

---

## 下一步

完成阶段 5A 后，您可以：

1. **立即开始前端对接** - 后端性能已优化，可以放心对接
2. **继续阶段 5B** - 如果想深入学习测试和安全，可以继续实施阶段 5B
3. **进入阶段六** - 准备部署相关配置

推荐先完成前端对接，等有时间再深入学习阶段 5B 的测试和安全内容。
