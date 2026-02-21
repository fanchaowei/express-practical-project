import prisma from '../config/database';
import { Tag } from '@prisma/client';

/**
 * 标签数据访问层
 */
export class TagRepository {
  /**
   * 创建标签
   */
  static async create(name: string): Promise<Tag> {
    return prisma.tag.create({
      data: { name },
    });
  }

  /**
   * 查询所有标签
   */
  static async findAll(): Promise<Tag[]> {
    return prisma.tag.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 根据名称查询标签
   */
  static async findByName(name: string): Promise<Tag | null> {
    return prisma.tag.findUnique({
      where: { name },
    });
  }

  /**
   * 根据 ID 列表查询标签
   */
  static async findByIds(ids: number[]): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: {
        id: { in: ids },
      },
    });
  }
}
