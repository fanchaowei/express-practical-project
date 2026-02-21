import { Request, Response, NextFunction } from 'express';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';
import { UnauthorizedError } from '../types';

// 扩展Express的Request类型，添加user属性
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT认证中间件
 * 验证请求头中的token，并将用户信息挂载到req.user
 */
export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // 1. 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('缺少认证令牌');
    }

    // 2. 解析token（格式：Bearer <token>）
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('认证令牌格式错误');
    }

    const token = parts[1];

    // 3. 验证token
    const payload = JwtUtil.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedError('认证令牌无效或已过期');
    }

    // 4. 将用户信息挂载到request
    req.user = payload;

    next();
  } catch (error) {
    next(error);
  }
};
