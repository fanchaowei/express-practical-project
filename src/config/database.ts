/**
 * 数据库配置模块
 * 作用：创建和管理 Prisma 数据库客户端，提供连接和断开连接的功能
 *
 * 什么是 Prisma？
 * - Prisma 是一个现代的 ORM（对象关系映射）工具
 * - ORM 的作用：让我们可以用 JavaScript/TypeScript 对象来操作数据库，而不是写 SQL 语句
 * - 例如：prisma.user.create() 而不是 INSERT INTO users ...
 */

// 导入 Prisma 客户端类
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// 导入环境配置，用于根据不同环境设置不同的日志级别
import { env } from './env';

/**
 * 创建 SQLite adapter
 *
 * Prisma 7 新要求：
 * - 需要使用 driver adapter 来连接数据库
 * - adapter 是数据库驱动的抽象层，负责实际的数据库通信
 *
 * 什么是 adapter？
 * - adapter（适配器）是设计模式中的一种
 * - 作用：让不兼容的接口可以一起工作
 * - 这里：让 better-sqlite3（数据库驱动）与 Prisma（ORM）可以一起工作
 *
 * DATABASE_URL 格式（SQLite）：
 * - "file:./dev.db" 表示在当前目录创建 dev.db 文件
 * - SQLite 是文件型数据库，所有数据存储在一个文件中
 */
const adapter = new PrismaBetterSqlite3({
  url: env.DATABASE_URL || 'file:./dev.db',
});

/**
 * 创建 Prisma 客户端实例
 *
 * 配置说明：
 * - adapter: Prisma 7 新增的必需参数，用于连接数据库
 * - log: 控制 Prisma 输出的日志类型
 *   - 开发环境（development）：输出查询、错误、警告日志，方便调试
 *   - 生产环境（production）：只输出错误日志，减少日志量
 *
 * 三元运算符解释：
 * - 格式：条件 ? 真值 : 假值
 * - env.NODE_ENV === 'development' ? A : B
 *   表示：如果是开发环境，使用 A，否则使用 B
 */
const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * 测试数据库连接函数
 *
 * 作用：在应用启动时测试数据库连接是否正常
 *
 * async/await 说明：
 * - async：表示这是一个异步函数，会返回 Promise
 * - await：等待异步操作完成后再继续执行
 * - $connect()：Prisma 提供的连接数据库方法
 *
 * try-catch 说明：
 * - try：尝试执行可能出错的代码
 * - catch：如果出错，捕获错误并处理
 * - 好处：程序不会因为错误而崩溃，可以优雅地处理错误
 *
 * process.exit(1) 说明：
 * - process.exit()：退出 Node.js 进程
 * - 参数 1：表示异常退出（非 0 表示有错误）
 * - 参数 0：表示正常退出
 * - 为什么要退出？数据库无法连接时，应用无法正常工作，应该立即停止
 */
export const connectDatabase = async () => {
  try {
    // 尝试连接数据库
    await prisma.$connect();
    // 连接成功，输出成功消息（✅ 表示成功的图标）
    console.log('✅ Database connected successfully');
  } catch (error) {
    // 连接失败，输出错误消息（❌ 表示失败的图标）
    console.error('❌ Database connection failed:', error);
    // 退出应用程序（因为数据库是必需的）
    process.exit(1);
  }
};

/**
 * 优雅关闭数据库连接函数
 *
 * 作用：在应用关闭时，正确断开数据库连接
 *
 * 为什么需要优雅关闭？
 * - 避免数据库连接泄漏（占用资源）
 * - 确保正在执行的数据库操作完成
 * - 防止数据丢失或损坏
 *
 * $disconnect() 说明：
 * - Prisma 提供的断开连接方法
 * - 会等待所有正在进行的查询完成后再断开
 */
export const disconnectDatabase = async () => {
  // 断开数据库连接
  await prisma.$disconnect();
  // 输出断开连接的消息
  console.log('Database disconnected');
};

/**
 * 导出 Prisma 客户端实例
 *
 * 作用：在其他文件中使用这个实例来操作数据库
 *
 * 使用示例：
 * import prisma from './config/database';
 * const users = await prisma.user.findMany(); // 查询所有用户
 *
 * 为什么使用 default 导出？
 * - 每个模块只需要一个 Prisma 实例（单例模式）
 * - default 导出让导入语法更简洁
 */
export default prisma;
