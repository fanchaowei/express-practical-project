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
    // eslint-disable-next-line no-undef
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
  // eslint-disable-next-line no-undef
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
