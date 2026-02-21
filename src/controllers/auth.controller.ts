import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../types';

/**
 * 认证控制器
 */
export class AuthController {
  /**
   * 用户登录
   */
  static login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      throw new ValidationError('用户名和密码不能为空');
    }

    // 调用服务层
    const result = await AuthService.login(username, password);

    // 返回成功响应
    return ResponseUtil.success(res, result, '登录成功');
  });
}
