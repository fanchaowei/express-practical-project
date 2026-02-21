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
  static create = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
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
      // eslint-disable-next-line no-undef
      files: req.files as Express.Multer.File[],
      coverIndex: parsedCoverIndex,
    });

    return ResponseUtil.success(res, result, '影片创建成功', 201);
  });

  /**
   * 查询影片列表
   */
  static list = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
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
  static getById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      throw new ValidationError('无效的影片 ID');
    }

    const result = await MovieService.findById(id);
    return ResponseUtil.success(res, result, '查询成功');
  });

  /**
   * 更新影片信息
   */
  static update = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const id = parseInt(String(req.params.id), 10);
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
  static delete = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      throw new ValidationError('无效的影片 ID');
    }

    await MovieService.delete(id);
    return ResponseUtil.success(res, null, '影片删除成功');
  });

  /**
   * 添加图片到影片
   */
  static addImages = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const movieId = parseInt(String(req.params.id), 10);
    if (isNaN(movieId)) {
      throw new ValidationError('无效的影片 ID');
    }

    const setCover = req.body.setCover === 'true' || req.body.setCover === true;
    // eslint-disable-next-line no-undef
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
  static deleteImage = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const movieId = parseInt(String(req.params.id), 10);
    const imageId = parseInt(String(req.params.imageId), 10);

    if (isNaN(movieId) || isNaN(imageId)) {
      throw new ValidationError('无效的 ID');
    }

    await MovieService.deleteImage(movieId, imageId);
    return ResponseUtil.success(res, null, '图片删除成功');
  });
}
