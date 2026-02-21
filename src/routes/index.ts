/**
 * 主路由模块
 * 作用：定义应用程序的路由规则，将 URL 映射到处理函数
 *
 * 什么是路由？
 * - 路由：决定应用程序如何响应客户端对特定 URL 的请求
 * - 例如：GET /health → 返回健康检查信息
 * - 路由由 HTTP 方法 + URL 路径组成
 *
 * HTTP 方法说明：
 * - GET：获取资源（查询数据）
 * - POST：创建资源（提交数据）
 * - PUT/PATCH：更新资源（修改数据）
 * - DELETE：删除资源
 */

// 导入 Express 的 Router 类，用于创建路由
import { Router } from 'express';

// 导入响应工具类，用于统一返回格式
import { ResponseUtil } from '../utils/response';
import authRoutes from './auth.routes';

/**
 * 创建路由实例
 * Router() 返回一个路由器对象，可以定义多个路由规则
 */
const router = Router();

/**
 * 健康检查路由
 *
 * 路由定义：GET /health
 *
 * 作用：
 * - 检查应用程序是否正常运行
 * - 常用于监控系统（如：Kubernetes健康检查）
 * - 返回运行时间、环境等信息
 *
 * 参数说明：
 * @param req - 请求对象（Request），包含客户端发送的所有信息
 * @param res - 响应对象（Response），用于向客户端发送数据
 *
 * 箭头函数说明：
 * - (req, res) => { ... } 是 ES6 的箭头函数语法
 * - 等同于：function(req, res) { ... }
 * - 箭头函数更简洁，常用于回调函数
 */
router.get('/health', (_req, res) => {
  /**
   * 使用 ResponseUtil.success 返回成功响应
   *
   * 返回数据包括：
   * - status: 'ok' - 表示应用正常运行
   * - uptime: process.uptime() - 应用运行时间（秒）
   * - environment: process.env.NODE_ENV - 当前运行环境
   *
   * process 对象说明：
   * - process：Node.js 全局对象，提供当前进程的信息
   * - process.uptime()：返回进程运行的秒数
   * - process.env.NODE_ENV：获取环境变量
   */
  ResponseUtil.success(res, {
    status: 'ok',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

/**
 * API 版本信息路由
 *
 * 路由定义：GET /api/v1
 *
 * 作用：
 * - 返回 API 版本信息
 * - 确认 API 是否正常运行
 * - 方便前端判断 API 是否可用
 *
 * URL 设计说明：
 * - /api/v1：表示这是 API 的第 1 个版本
 * - 版本化的好处：后续可以添加 /api/v2，同时保持 v1 兼容
 */
router.get('/api/v1', (_req, res) => {
  ResponseUtil.success(res, {
    version: '1.0.0', // API 版本号
    message: 'API is running', // 状态消息
  });
});

/**
 * 认证路由
 * 挂载认证相关的路由到 /api/v1/auth 路径下
 */
router.use('/api/v1/auth', authRoutes);

/**
 * 导出路由器
 * 在其他文件中可以通过 import routes from './routes' 导入这个路由器
 * 然后用 app.use('/', routes) 将路由注册到 Express 应用中
 *
 * default 导出说明：
 * - export default：默认导出，每个模块只能有一个
 * - 导入时不需要花括号：import routes from './routes'
 */
export default router;
