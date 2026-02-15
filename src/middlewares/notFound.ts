import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../types';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};
