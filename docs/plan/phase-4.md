# 阶段四：影片收藏子系统

## 目标

实现第一个业务子系统——影片收藏管理，应用 JWT 鉴权机制，学习文件上传、关系模型和复杂查询。

## 前置条件

- 已完成 [阶段一：项目初始化与环境搭建](./phase-1.md)
- 已完成 [阶段二：项目架构搭建](./phase-2.md)
- 已完成 [阶段三：用户认证系统](./phase-3.md)
- Docker 容器正常运行
- 管理员账户已创建
- 可以成功登录并获取 JWT token

---

## 核心功能

1. **影片管理** - 添加、查询、编辑、删除影片
2. **图片上传** - 创建时一次性上传多张图片，编辑时单独管理
3. **标签系统** - 预设标签库，影片可选择多个标签
4. **高级查询** - 多条件筛选、分页、排序、关键词搜索
5. **JWT鉴权** - 所有接口都需要登录才能访问

---

## 步骤 1：更新环境变量

### 1.1 编辑 .env 文件

添加文件上传配置（如果阶段一已添加则跳过）：

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

# 默认管理员账户
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123456
```

### 1.2 创建上传目录

```bash
mkdir -p uploads/movies
```

---

## 步骤 2：设计数据库模型

### 2.1 编辑 prisma/schema.prisma

更新 schema，添加影片相关模型：

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

  @@map("movies")
}

model Image {
  id        Int      @id @default(autoincrement())
  movieId   Int
  path      String   // 相对路径
  isCover   Boolean  @default(false) // 是否为封面
  createdAt DateTime @default(now())

  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@map("images")
}

model Tag {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())

  movieTags MovieTag[]

  @@map("tags")
}

model MovieTag {
  movieId   Int
  tagId     Int
  createdAt DateTime @default(now())

  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([movieId, tagId])
  @@map("movie_tags")
}
```

### 2.2 创建数据库迁移

```bash
npx prisma migrate dev --name add_movie_models
```

这会在数据库中创建 `movies`、`images`、`tags`、`movie_tags` 四张表。

### 2.3 生成 Prisma Client

```bash
npm run prisma:generate
```

### 🤔 为什么这样做

**1. 为什么 Image 要独立成表？**
- 可以为每张图片添加属性（如 `isCover`、`createdAt`）
- 方便查询和管理（如"查找所有封面图"）
- 支持级联删除，保持数据一致性
- 如果用 JSON 数组，修改单张图片需要更新整个数组

**2. 为什么用中间表 MovieTag？**
- 多对多关系的标准做法
- 支持反向查询（"查找使用了某标签的所有影片"）
- 可以在关系上添加额外信息（如 `createdAt`）
- 符合数据库范式，避免数据冗余

**3. 为什么 type 用字符串而不是 enum？**
- Prisma 的 enum 需要在数据库层面定义
- 字符串更灵活，将来添加新类型无需数据库迁移
- 可以在应用层做验证

**4. 为什么使用 onDelete: Cascade？**
- 删除影片时，自动删除所有关联的图片和标签关系
- 避免孤儿数据
- 简化删除逻辑

---

## 步骤 3：安装文件上传依赖

### 3.1 安装 multer

```bash
npm install multer
npm install -D @types/multer
```

### 3.2 安装 uuid（用于生成唯一文件名）

```bash
npm install uuid
npm install -D @types/uuid
```

---

## 步骤 4：创建文件上传配置

### 4.1 创建 src/config/upload.ts

文件上传配置和工具函数：

```typescript
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from './env';
import { ValidationError } from '../types';

// 允许的图片类型
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// 配置存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 存储到 uploads/movies 目录
    cb(null, path.join(env.UPLOAD_DIR, 'movies'));
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名: uuid-timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// 文件过滤器
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`不支持的文件类型: ${file.mimetype}，仅允许 JPG、PNG、WEBP`));
  }
};

// 创建 multer 实例
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE, // 从环境变量读取
  },
});
```

### 🤔 为什么这样做

**1. 为什么用 uuid + 时间戳命名文件？**
- uuid 保证全局唯一，避免文件名冲突
- 时间戳便于调试和按时间排序
- 不使用原始文件名，防止特殊字符和安全问题

**2. 为什么要限制文件类型？**
- 防止上传恶意文件（如可执行文件）
- 统一图片格式，便于处理
- MIME 类型检查是第一道防线

**3. 为什么配置 fileSize 限制？**
- 防止上传过大文件占用磁盘空间
- 提升上传速度和用户体验
- 从环境变量读取，方便调整

---

## 步骤 5：创建文件工具函数

### 5.1 创建 src/utils/file.util.ts

文件删除和路径处理工具：

```typescript
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * 文件工具类
 */
export class FileUtil {
  /**
   * 删除单个文件
   * @param filePath 文件路径
   */
  static deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`文件已删除: ${filePath}`);
      }
    } catch (error) {
      logger.error(`删除文件失败: ${filePath}`, error);
    }
  }

  /**
   * 删除多个文件
   * @param filePaths 文件路径数组
   */
  static deleteFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => this.deleteFile(filePath));
  }

  /**
   * 将上传的文件转换为相对路径
   * @param file multer 上传的文件对象
   * @returns 相对路径（如 "uploads/movies/xxx.jpg"）
   */
  static getRelativePath(file: Express.Multer.File): string {
    // file.path 是绝对路径，提取 uploads/ 后面的部分
    return file.path.replace(/\\/g, '/').split('uploads/')[1];
  }

  /**
   * 将相对路径转换为绝对路径
   * @param relativePath 相对路径
   * @returns 绝对路径
   */
  static getAbsolutePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }
}
```

### 🤔 为什么这样做

**1. 为什么需要 deleteFile 方法？**
- 删除影片或图片时，需要同时删除物理文件
- 事务失败时，需要清理已上传的文件
- 统一的删除逻辑，避免代码重复

