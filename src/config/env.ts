/**
 * 环境变量配置模块
 * 作用：统一管理应用程序的所有环境变量配置
 *
 * 为什么需要这个文件？
 * 1. 集中管理：将所有配置集中在一个地方，方便维护
 * 2. 类型安全：使用 TypeScript 接口定义配置结构，避免拼写错误
 * 3. 默认值：为可选配置提供合理的默认值
 * 4. 验证：在应用启动时检查必需的配置是否存在
 */

// 导入 dotenv 库，用于读取 .env 文件中的环境变量
import dotenv from 'dotenv';

// 调用 config() 方法，将 .env 文件中的变量加载到 process.env 对象中
// 例如：.env 中的 PORT=3000 会被加载为 process.env.PORT = '3000'
dotenv.config();

/**
 * 环境变量配置接口
 * 定义应用程序需要的所有配置项及其类型
 */
interface EnvConfig {
  NODE_ENV: string;        // 运行环境：development（开发）、production（生产）、test（测试）
  PORT: number;            // 服务器监听的端口号，例如：3000
  DATABASE_URL: string;    // 数据库连接字符串，例如：postgresql://user:pass@localhost:5432/dbname
  JWT_SECRET: string;      // JWT 密钥，用于加密和验证用户身份令牌（后续会用到）
  JWT_EXPIRES_IN: string;  // JWT 过期时间，例如：7d（7天）、24h（24小时）
  UPLOAD_DIR: string;      // 文件上传目录路径
  MAX_FILE_SIZE: number;   // 文件上传大小限制（字节），例如：5242880 = 5MB
}

/**
 * 获取环境变量配置函数
 *
 * 作用：从 process.env 中读取环境变量，并提供默认值
 *
 * 为什么要用 || 运算符？
 * - process.env.PORT 可能不存在（undefined）
 * - || 运算符表示"如果左边是假值（undefined、null、''等），就使用右边的默认值"
 * - 例如：process.env.PORT || '3000' 表示"如果没有设置 PORT，就使用 3000"
 *
 * 为什么要用 parseInt？
 * - process.env 中所有值都是字符串类型
 * - parseInt('3000', 10) 将字符串转换为十进制数字
 * - 第二个参数 10 表示十进制（避免八进制解析问题）
 */
const getEnvConfig = (): EnvConfig => {
  return {
    // 获取运行环境，默认为 development（开发环境）
    NODE_ENV: process.env.NODE_ENV || 'development',

    // 获取端口号，默认为 3000，并转换为数字类型
    PORT: parseInt(process.env.PORT || '3000', 10),

    // 数据库连接字符串，默认为空字符串（启动时会验证是否设置）
    DATABASE_URL: process.env.DATABASE_URL || '',

    // JWT 密钥，默认为空字符串（启动时会验证是否设置）
    JWT_SECRET: process.env.JWT_SECRET || '',

    // JWT 过期时间，默认为 7 天
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    // 文件上传目录，默认为 uploads 文件夹
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

    // 文件大小限制，默认为 5MB（5 * 1024 * 1024 = 5242880 字节）
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  };
};

/**
 * 导出配置对象
 * 在其他文件中可以通过 import { env } from './config/env' 来使用
 * 例如：env.PORT、env.DATABASE_URL 等
 */
export const env = getEnvConfig();

/**
 * 验证必需的环境变量函数
 *
 * 作用：检查关键的环境变量是否已设置，如果缺失则抛出错误
 *
 * 为什么需要验证？
 * - DATABASE_URL 和 JWT_SECRET 是应用运行的必要条件
 * - 如果缺失这些配置，应用无法正常工作
 * - 在应用启动时就发现问题，而不是运行时才报错
 *
 * 工作原理：
 * 1. filter() 方法：筛选出在 process.env 中不存在的变量名
 * 2. 如果有缺失的变量，抛出错误并终止应用启动
 * 3. 错误信息会列出所有缺失的变量名，方便调试
 */
export const validateEnv = () => {
  // 定义必需的环境变量列表
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

  // 筛选出缺失的环境变量
  // filter 会遍历数组，保留返回 true 的元素
  // !process.env[envVar] 表示该环境变量不存在或为空
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  // 如果有缺失的环境变量，抛出错误
  if (missingEnvVars.length > 0) {
    // join(', ') 将数组转换为逗号分隔的字符串，例如：['A', 'B'] => 'A, B'
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
};
