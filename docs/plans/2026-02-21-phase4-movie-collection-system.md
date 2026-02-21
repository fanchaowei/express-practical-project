# 阶段四:影片收藏子系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现影片收藏管理子系统,包括文件上传、关系数据模型、CRUD 接口和高级查询功能

**Architecture:** 在现有三层架构基础上,添加 Movie、Image、Tag 相关的 Repository、Service、Controller,实现完整的影片收藏功能,应用 JWT 鉴权,支持多条件筛选和分页

**Tech Stack:** Express.js, TypeScript, Prisma, multer, uuid

**参考文档:** [docs/plan/phase-4.md](../plan/phase-4.md)

---

## Task 1: 更新环境变量和创建上传目录

**Files:**
- Modify: `.env`
- Modify: `.env.example`

**Step 1: 编辑 .env 文件**

添加文件上传配置:

```env
# 文件上传配置
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

**Step 2: 同步更新 .env.example**

将相同的配置项添加到 `.env.example` 文件。

**Step 3: 创建上传目录**

```bash
mkdir -p uploads/movies
```

**Verification:**

```bash
# 检查环境变量
cat .env | grep -E "(UPLOAD_DIR|MAX_FILE_SIZE)"
# 检查目录是否创建
ls -la uploads/movies
```

---

## Task 2: 安装依赖包

**Files:**
- Modify: `package.json`

**Step 1: 安装 multer**

```bash
npm install multer
npm install -D @types/multer
```

**Step 2: 安装 uuid**

```bash
npm install uuid
npm install -D @types/uuid
```

**Verification:**

```bash
# 检查依赖是否安装
npm list multer uuid
# 检查类型定义
npm list @types/multer @types/uuid
```

---

## Task 3: 设计数据库模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加影片相关模型**

在 `prisma/schema.prisma` 中添加以下模型:

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

**Step 2: 创建数据库迁移**

```bash
npx prisma migrate dev --name add_movie_models
```

**Step 3: 生成 Prisma Client**

```bash
npm run prisma:generate
```

**Verification:**

```bash
# 检查迁移文件
ls -la prisma/migrations/ | grep add_movie_models
# 验证 Prisma Client
node -e "const { PrismaClient } = require('@prisma/client'); console.log('Prisma Client OK')"
```

---

## Task 4: 创建文件上传配置

**Files:**
- Create: `src/config/upload.ts`

**Step 1: 创建上传配置文件**

在 `src/config/upload.ts` 中创建:

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
    cb(null, path.join(env.UPLOAD_DIR, 'movies'));
  },
  filename: (req, file, cb) => {
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
    cb(new ValidationError(`不支持的文件类型: ${file.mimetype},仅允许 JPG、PNG、WEBP`));
  }
};

// 创建 multer 实例
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/config/upload.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 5: 创建文件工具函数

**Files:**
- Create: `src/utils/file.util.ts`

**Step 1: 创建文件工具类**

在 `src/utils/file.util.ts` 中创建:

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
   */
  static deleteFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => this.deleteFile(filePath));
  }

  /**
   * 将上传的文件转换为相对路径
   */
  static getRelativePath(file: Express.Multer.File): string {
    return file.path.replace(/\\/g, '/').split('uploads/')[1];
  }

  /**
   * 将相对路径转换为绝对路径
   */
  static getAbsolutePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/utils/file.util.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 6: 创建标签数据访问层

**Files:**
- Create: `src/repositories/tag.repository.ts`

**Step 1: 创建 TagRepository**

在 `src/repositories/tag.repository.ts` 中创建:

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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/repositories/tag.repository.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 7: 创建影片数据访问层

**Files:**
- Create: `src/repositories/movie.repository.ts`

**Step 1: 创建 MovieRepository**

在 `src/repositories/movie.repository.ts` 中创建:

```typescript
import prisma from '../config/database';
import { Movie, Image, Prisma } from '@prisma/client';

/**
 * 影片数据访问层
 */