**2. 为什么存储相对路径而不是绝对路径？**
- 相对路径便于迁移（服务器路径可能变化）
- 数据库存储空间更小
- 拼接时更灵活（可以加域名、CDN 前缀等）

**3. 为什么 getRelativePath 要处理反斜杠？**
- Windows 系统使用反斜杠 `\`
- 统一转换为正斜杠 `/`，保持跨平台一致性

---

## 步骤 6：创建数据访问层

### 6.1 创建 src/repositories/movie.repository.ts

影片数据访问层：

```typescript
import prisma from '../config/database';
import { Movie, Image, Prisma } from '@prisma/client';

/**
 * 影片数据访问层
 */
export class MovieRepository {
  /**
   * 创建影片（包含图片和标签）
   * 使用事务确保数据一致性
   */
  static async create(data: {
    title: string;
    type: string;
    rating?: number;
    releaseYear?: number;
    comment?: string;
    images: { path: string; isCover: boolean }[];
    tagIds: number[];
  }): Promise<Movie & { images: Image[] }> {
    return prisma.movie.create({
      data: {
        title: data.title,
        type: data.type,
        rating: data.rating,
        releaseYear: data.releaseYear,
        comment: data.comment,
        images: {
          create: data.images,
        },
        movieTags: {
          create: data.tagIds.map((tagId) => ({ tagId })),
        },
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
  }

  /**
   * 查询影片列表（支持筛选、分页、排序）
   */
  static async findMany(params: {
    where?: Prisma.MovieWhereInput;
    orderBy?: Prisma.MovieOrderByWithRelationInput;
    skip?: number;
    take?: number;
  }) {
    return prisma.movie.findMany({
      where: params.where,
      include: {
        images: {
          where: { isCover: true }, // 列表只返回封面
        },
        movieTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    });
  }

  /**
   * 统计影片数量
   */
  static async count(where?: Prisma.MovieWhereInput): Promise<number> {
    return prisma.movie.count({ where });
  }

  /**
   * 根据 ID 查询影片详情
   */
  static async findById(id: number) {
    return prisma.movie.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { isCover: 'desc' }, // 封面排在前面
        },
        movieTags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * 更新影片信息（不包含图片）
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
    // 如果有 tagIds，先删除旧关联，再创建新关联
    if (data.tagIds !== undefined) {
      await prisma.movieTag.deleteMany({
        where: { movieId: id },
      });
    }

    return prisma.movie.update({
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
  }

  /**
   * 删除影片（级联删除图片和关联）
   */
  static async delete(id: number): Promise<void> {
    await prisma.movie.delete({
      where: { id },
    });
  }

  /**
   * 添加图片到影片
   */
  static async addImages(
    movieId: number,
    images: { path: string; isCover: boolean }[]
  ): Promise<Image[]> {
    // 如果有图片设为封面，先将所有图片的 isCover 设为 false
    const hasCover = images.some((img) => img.isCover);
    if (hasCover) {
      await prisma.image.updateMany({
        where: { movieId },
        data: { isCover: false },
      });
    }

    return prisma.$transaction(
      images.map((img) =>
        prisma.image.create({
          data: {
            movieId,
            path: img.path,
            isCover: img.isCover,
          },
        })
      )
    );
  }

  /**
   * 删除图片
   */
  static async deleteImage(imageId: number): Promise<Image> {
    return prisma.image.delete({
      where: { id: imageId },
    });
  }

  /**
   * 查询图片（验证是否属于指定影片）
   */
  static async findImageById(imageId: number, movieId: number): Promise<Image | null> {
    return prisma.image.findFirst({
      where: {
        id: imageId,
        movieId,
      },
    });
  }

  /**
   * 设置新的封面图片
   */
  static async setCoverImage(movieId: number, imageId: number): Promise<void> {
    await prisma.$transaction([
      // 1. 将该影片的所有图片设为非封面
      prisma.image.updateMany({
        where: { movieId },
        data: { isCover: false },
      }),
      // 2. 将指定图片设为封面
      prisma.image.update({
        where: { id: imageId },
        data: { isCover: true },
      }),
    ]);
  }

  /**
   * 获取影片的第一张图片（用于设置默认封面）
   */
  static async getFirstImage(movieId: number): Promise<Image | null> {
    return prisma.image.findFirst({
      where: { movieId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

### 6.2 创建 src/repositories/tag.repository.ts

标签数据访问层：

```typescript
import prisma from '../config/database';
import { Tag } from '@prisma/client';

/**
 * 标签数据访问层
 */
export class TagRepository {
  /**
   * 创建标签
   */
  static async create(name: string): Promise<Tag> {
    return prisma.tag.create({
      data: { name },
    });
  }

  /**
   * 查询所有标签
   */
  static async findAll(): Promise<Tag[]> {
    return prisma.tag.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 根据名称查询标签
   */
  static async findByName(name: string): Promise<Tag | null> {
    return prisma.tag.findUnique({
      where: { name },
    });
  }

  /**
   * 根据 ID 列表查询标签
   */
  static async findByIds(ids: number[]): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: {
        id: { in: ids },
      },
    });
  }
}
```

### 🤔 为什么这样做

**1. 为什么 create 方法要用 include？**
- 创建后立即返回关联数据（图片和标签）
- 避免再次查询数据库
- 前端可以直接使用完整数据

**2. 为什么列表查询只返回封面图？**
- 列表展示不需要所有图片
- 减少数据传输量，提升性能
- 详情接口才返回完整图片列表

**3. 为什么更新标签要先删除再创建？**
- Prisma 不支持直接更新多对多关系
- 先删除旧关联，再创建新关联，保证数据一致性
- 使用事务确保操作的原子性

**4. 为什么 setCoverImage 使用事务？**
- 两个操作必须同时成功或同时失败
- 先将所有图片设为非封面，再将指定图片设为封面
- 确保一部影片只有一张封面图

---

## 步骤 7：创建业务逻辑层

### 7.1 创建 src/services/movie.service.ts

```typescript
import { MovieRepository } from '../repositories/movie.repository';
import { TagRepository } from '../repositories/tag.repository';
import { FileUtil } from '../utils/file.util';
import { NotFoundError, ValidationError } from '../types';
import { Prisma } from '@prisma/client';

/**
 * 影片业务逻辑层
 */
export class MovieService {
  /**
   * 创建影片
   */
  static async create(data: {
    title: string;
    type: string;
    rating?: number;
    releaseYear?: number;
    comment?: string;
    tagIds?: number[];
    files?: Express.Multer.File[];
    coverIndex?: number;
  }) {
    // 验证类型
    const validTypes = ['movie', 'tv', 'anime', 'anime_movie'];
    if (!validTypes.includes(data.type)) {
      throw new ValidationError(`无效的影片类型: ${data.type}`);
    }

    // 验证评分
    if (data.rating !== undefined && (data.rating < 0 || data.rating > 10)) {
      throw new ValidationError('评分必须在 0-10 之间');
    }

    // 验证标签是否存在
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await TagRepository.findByIds(data.tagIds);
      if (tags.length !== data.tagIds.length) {
        throw new ValidationError('部分标签不存在');
      }
    }

    // 处理图片
    const images: { path: string; isCover: boolean }[] = [];
    if (data.files && data.files.length > 0) {
      const coverIndex = data.coverIndex || 0;
      data.files.forEach((file, index) => {
        images.push({
          path: FileUtil.getRelativePath(file),
          isCover: index === coverIndex,
        });
      });
    }

    try {
      // 创建影片
      const movie = await MovieRepository.create({
        title: data.title,
        type: data.type,
        rating: data.rating,
        releaseYear: data.releaseYear,
        comment: data.comment,
        images,
        tagIds: data.tagIds || [],
      });

      return this.formatMovieResponse(movie);
    } catch (error) {
      // 如果创建失败，删除已上传的文件
      if (data.files && data.files.length > 0) {
        const filePaths = data.files.map((file) => file.path);
        FileUtil.deleteFiles(filePaths);
      }
      throw error;
    }
  }

  /**
   * 查询影片列表
   */
  static async findMany(params: {
    page?: number;
    limit?: number;
    type?: string;
    tagIds?: number[];
    minRating?: number;
    maxRating?: number;
    minYear?: number;
    maxYear?: number;
    keyword?: string;
    sortBy?: 'createdAt' | 'rating' | 'releaseYear';
    order?: 'asc' | 'desc';
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 10, 100); // 最大 100
    const sortBy = params.sortBy || 'createdAt';
    const order = params.order || 'desc';

    // 构建查询条件
    const where: Prisma.MovieWhereInput = {};

    if (params.type) {
      where.type = params.type;
    }

    if (params.minRating !== undefined || params.maxRating !== undefined) {
      where.rating = {};
      if (params.minRating !== undefined) where.rating.gte = params.minRating;
      if (params.maxRating !== undefined) where.rating.lte = params.maxRating;
    }

    if (params.minYear !== undefined || params.maxYear !== undefined) {
      where.releaseYear = {};
      if (params.minYear !== undefined) where.releaseYear.gte = params.minYear;
      if (params.maxYear !== undefined) where.releaseYear.lte = params.maxYear;
    }

    if (params.keyword) {
      where.OR = [
        { title: { contains: params.keyword, mode: 'insensitive' } },
        { comment: { contains: params.keyword, mode: 'insensitive' } },
      ];
    }

    if (params.tagIds && params.tagIds.length > 0) {
      where.movieTags = {
        some: {
          tagId: { in: params.tagIds },
        },
      };
    }

    // 查询
    const [movies, total] = await Promise.all([
      MovieRepository.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      MovieRepository.count(where),
    ]);

    return {
      data: movies.map((movie) => this.formatMovieListItem(movie)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 查询影片详情
   */
  static async findById(id: number) {
    const movie = await MovieRepository.findById(id);
    if (!movie) {
      throw new NotFoundError('影片不存在');
    }
    return this.formatMovieResponse(movie);
  }

  /**
   * 更新影片信息
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
    // 验证影片是否存在
    const existing = await MovieRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('影片不存在');
    }

    // 验证类型
    if (data.type) {
      const validTypes = ['movie', 'tv', 'anime', 'anime_movie'];
      if (!validTypes.includes(data.type)) {
        throw new ValidationError(`无效的影片类型: ${data.type}`);
      }
    }

    // 验证评分
    if (data.rating !== undefined && (data.rating < 0 || data.rating > 10)) {
      throw new ValidationError('评分必须在 0-10 之间');
    }

    // 验证标签
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await TagRepository.findByIds(data.tagIds);
      if (tags.length !== data.tagIds.length) {
        throw new ValidationError('部分标签不存在');
      }
    }

    const movie = await MovieRepository.update(id, data);
    return this.formatMovieResponse(movie);
  }

  /**
   * 删除影片
   */
  static async delete(id: number): Promise<void> {
    // 验证影片是否存在
    const movie = await MovieRepository.findById(id);
    if (!movie) {
      throw new NotFoundError('影片不存在');
    }

    // 删除所有图片文件
    const filePaths = movie.images.map((img) => FileUtil.getAbsolutePath(img.path));
    FileUtil.deleteFiles(filePaths);

    // 删除数据库记录（级联删除图片和关联）
    await MovieRepository.delete(id);
  }

  /**
   * 添加图片到影片
   */
  static async addImages(movieId: number, files: Express.Multer.File[], setCover: boolean) {
    // 验证影片是否存在
    const movie = await MovieRepository.findById(movieId);
    if (!movie) {
      throw new NotFoundError('影片不存在');
    }

    if (!files || files.length === 0) {
      throw new ValidationError('请上传至少一张图片');
    }

    // 构建图片数据
    const images = files.map((file, index) => ({
      path: FileUtil.getRelativePath(file),
      isCover: setCover && index === 0, // 如果 setCover=true，第一张设为封面
    }));

    try {
      await MovieRepository.addImages(movieId, images);
      return { message: '图片添加成功' };
    } catch (error) {
      // 失败时删除已上传的文件
      const filePaths = files.map((file) => file.path);
      FileUtil.deleteFiles(filePaths);
      throw error;
    }
  }

  /**
   * 删除影片的图片
   */
  static async deleteImage(movieId: number, imageId: number): Promise<void> {
    // 验证图片是否属于该影片
    const image = await MovieRepository.findImageById(imageId, movieId);
    if (!image) {
      throw new NotFoundError('图片不存在或不属于该影片');
    }

    // 删除物理文件
    const filePath = FileUtil.getAbsolutePath(image.path);
    FileUtil.deleteFile(filePath);

    // 删除数据库记录
    await MovieRepository.deleteImage(imageId);

    // 如果删除的是封面，将第一张图设为封面
    if (image.isCover) {
      const firstImage = await MovieRepository.getFirstImage(movieId);
      if (firstImage) {
        await MovieRepository.setCoverImage(movieId, firstImage.id);
      }
    }
  }

  /**
   * 格式化影片响应（详情）
   */
  private static formatMovieResponse(movie: any) {
    return {
      id: movie.id,
      title: movie.title,
      type: movie.type,
      rating: movie.rating,
      releaseYear: movie.releaseYear,
      comment: movie.comment,
      images: movie.images.map((img: any) => ({
        id: img.id,
        path: img.path,
        isCover: img.isCover,
      })),
      tags: movie.movieTags.map((mt: any) => ({
        id: mt.tag.id,
        name: mt.tag.name,
      })),
      createdAt: movie.createdAt,
      updatedAt: movie.updatedAt,
    };
  }

  /**
   * 格式化影片列表项（只包含封面）
   */
  private static formatMovieListItem(movie: any) {
    const coverImage = movie.images.find((img: any) => img.isCover);
    return {
      id: movie.id,
      title: movie.title,
      type: movie.type,
      rating: movie.rating,
      releaseYear: movie.releaseYear,
      coverImage: coverImage
        ? {
            id: coverImage.id,
            path: coverImage.path,
          }
        : null,
      tags: movie.movieTags.map((mt: any) => ({
        id: mt.tag.id,
        name: mt.tag.name,
      })),
      createdAt: movie.createdAt,
    };
  }
}
```

### 7.2 创建 src/services/tag.service.ts

```typescript
import { TagRepository } from '../repositories/tag.repository';
import { ConflictError, ValidationError } from '../types';

/**
 * 标签业务逻辑层
 */
export class TagService {
  /**
   * 创建标签
   */
  static async create(name: string) {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('标签名称不能为空');
    }

    // 检查是否已存在
    const existing = await TagRepository.findByName(name);
    if (existing) {
      throw new ConflictError('标签已存在');
    }

    return TagRepository.create(name);
  }

  /**
   * 查询所有标签
   */
  static async findAll() {
    return TagRepository.findAll();
  }
}
```

### 🤔 为什么这样做

**1. 为什么 Service 层要验证数据？**
- Service 是业务逻辑层，负责业务规则校验
- 即使 Controller 验证了，Service 也应该有自己的校验
- 如果将来有其他入口调用 Service，不依赖 Controller 的验证

**2. 为什么创建失败要删除已上传的文件？**
- 避免产生孤儿文件（文件存在但数据库没记录）
- 保持系统清洁，节省磁盘空间
- 体现事务思想：要么全部成功，要么全部失败

**3. 为什么查询列表和详情用不同的格式化方法？**
- 列表只需要基本信息和封面，减少数据量
- 详情需要完整信息，包括所有图片
- 提升性能和用户体验

**4. 为什么删除封面后要自动指定新封面？**
- 保证每部影片至少有一张封面（如果有图片）
- 前端不需要处理"无封面"的异常情况
- 提升用户体验

---

## 步骤 8：创建控制器层

### 8.1 创建 src/controllers/movie.controller.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { MovieService } from '../services/movie.service';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../types';

/**
 * 影片控制器
 */
export class MovieController {
  /**
   * 创建影片
   */
  static create = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { title, type, rating, releaseYear, comment, tagIds, coverIndex } = req.body;

    // 验证必填字段
    if (!title || !type) {
      throw new ValidationError('标题和类型不能为空');
    }

    // 解析 tagIds（前端传来的是 JSON 字符串）
    let parsedTagIds: number[] | undefined;
    if (tagIds) {
      try {
        parsedTagIds = JSON.parse(tagIds);
        if (!Array.isArray(parsedTagIds)) {
          throw new Error();
        }
      } catch {
        throw new ValidationError('tagIds 格式错误，应为数字数组的 JSON 字符串');
      }
    }

    // 解析 coverIndex
    let parsedCoverIndex: number | undefined;
    if (coverIndex !== undefined) {
      parsedCoverIndex = parseInt(coverIndex, 10);
      if (isNaN(parsedCoverIndex)) {
        throw new ValidationError('coverIndex 必须是数字');
      }
    }

    // 调用 Service
    const result = await MovieService.create({
      title,
      type,
      rating: rating ? parseFloat(rating) : undefined,
      releaseYear: releaseYear ? parseInt(releaseYear, 10) : undefined,
      comment,
      tagIds: parsedTagIds,
      files: req.files as Express.Multer.File[],
      coverIndex: parsedCoverIndex,
    });

    return ResponseUtil.success(res, result, '影片创建成功', 201);
  });

  /**
   * 查询影片列表
   */
  static list = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      page,
      limit,
      type,
      tagIds,
      minRating,
      maxRating,
      minYear,
      maxYear,
      keyword,
      sortBy,
      order,
    } = req.query;

    // 解析 tagIds
    let parsedTagIds: number[] | undefined;
    if (tagIds) {
      parsedTagIds = String(tagIds)
        .split(',')
        .map((id) => parseInt(id, 10));
    }

    const result = await MovieService.findMany({
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      type: type ? String(type) : undefined,
      tagIds: parsedTagIds,
      minRating: minRating ? parseFloat(String(minRating)) : undefined,
      maxRating: maxRating ? parseFloat(String(maxRating)) : undefined,
      minYear: minYear ? parseInt(String(minYear), 10) : undefined,
      maxYear: maxYear ? parseInt(String(maxYear), 10) : undefined,
      keyword: keyword ? String(keyword) : undefined,
      sortBy: sortBy as any,
      order: order as any,
    });

    return ResponseUtil.paginated(
      res,
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      '查询成功'
    );
  });

  /**
   * 查询影片详情
   */
  static getById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError('无效的影片 ID');
    }

    const result = await MovieService.findById(id);
    return ResponseUtil.success(res, result, '查询成功');
  });

  /**
   * 更新影片信息
   */
  static update = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError('无效的影片 ID');
    }

    const { title, type, rating, releaseYear, comment, tagIds } = req.body;

    const result = await MovieService.update(id, {
      title,
      type,
      rating,
      releaseYear,
      comment,
      tagIds,
    });

    return ResponseUtil.success(res, result, '影片更新成功');
  });

  /**
   * 删除影片
   */
  static delete = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError('无效的影片 ID');
    }

    await MovieService.delete(id);
    return ResponseUtil.success(res, null, '影片删除成功');
  });

  /**
   * 添加图片到影片
   */
  static addImages = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      throw new ValidationError('无效的影片 ID');
    }

    const setCover = req.body.setCover === 'true' || req.body.setCover === true;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('请上传至少一张图片');
    }

    const result = await MovieService.addImages(movieId, files, setCover);
    return ResponseUtil.success(res, result, '图片添加成功');
  });

  /**
   * 删除影片的图片
   */
  static deleteImage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const movieId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);

    if (isNaN(movieId) || isNaN(imageId)) {
      throw new ValidationError('无效的 ID');
    }

    await MovieService.deleteImage(movieId, imageId);
    return ResponseUtil.success(res, null, '图片删除成功');
  });
}
```

### 8.2 创建 src/controllers/tag.controller.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { TagService } from '../services/tag.service';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, ForbiddenError } from '../types';

/**
 * 标签控制器
 */
export class TagController {
  /**
   * 创建标签（仅管理员）
   */
  static create = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // 验证用户角色
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('仅管理员可以创建标签');
    }

    const { name } = req.body;

    if (!name) {
      throw new ValidationError('标签名称不能为空');
    }

    const result = await TagService.create(name);
    return ResponseUtil.success(res, result, '标签创建成功', 201);
  });

  /**
   * 查询所有标签
   */
  static list = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await TagService.findAll();
    return ResponseUtil.success(res, result, '查询成功');
  });
}
```

