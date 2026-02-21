import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * 文件工具类
 */
export class FileUtil {
  /**
   * 删除单个文件
   */
  static deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`文件已删除: ${filePath}`);
      }
    } catch (error) {
      logger.error(`删除文件失败: ${filePath}`, error);
    }
  }

  /**
   * 删除多个文件
   */
  static deleteFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => this.deleteFile(filePath));
  }

  /**
   * 将上传的文件转换为相对路径
   */
  // eslint-disable-next-line no-undef
  static getRelativePath(file: Express.Multer.File): string {
    return file.path.replace(/\\/g, '/').split('uploads/')[1];
  }

  /**
   * 将相对路径转换为绝对路径
   */
  static getAbsolutePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }
}
