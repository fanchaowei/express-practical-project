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
   * 查询影片列表(优化版:精确返回字段,减少数据传输)
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