### 🤔 为什么这样做

**1. 为什么要解析 JSON 字符串（tagIds）？**
- `multipart/form-data` 不支持直接传递数组
- 前端需要将数组序列化为 JSON 字符串
- 后端解析后转换为数组

**2. 为什么标签创建要验证角色？**
- 防止普通用户随意创建标签
- 保持标签库的规范和质量
- 预留权限扩展能力

**3. 为什么 Controller 要验证 ID 格式？**
- 尽早发现错误，避免传递到 Service 层
- 提供友好的错误信息
- parseInt 可能返回 NaN，需要检查

---

## 步骤 9：创建路由

### 9.1 创建 src/routes/movie.routes.ts

```typescript
import { Router } from 'express';
import { MovieController } from '../controllers/movie.controller';
import { authMiddleware } from '../middlewares';
import { upload } from '../config/upload';

const router = Router();

// 应用 JWT 鉴权中间件到所有路由
router.use(authMiddleware);

/**
 * POST /api/v1/movies
 * 创建影片（支持上传多张图片）
 */
router.post('/', upload.array('images'), MovieController.create);

/**
 * GET /api/v1/movies
 * 查询影片列表（支持筛选、分页、排序）
 */
router.get('/', MovieController.list);

/**
 * GET /api/v1/movies/:id
 * 查询影片详情
 */
router.get('/:id', MovieController.getById);

/**
 * PUT /api/v1/movies/:id
 * 更新影片信息
 */
router.put('/:id', MovieController.update);

/**
 * DELETE /api/v1/movies/:id
 * 删除影片
 */
router.delete('/:id', MovieController.delete);

/**
 * POST /api/v1/movies/:id/images
 * 添加图片到影片
 */
router.post('/:id/images', upload.array('images'), MovieController.addImages);

/**
 * DELETE /api/v1/movies/:id/images/:imageId
 * 删除影片的图片
 */
router.delete('/:id/images/:imageId', MovieController.deleteImage);

export default router;
```

