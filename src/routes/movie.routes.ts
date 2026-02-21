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
