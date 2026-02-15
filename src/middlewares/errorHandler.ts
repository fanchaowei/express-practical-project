import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { env } from '../config/env';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 处理自定义错误
  if (err instanceof AppError) {
    return ResponseUtil.error(
      res,
      err.message,
      err.statusCode,
      env.NODE_ENV === 'development' ? err.stack : undefined
    );
  }

  // 处理 Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    return ResponseUtil.error(res, 'Database error', 400);
  }

  // 处理验证错误
  if (err.name === 'ValidationError') {
    return ResponseUtil.error(res, err.message, 400);
  }

  // 默认错误
  return ResponseUtil.error(
    res,
    'Internal server error',
    500,
    env.NODE_ENV === 'development' ? err.message : undefined
  );
};