### 9.2 创建 src/routes/tag.routes.ts

```typescript
import { Router } from 'express';
import { TagController } from '../controllers/tag.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

// 应用 JWT 鉴权中间件
router.use(authMiddleware);

/**
 * POST /api/v1/tags
 * 创建标签（仅管理员）
 */
router.post('/', TagController.create);

/**
 * GET /api/v1/tags
 * 查询所有标签
 */
router.get('/', TagController.list);

export default router;
```

### 9.3 更新 src/routes/index.ts

集成影片和标签路由：

```typescript
import { Router } from 'express';
import { ResponseUtil } from '../utils/response';
import authRoutes from './auth.routes';
import movieRoutes from './movie.routes';
import tagRoutes from './tag.routes';

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

// 影片路由
router.use('/api/v1/movies', movieRoutes);

// 标签路由
router.use('/api/v1/tags', tagRoutes);

export default router;
```

### 🤔 为什么这样做

**1. 为什么使用 router.use(authMiddleware)？**
- 应用到该路由下的所有子路由
- 避免在每个路由上重复添加中间件
- 代码更简洁、易维护

**2. 为什么 upload.array('images')？**
- `array` 支持上传多个文件
- `'images'` 是前端表单字段名
- 上传的文件会存储在 `req.files` 数组中