export class MovieRepository {
  /**
   * 创建影片(包含图片和标签)
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
   * 查询影片列表(支持筛选、分页、排序)
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
          where: { isCover: true },
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
          orderBy: { isCover: 'desc' },
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
   * 更新影片信息(不包含图片)
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
   * 删除影片(级联删除图片和关联)
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
   * 查询图片(验证是否属于指定影片)
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
      prisma.image.updateMany({
        where: { movieId },
        data: { isCover: false },
      }),
      prisma.image.update({
        where: { id: imageId },
        data: { isCover: true },
      }),
    ]);
  }

  /**
   * 获取影片的第一张图片(用于设置默认封面)
   */
  static async getFirstImage(movieId: number): Promise<Image | null> {
    return prisma.image.findFirst({
      where: { movieId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

**Verification:**

```bash
# 检查文件是否创建
ls -la src/repositories/movie.repository.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 8: 创建标签业务逻辑层

**Files:**
- Create: `src/services/tag.service.ts`

**Step 1: 创建 TagService**

在 `src/services/tag.service.ts` 中创建:

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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/services/tag.service.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 9: 创建影片业务逻辑层

**Files:**
- Create: `src/services/movie.service.ts`

**Step 1: 创建 MovieService**

在 `src/services/movie.service.ts` 中创建:

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
    const validTypes = ['movie', 'tv', 'anime', 'anime_movie'];
    if (!validTypes.includes(data.type)) {
      throw new ValidationError(`无效的影片类型: ${data.type}`);
    }

    if (data.rating !== undefined && (data.rating < 0 || data.rating > 10)) {
      throw new ValidationError('评分必须在 0-10 之间');
    }

    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await TagRepository.findByIds(data.tagIds);
      if (tags.length !== data.tagIds.length) {
        throw new ValidationError('部分标签不存在');
      }
    }

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
    const limit = Math.min(params.limit || 10, 100);
    const sortBy = params.sortBy || 'createdAt';
    const order = params.order || 'desc';

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
    const existing = await MovieRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('影片不存在');
    }

    if (data.type) {
      const validTypes = ['movie', 'tv', 'anime', 'anime_movie'];
      if (!validTypes.includes(data.type)) {
        throw new ValidationError(`无效的影片类型: ${data.type}`);
      }
    }

    if (data.rating !== undefined && (data.rating < 0 || data.rating > 10)) {
      throw new ValidationError('评分必须在 0-10 之间');
    }

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
    const movie = await MovieRepository.findById(id);
    if (!movie) {
      throw new NotFoundError('影片不存在');
    }

    const filePaths = movie.images.map((img) => FileUtil.getAbsolutePath(img.path));
    FileUtil.deleteFiles(filePaths);

    await MovieRepository.delete(id);
  }

  /**
   * 添加图片到影片
   */
  static async addImages(movieId: number, files: Express.Multer.File[], setCover: boolean) {
    const movie = await MovieRepository.findById(movieId);
    if (!movie) {
      throw new NotFoundError('影片不存在');
    }

    if (!files || files.length === 0) {
      throw new ValidationError('请上传至少一张图片');
    }

    const images = files.map((file, index) => ({
      path: FileUtil.getRelativePath(file),
      isCover: setCover && index === 0,
    }));

    try {
      await MovieRepository.addImages(movieId, images);
      return { message: '图片添加成功' };
    } catch (error) {
      const filePaths = files.map((file) => file.path);
      FileUtil.deleteFiles(filePaths);
      throw error;
    }
  }

  /**
   * 删除影片的图片
   */
  static async deleteImage(movieId: number, imageId: number): Promise<void> {
    const image = await MovieRepository.findImageById(imageId, movieId);
    if (!image) {
      throw new NotFoundError('图片不存在或不属于该影片');
    }

    const filePath = FileUtil.getAbsolutePath(image.path);
    FileUtil.deleteFile(filePath);

    await MovieRepository.deleteImage(imageId);

    if (image.isCover) {
      const firstImage = await MovieRepository.getFirstImage(movieId);
      if (firstImage) {
        await MovieRepository.setCoverImage(movieId, firstImage.id);
      }
    }
  }

  /**
   * 格式化影片响应(详情)
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
   * 格式化影片列表项(只包含封面)
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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/services/movie.service.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 10: 创建标签控制器

**Files:**
- Create: `src/controllers/tag.controller.ts`

**Step 1: 创建 TagController**

在 `src/controllers/tag.controller.ts` 中创建:

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
   * 创建标签(仅管理员)
   */
  static create = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/controllers/tag.controller.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 11: 创建影片控制器

**Files:**
- Create: `src/controllers/movie.controller.ts`

**Step 1: 创建 MovieController**

在 `src/controllers/movie.controller.ts` 中创建:

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

    if (!title || !type) {
      throw new ValidationError('标题和类型不能为空');
    }

    let parsedTagIds: number[] | undefined;
    if (tagIds) {
      try {
        parsedTagIds = JSON.parse(tagIds);
        if (!Array.isArray(parsedTagIds)) {
          throw new Error();
        }
      } catch {
        throw new ValidationError('tagIds 格式错误,应为数字数组的 JSON 字符串');
      }
    }

    let parsedCoverIndex: number | undefined;
    if (coverIndex !== undefined) {
      parsedCoverIndex = parseInt(coverIndex, 10);
      if (isNaN(parsedCoverIndex)) {
        throw new ValidationError('coverIndex 必须是数字');
      }
    }

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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/controllers/movie.controller.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 12: 创建路由配置

**Files:**
- Create: `src/routes/tag.routes.ts`
- Create: `src/routes/movie.routes.ts`
- Modify: `src/routes/index.ts`

**Step 1: 创建标签路由**

在 `src/routes/tag.routes.ts` 中创建:

```typescript
import { Router } from 'express';
import { TagController } from '../controllers/tag.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

// 应用 JWT 鉴权中间件
router.use(authMiddleware);

/**
 * POST /api/v1/tags
 * 创建标签(仅管理员)
 */
router.post('/', TagController.create);

/**
 * GET /api/v1/tags
 * 查询所有标签
 */
router.get('/', TagController.list);

export default router;
```

**Step 2: 创建影片路由**

在 `src/routes/movie.routes.ts` 中创建:

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
 * 创建影片(支持上传多张图片)
 */
router.post('/', upload.array('images'), MovieController.create);

/**
 * GET /api/v1/movies
 * 查询影片列表(支持筛选、分页、排序)
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

**Step 3: 更新主路由**

修改 `src/routes/index.ts`,集成影片和标签路由:

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

**Verification:**

```bash
# 检查文件是否创建
ls -la src/routes/tag.routes.ts src/routes/movie.routes.ts
# TypeScript 编译检查
npx tsc --noEmit
```

---

## Task 13: 更新种子数据脚本

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 添加预设标签创建**

修改 `prisma/seed.ts`,添加标签创建逻辑:

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
    console.log('⚠️  管理员账户已存在,跳过创建');
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

**Step 2: 运行种子脚本**

```bash
npm run prisma:seed
```

**Verification:**

```bash
# 查看种子脚本输出
npm run prisma:seed
# 检查标签是否创建成功
npm run prisma:studio
```

---

## Task 14: 测试验证

**Files:** N/A (测试阶段)

**Step 1: 启动开发服务器**

```bash
npm run dev
```

应该看到服务器成功启动。

**Step 2: 登录获取 Token**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'
```

保存返回的 token,后续测试需要使用。

**Step 3: 查询所有标签**

```bash
curl -X GET http://localhost:3000/api/v1/tags \
  -H "Authorization: Bearer <your-token>"
```

应该返回 20 个预设标签。

**Step 4: 创建影片(带图片)**

准备两张测试图片,然后执行:

```bash
curl -X POST http://localhost:3000/api/v1/movies \
  -H "Authorization: Bearer <your-token>" \
  -F "title=盗梦空间" \
  -F "type=movie" \
  -F "rating=9.5" \
  -F "releaseYear=2010" \
  -F "comment=非常精彩的科幻片" \
  -F "tagIds=[1,2,16]" \
  -F "coverIndex=0" \
  -F "images=@/path/to/cover.jpg" \
  -F "images=@/path/to/poster.jpg"
```

应该返回创建成功的响应。

**Step 5: 查询影片列表**

```bash
curl -X GET "http://localhost:3000/api/v1/movies?page=1&limit=10" \
  -H "Authorization: Bearer <your-token>"
```

**Step 6: 查询影片详情**

```bash
curl -X GET http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>"
```

**Step 7: 更新影片信息**

```bash
curl -X PUT http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"rating":9.8,"comment":"更新后的评语"}'
```

**Step 8: 删除影片**

```bash
curl -X DELETE http://localhost:3000/api/v1/movies/1 \
  -H "Authorization: Bearer <your-token>"
```

**Step 9: 测试未登录访问**

```bash
curl -X GET http://localhost:3000/api/v1/movies
```

应该返回 401 错误。

**Verification:**

所有测试都应返回正确的响应格式和状态码。

---

## Task 15: 代码优化和提交

**Files:** N/A (代码整理阶段)

**Step 1: 格式化代码**

```bash
npm run format
```

**Step 2: 检查代码**

```bash
npm run lint
```

如果有错误,运行:

```bash
npm run lint:fix
```

**Step 3: 提交代码**

```bash
git add .
git commit -m "feat: 实现影片收藏子系统

- 添加 Movie、Image、Tag、MovieTag 数据模型
- 实现文件上传功能(multer)
- 实现影片 CRUD 接口(创建、查询、编辑、删除)
- 实现图片管理接口(添加、删除)
- 实现标签管理接口(创建、查询)
- 应用 JWT 鉴权到所有影片和标签接口
- 支持多条件筛选、分页、排序
- 支持关键词搜索(标题、评语)
- 添加预设标签种子数据
- 实现文件自动清理机制"
```

**Verification:**

```bash
# 检查提交状态
git log -1 --oneline
git status
```

---

## 完成检查清单

- [ ] 环境变量已更新(UPLOAD_DIR、MAX_FILE_SIZE)
- [ ] uploads/movies 目录已创建
- [ ] multer 和 uuid 依赖已安装
- [ ] Movie、Image、Tag、MovieTag 模型已添加到 schema.prisma
- [ ] 数据库迁移已完成,四张表已创建
- [ ] Prisma Client 已生成
- [ ] 文件上传配置(upload.ts)已创建
- [ ] 文件工具(file.util.ts)已创建
- [ ] TagRepository 已实现
- [ ] MovieRepository 已实现(支持复杂查询)
- [ ] TagService 已实现
- [ ] MovieService 已实现(包含事务和文件清理)
- [ ] TagController 已实现(角色验证)
- [ ] MovieController 已实现(处理 multipart/form-data)
- [ ] 标签路由已创建并应用 JWT 鉴权
- [ ] 影片路由已创建并应用 JWT 鉴权
- [ ] 主路由已更新(集成新路由)
- [ ] 种子脚本已更新(预设标签)
- [ ] 预设标签已创建(20 个)
- [ ] 登录接口测试通过
- [ ] 标签查询接口测试通过
- [ ] 创建影片接口测试通过(带图片上传)
- [ ] 查询影片列表接口测试通过
- [ ] 查询影片详情接口测试通过
- [ ] 更新影片接口测试通过
- [ ] 删除影片接口测试通过(级联删除)
- [ ] 未登录访问返回 401
- [ ] 代码格式化和检查通过
- [ ] 代码已提交到 Git

---

## 注意事项

1. **文件上传安全**:限制文件类型和大小,使用 uuid 命名避免路径遍历攻击
2. **事务一致性**:创建/删除失败时自动清理已上传的文件
3. **级联删除**:删除影片时自动删除关联的图片和标签关系
4. **权限控制**:创建标签接口仅管理员可访问
5. **数据验证**:Controller 和 Service 层都要进行数据验证
6. **性能优化**:列表查询限制最大条数,只返回封面图

---

## 关键技术点

### 1. Prisma 关系模型

- **一对多关系**(Movie-Image):使用 `@relation` 和外键
- **多对多关系**(Movie-Tag):通过中间表 MovieTag 实现
- **级联删除**:使用 `onDelete: Cascade` 自动清理关联数据

### 2. 文件上传

- **multer**:处理 multipart/form-data 请求
- **diskStorage**:配置文件存储位置和命名规则
- **fileFilter**:验证文件类型
- **事务回滚**:失败时自动删除已上传的文件

### 3. 高级查询

- **动态 where 条件**:根据参数构建查询条件
- **分页**:使用 skip 和 take
- **排序**:使用 orderBy
- **关键词搜索**:使用 contains 和 mode: 'insensitive'
- **标签筛选**:使用嵌套关系查询

### 4. 性能优化

- **include**:避免 N+1 查询
- **列表只返回封面**:减少数据传输量
- **限制查询条数**:防止查询过多数据
