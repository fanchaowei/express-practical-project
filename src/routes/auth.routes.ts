import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', AuthController.login);

export default router;
