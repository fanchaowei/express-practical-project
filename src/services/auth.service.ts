import { UserRepository } from '../repositories/user.repository';
import { PasswordUtil } from '../utils/password.util';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';
import { UnauthorizedError } from '../types';

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * 认证服务
 */
export class AuthService {
  /**
   * 用户登录
   */
  static async login(username: string, password: string): Promise<LoginResponse> {
    // 1. 查找用户
    const user = await UserRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 2. 验证密码
    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 3. 生成token
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    const token = JwtUtil.generateToken(payload);

    // 4. 返回结果（不包含密码）
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
