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
