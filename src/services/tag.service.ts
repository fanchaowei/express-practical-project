import { TagRepository } from '../repositories/tag.repository';
import { ConflictError, ValidationError } from '../types';

/**
 * 标签业务逻辑层
 */
export class TagService {
  /**
   * 创建标签
   */
  static async create(name: string) {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('标签名称不能为空');
    }

    const existing = await TagRepository.findByName(name);
    if (existing) {
      throw new ConflictError('标签已存在');
    }

    return TagRepository.create(name);
  }

  /**
   * 查询所有标签
   */
  static async findAll() {
    return TagRepository.findAll();
  }
}