**3. 为什么影片和标签用独立的路由文件？**
- 职责清晰，便于管理
- 符合 RESTful 规范：不同资源用不同路由
- 将来扩展更容易

---

## 步骤 10：创建种子数据

### 10.1 更新 prisma/seed.ts

添加预设标签的创建：

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始数据库种子...');

  // 1. 创建管理员账户
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    console.log('⚠️  管理员账户已存在，跳过创建');
  } else {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

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

  // 2. 创建预设标签
  const predefinedTags = [
    '科幻',
    '悬疑',
    '动作',
    '爱情',
    '喜剧',
    '恐怖',
    '剧情',
    '动画',
    '冒险',
    '犯罪',
    '历史',
    '战争',
    '纪录片',
    '音乐',
    '家庭',
    '高分',
    '经典',
    '治愈',
    '烧脑',
    '催泪',
  ];

  console.log('\n🏷️  开始创建预设标签...');

  for (const tagName of predefinedTags) {
    const existingTag = await prisma.tag.findUnique({
      where: { name: tagName },
    });

    if (!existingTag) {
      await prisma.tag.create({
        data: { name: tagName },
      });
      console.log(`   ✅ 标签创建: ${tagName}`);
    } else {
      console.log(`   ⏭️  标签已存在: ${tagName}`);
    }
  }

  console.log('\n✨ 种子数据创建完成!');
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

### 10.2 运行种子脚本

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

🏷️  开始创建预设标签...
   ✅ 标签创建: 科幻
   ✅ 标签创建: 悬疑
   ✅ 标签创建: 动作
   ...

✨ 种子数据创建完成!
```

### 🤔 为什么这样做

**1. 为什么要预设标签？**
- 保持标签一致性，避免用户创建重复或无意义的标签
- 提供常用标签，提升用户体验
- 符合需求：标签库由管理员管理

**2. 为什么检查标签是否已存在？**
- seed 脚本可能被多次运行
- 避免重复创建导致 unique 约束错误
- 幂等性：多次运行结果相同

**3. 为什么标签这么多？**
- 覆盖主流影片类型和特点
- 用户可以灵活组合（如"科幻 + 悬疑 + 高分"）
- 管理员后续可以继续添加

---

## 步骤 11：测试验证

### 11.1 启动开发服务器

```bash
npm run dev
```

### 11.2 登录获取 Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'
```

复制返回的 token，后续请求都需要带上。

### 11.3 查询所有标签

```bash
curl -X GET http://localhost:3000/api/v1/tags \
  -H "Authorization: Bearer <your-token>"
```

应该返回 20 个预设标签。

### 11.4 创建影片（带图片）

准备两张测试图片（如 `cover.jpg` 和 `poster.jpg`），然后执行：

```bash
curl -X POST http://localhost:3000/api/v1/movies \
  -H "Authorization: Bearer <your-token>" \
  -F "title=盗梦空间" \
  -F "type=movie" \
  -F "rating=9.5" \
  -F "releaseYear=2010" \
  -F "comment=非常精彩的科幻片，诺兰的巅峰之作" \
  -F "tagIds=[1,2,16]" \
  -F "coverIndex=0" \
  -F "images=@/path/to/cover.jpg" \
  -F "images=@/path/to/poster.jpg"
```

注意：
- `tagIds` 是 JSON 字符串
- `coverIndex=0` 表示第一张图片是封面
- `images=@...` 指定文件路径

应该返回：

```json
{
  "success": true,
  "message": "影片创建成功",
  "data": {
    "id": 1,
    "title": "盗梦空间",
    "type": "movie",
    "rating": 9.5,
    "releaseYear": 2010,
    "comment": "非常精彩的科幻片，诺兰的巅峰之作",
    "images": [
      { "id": 1, "path": "movies/xxx.jpg", "isCover": true },
      { "id": 2, "path": "movies/yyy.jpg", "isCover": false }
    ],
    "tags": [
      { "id": 1, "name": "科幻" },
      { "id": 2, "name": "悬疑" },
      { "id": 16, "name": "高分" }
    ],
    "createdAt": "2026-02-13T...",
    "updatedAt": "2026-02-13T..."
  }
}
```

### 11.5 访问上传的图片

在浏览器中访问：

```
http://localhost:3000/uploads/movies/xxx.jpg
```

应该能看到上传的图片。

### 11.6 查询影片列表（不带筛选）

```bash
curl -X GET "http://localhost:3000/api/v1/movies?page=1&limit=10" \
  -H "Authorization: Bearer <your-token>"
```

### 11.7 查询影片列表（带筛选）

```bash
curl -X GET "http://localhost:3000/api/v1/movies?type=movie&minRating=9&tagIds=1,2&sortBy=rating&order=desc" \
  -H "Authorization: Bearer <your-token>"
```

### 11.8 查询影片详情

```bash
curl -X GET http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>"
```

应该返回完整的影片信息，包括所有图片。

### 11.9 更新影片信息

```bash
curl -X PUT http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 9.8,
    "comment": "更新后的评语：越看越好看",
    "tagIds": [1, 2, 16, 19]
  }'
```

### 11.10 添加图片到影片

```bash
curl -X POST http://localhost:3000/api/v1/movies/1/images \
  -H "Authorization: Bearer <your-token>" \
  -F "setCover=true" \
  -F "images=@/path/to/new-image.jpg"
```

### 11.11 删除图片

```bash
curl -X DELETE http://localhost:3000/api/v1/movies/1/images/2 \
  -H "Authorization: Bearer <your-token>"
```

### 11.12 删除影片

```bash
curl -X DELETE http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>"
```

应该返回成功，并且 `uploads/movies/` 目录下的图片文件也会被删除。

### 11.13 测试未登录访问

```bash
curl -X GET http://localhost:3000/api/v1/movies
```

应该返回 401 错误：

```json
{
  "success": false,
  "message": "缺少认证令牌",
  "timestamp": "2026-02-13T..."
}
```

### 11.14 测试普通用户创建标签

如果有其他用户（role 不是 admin），尝试创建标签：

```bash
curl -X POST http://localhost:3000/api/v1/tags \
  -H "Authorization: Bearer <non-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"新标签"}'
```

应该返回 403 错误：

```json
{
  "success": false,
  "message": "仅管理员可以创建标签",
  "timestamp": "2026-02-13T..."
}
```

---

## 步骤 12：代码优化和提交

### 12.1 格式化代码

```bash
npm run format
```

### 12.2 检查代码

```bash
npm run lint
```

如果有错误，运行：

```bash
npm run lint:fix
```

### 12.3 查看变更

```bash
git status
```

### 12.4 提交代码

```bash
git add .
git commit -m "feat: 实现影片收藏子系统

- 添加 Movie、Image、Tag、MovieTag 数据模型
- 实现文件上传功能（multer）
- 实现影片 CRUD 接口（创建、查询、编辑、删除）
- 实现图片管理接口（添加、删除）
- 实现标签管理接口（创建、查询）
- 应用 JWT 鉴权到所有影片和标签接口
- 支持多条件筛选、分页、排序
- 支持关键词搜索（标题、评语）
- 添加预设标签种子数据
- 实现文件自动清理机制"
```

---

## 阶段四完成检查清单

- [ ] Movie、Image、Tag、MovieTag 模型已添加到 schema.prisma
- [ ] 数据库迁移已完成，四张表已创建
- [ ] Prisma Client 已生成
- [ ] multer 文件上传配置完成
- [ ] 文件工具（删除、路径处理）已实现
- [ ] MovieRepository 已实现（支持复杂查询）
- [ ] TagRepository 已实现
- [ ] MovieService 已实现（包含事务和文件清理）
- [ ] TagService 已实现
- [ ] MovieController 已实现（处理 multipart/form-data）
- [ ] TagController 已实现（角色验证）
- [ ] 影片路由已创建并应用 JWT 鉴权
- [ ] 标签路由已创建并应用 JWT 鉴权
- [ ] 种子脚本已更新（预设标签）
- [ ] 预设标签已创建（20 个）
- [ ] 创建影片接口测试通过（带图片上传）
- [ ] 查询影片列表接口测试通过（带筛选）
- [ ] 查询影片详情接口测试通过
- [ ] 更新影片接口测试通过
- [ ] 删除影片接口测试通过（级联删除）
- [ ] 添加图片接口测试通过
- [ ] 删除图片接口测试通过（自动设置新封面）
- [ ] 标签查询接口测试通过
- [ ] 标签创建接口测试通过（仅管理员）
- [ ] JWT 鉴权正常工作（所有接口）
- [ ] 未登录访问返回 401
- [ ] 普通用户创建标签返回 403
- [ ] 上传的图片可以正常访问
- [ ] 代码格式化和检查通过
- [ ] 代码已提交到 Git

---

## 项目结构总览

完成阶段四后，新增的文件结构：

```
practical-project/
├── src/
│   ├── config/
│   │   └── upload.ts               # multer 文件上传配置
│   ├── controllers/
│   │   ├── movie.controller.ts     # 影片控制器
│   │   └── tag.controller.ts       # 标签控制器
│   ├── services/
│   │   ├── movie.service.ts        # 影片业务逻辑
│   │   └── tag.service.ts          # 标签业务逻辑
│   ├── repositories/
│   │   ├── movie.repository.ts     # 影片数据访问
│   │   └── tag.repository.ts       # 标签数据访问
│   ├── routes/
│   │   ├── movie.routes.ts         # 影片路由
│   │   ├── tag.routes.ts           # 标签路由
│   │   └── index.ts                # 更新：集成新路由
│   └── utils/
│       └── file.util.ts            # 文件工具
├── prisma/
│   ├── schema.prisma               # 更新：添加 Movie/Image/Tag/MovieTag 模型
│   └── seed.ts                     # 更新：添加预设标签
├── uploads/
│   └── movies/                     # 影片图片存储目录
└── .env                            # 已包含文件上传配置
```

---

## 数据流程图

### 创建影片流程

```
┌─────────┐
│  前端    │
└────┬────┘
     │ POST /api/v1/movies (multipart/form-data)
     │ { title, type, rating, images[], tagIds, coverIndex }
     ▼
┌─────────────────────┐
│  authMiddleware     │ ◄─── 验证 JWT token
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  multer middleware  │ ◄─── 保存文件到 uploads/movies/
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieController    │ ◄─── 解析 JSON 字符串、验证参数
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieService       │ ◄─── 验证业务逻辑、处理文件路径
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieRepository    │ ◄─── 事务：创建 Movie + Image + MovieTag
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  返回完整数据        │
└─────────────────────┘
```

### 查询影片列表流程

```
┌─────────┐
│  前端    │
└────┬────┘
     │ GET /api/v1/movies?page=1&type=movie&tagIds=1,2
     ▼
┌─────────────────────┐
│  authMiddleware     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieController    │ ◄─── 解析查询参数
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieService       │ ◄─── 构建 where 条件
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  MovieRepository    │ ◄─── Prisma 查询（include 关联）
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  返回分页数据        │ ◄─── 只包含封面图
└─────────────────────┘
```

---

## 常见问题

### Q1: 文件上传失败

**可能原因**：
1. `uploads/movies` 目录不存在
2. 文件类型不允许
3. 文件大小超过限制

**解决方案**：

```bash
# 创建目录
mkdir -p uploads/movies

# 检查环境变量
cat .env | grep UPLOAD_DIR
cat .env | grep MAX_FILE_SIZE

# 查看错误日志
npm run dev
```

### Q2: 创建影片时 tagIds 解析失败

**可能原因**：
前端传递的 tagIds 格式不正确

**正确格式**：

```bash
# tagIds 必须是 JSON 字符串
-F "tagIds=[1,2,3]"

# 不是：
-F "tagIds=1,2,3"  # 错误
```

### Q3: 图片无法访问

**可能原因**：
静态文件服务没有配置

**解决方案**：

检查 `src/app.ts` 中是否有：

```typescript
app.use('/uploads', express.static(env.UPLOAD_DIR));
```

### Q4: 删除影片后图片文件未删除

**可能原因**：
文件删除逻辑有问题

**检查**：

```bash
# 查看日志
npm run dev

# 应该看到类似输出：
# [DEBUG] 文件已删除: /path/to/uploads/movies/xxx.jpg
```

### Q5: 查询列表时标签筛选不生效

**可能原因**：
tagIds 解析错误或 where 条件构建有误

**调试**：

在 `MovieService.findMany` 中添加日志：

```typescript
console.log('where:', JSON.stringify(where, null, 2));
```

### Q6: multer 报错 "Unexpected field"

**可能原因**：
前端表单字段名不匹配

**解决方案**：

确保前端使用的字段名是 `images`：

```javascript
formData.append('images', file);
```

后端配置是：

```typescript
upload.array('images')
```

### Q7: Prisma 事务失败

**可能原因**：
外键约束、唯一约束冲突

**解决方案**：

```bash
# 查看数据库日志
docker-compose logs postgres

# 重新运行迁移
npx prisma migrate reset
npm run prisma:seed
```

---

## 安全最佳实践

### 1. 文件上传安全

- ✅ 限制文件类型（只允许图片）
- ✅ 限制文件大小（5MB）
- ✅ 使用 uuid 命名，避免路径遍历攻击
- ✅ 不使用原始文件名
- ⚠️ 生产环境建议：添加病毒扫描、图片内容检测

### 2. 鉴权授权

- ✅ 所有接口都需要 JWT 认证
- ✅ 创建标签接口验证管理员角色
- ✅ 删除影片前验证影片存在
- ✅ 删除图片前验证图片属于该影片

### 3. 数据验证

- ✅ Controller 层验证必填字段和格式
- ✅ Service 层验证业务规则（评分范围、类型枚举）
- ✅ 防止 SQL 注入（Prisma 自带参数化查询）
- ✅ 防止 XSS（前端需要转义用户输入）

### 4. 错误处理

- ✅ 文件上传失败时自动清理
- ✅ 事务失败时回滚
- ✅ 统一错误响应格式
- ✅ 生产环境不暴露详细错误堆栈

### 5. 性能优化

- ✅ 列表查询限制最大条数（100）
- ✅ 列表只返回封面图，减少数据量
- ✅ 使用 Prisma include 避免 N+1 查询
- ✅ 可选：添加数据库索引（type、rating、releaseYear）

---

## 进阶知识

### Prisma 关系查询原理

**一对多关系（Movie - Image）**：

```prisma
model Movie {
  id     Int     @id
  images Image[]  // ← 关系字段
}

model Image {
  id      Int   @id
  movieId Int   // ← 外键
  movie   Movie @relation(fields: [movieId], references: [id])
}
```

查询时：

```typescript
prisma.movie.findMany({
  include: { images: true }, // 自动 JOIN 查询
});
```

生成的 SQL 类似：

```sql
SELECT * FROM movies;
SELECT * FROM images WHERE movieId IN (1, 2, 3);
```

**多对多关系（Movie - Tag）**：

```prisma
model Movie {
  movieTags MovieTag[]
}

model Tag {
  movieTags MovieTag[]
}

model MovieTag {
  movieId Int
  tagId   Int
  movie   Movie @relation(...)
  tag     Tag   @relation(...)
  @@id([movieId, tagId])
}
```

查询时：

```typescript
prisma.movie.findMany({
  include: {
    movieTags: {
      include: { tag: true },
    },
  },
});
```

生成的 SQL 类似：

```sql
SELECT * FROM movies;
SELECT * FROM movie_tags WHERE movieId IN (1, 2, 3);
SELECT * FROM tags WHERE id IN (1, 2, 3);
```

### multer 工作原理

1. **解析 multipart/form-data**：
   - 浏览器发送的表单数据分为多个部分（part）
   - 每个文件是一个独立的 part
   - 文本字段也是独立的 part

2. **存储策略**：
   - `diskStorage`：直接写入磁盘
   - `memoryStorage`：先加载到内存（适合小文件）

3. **中间件工作流程**：
   ```
   客户端上传
       ↓
   multer 解析 multipart
       ↓
   fileFilter 验证文件类型
       ↓
   storage 保存文件
       ↓
   req.files 可用
       ↓
   Controller 处理
   ```

### Prisma 事务

**隐式事务**（嵌套写入）：

```typescript
prisma.movie.create({
  data: {
    title: '...',
    images: {
      create: [...], // 自动在事务中
    },
  },
});
```

**显式事务**（$transaction）：

```typescript
await prisma.$transaction([
  prisma.image.updateMany(...),
  prisma.image.update(...),
]);
```

原理：
- 开始事务：BEGIN
- 执行所有操作
- 提交：COMMIT（成功）或回滚：ROLLBACK（失败）

### 级联删除原理

```prisma
model Image {
  movie Movie @relation(..., onDelete: Cascade)
}
```

删除影片时：

```sql
-- Prisma 执行：
DELETE FROM movies WHERE id = 1;

-- 数据库自动执行：
DELETE FROM images WHERE movieId = 1;
DELETE FROM movie_tags WHERE movieId = 1;
```

这是数据库的外键约束功能。

---

## 下一步

完成阶段四后，进入 **阶段五：测试与优化**（待规划）。

在阶段五中，您将学习：
1. 使用 Postman 或 Thunder Client 测试所有接口
2. 编写接口文档
3. 数据库查询优化（添加索引）
4. 输入验证增强（使用 joi 或 zod）
5. 安全加固（XSS 防护、请求频率限制）
6. 错误处理完善

---

**恭喜完成阶段四！您已经掌握了文件上传、关系模型和复杂查询的核心技能。** 🎉
