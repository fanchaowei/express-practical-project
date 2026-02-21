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
  static create = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
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
  static list = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
    const result = await TagService.findAll();
    return ResponseUtil.success(res, result, '查询成功');
  });
}
