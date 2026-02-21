import prisma from '../config/database';
import { User } from '@prisma/client';

/**
 * 用户数据访问层
 */
export class UserRepository {
  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * 根据ID查找用户
   */
  static async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 创建用户
   */
  static async create(data: { username: string; password: string; role?: string }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }
}
