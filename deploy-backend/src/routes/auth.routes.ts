import { Router } from 'express';
import { authController } from '@/controllers/auth.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { loginLimiter } from '@/middlewares/rate-limit.middleware';
import { loginSchema, refreshTokenSchema, registerSchema, changePasswordSchema } from '@/validators/auth.validator';

const router = Router();

// POST /auth/login
router.post('/login', loginLimiter, validate(loginSchema), authController.login.bind(authController));

// POST /auth/refresh
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken.bind(authController));

// POST /auth/register (Tenant Admin cria atendentes)
router.post('/register', authenticate, validate(registerSchema), authController.register.bind(authController));

// POST /auth/change-password
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword.bind(authController));

// GET /auth/me
router.get('/me', authenticate, authController.me.bind(authController));

export default router;
