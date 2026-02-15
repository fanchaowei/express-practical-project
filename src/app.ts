/**
 * Express 应用配置模块
 * 作用：配置 Express 应用的所有中间件和路由
 *
 * 什么是 Express？
 * - Express 是 Node.js 最流行的 Web 框架
 * - 提供简洁的 API 来创建 Web 服务器和 API
 * - 核心概念：中间件（Middleware）
 *
 * 什么是中间件？
 * - 中间件：在请求到达最终处理函数之前，依次执行的函数
 * - 像流水线：请求 → 中间件1 → 中间件2 → ... → 路由处理 → 响应
 * - 每个中间件可以：修改请求/响应、结束请求、调用下一个中间件
 */

// 导入 Express 核心模块和类型
import express, { Application } from 'express';

// 导入第三方中间件
import cors from 'cors';           // 处理跨域请求
import helmet from 'helmet';       // 设置安全相关的 HTTP 头
import rateLimit from 'express-rate-limit';  // API 请求频率限制

// 导入项目配置和中间件
import { env } from './config/env';
import { errorHandler, notFound, requestLogger } from './middlewares';
import routes from './routes';

/**
 * 创建 Express 应用实例
 * Application 类型：TypeScript 类型定义，提供代码提示和类型检查
 */
const app: Application = express();

/**
 * ============ 安全中间件 ============
 */

/**
 * Helmet 安全中间件
 *
 * 作用：设置安全相关的 HTTP 响应头，防止常见的 Web 攻击
 *
 * 它会设置哪些响应头？
 * - X-Content-Type-Options: 防止 MIME 类型嗅探攻击
 * - X-Frame-Options: 防止点击劫持攻击
 * - Content-Security-Policy: 防止 XSS 跨站脚本攻击
 * - 等等...
 *
 * 为什么需要？
 * - 默认情况下，Express 不设置这些安全头
 * - 使用 Helmet 可以一键启用多种安全防护
 */
app.use(helmet());

/**
 * CORS 中间件
 *
 * 什么是 CORS？
 * - CORS：Cross-Origin Resource Sharing（跨域资源共享）
 * - 跨域：前端（如 http://localhost:3001）访问后端（如 http://localhost:3000）
 * - 浏览器默认禁止跨域请求，需要后端明确允许
 *
 * 配置说明：
 * - origin：允许哪些域名访问 API
 *   - 开发环境：'*' 允许所有域名（方便开发）
 *   - 生产环境：[] 空数组，需要手动配置允许的域名（安全）
 * - credentials: true：允许携带 Cookie 和认证信息
 *
 * 三元运算符：
 * - env.NODE_ENV === 'production' ? [] : '*'
 * - 如果是生产环境，使用空数组；否则使用 '*'
 */
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? [] : '*',
    credentials: true,
  })
);

/**
 * ============ 请求频率限制 ============
 */

/**
 * Rate Limiter 中间件
 *
 * 作用：限制同一 IP 地址的请求频率，防止 API 滥用和 DDoS 攻击
 *
 * 配置说明：
 * - windowMs：时间窗口（毫秒）
 *   - 15 * 60 * 1000 = 15 分钟
 * - max：在时间窗口内最多允许多少次请求
 *   - 100 表示 15 分钟内最多 100 次请求
 * - message：超过限制时返回的错误消息
 *
 * 工作原理：
 * 1. 记录每个 IP 地址的请求次数
 * 2. 如果在 15 分钟内超过 100 次，拒绝请求
 * 3. 15 分钟后重置计数
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分钟
  max: 100,                   // 限制 100 个请求
  message: 'Too many requests from this IP, please try again later.',
});

/**
 * 只对 /api 开头的路由应用频率限制
 * 为什么？健康检查等路由不需要限制
 */
app.use('/api', limiter);

/**
 * ============ 请求体解析中间件 ============
 */

/**
 * JSON 解析中间件
 *
 * 作用：自动解析 JSON 格式的请求体
 *
 * 例如：前端发送 { "name": "张三" }
 * 解析后可以通过 req.body.name 访问
 *
 * limit: '10mb'：限制请求体大小为 10MB
 * 为什么限制？防止恶意用户发送超大请求，耗尽服务器内存
 */
app.use(express.json({ limit: '10mb' }));

/**
 * URL-encoded 解析中间件
 *
 * 作用：解析表单提交的数据（Content-Type: application/x-www-form-urlencoded）
 *
 * extended: true 说明：
 * - true：使用 qs 库解析（支持嵌套对象）
 * - false：使用 querystring 库解析（只支持简单键值对）
 *
 * 表单数据示例：name=张三&age=20
 * 解析后：req.body = { name: '张三', age: '20' }
 */
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * ============ 静态文件服务 ============
 */

/**
 * 静态文件中间件
 *
 * 作用：直接访问上传的文件（如图片、视频）
 *
 * 例如：
 * - 文件路径：uploads/avatar.jpg
 * - 访问 URL：http://localhost:3000/uploads/avatar.jpg
 *
 * express.static() 说明：
 * - 将指定目录作为静态资源目录
 * - 浏览器可以直接访问该目录下的文件
 */
app.use('/uploads', express.static(env.UPLOAD_DIR));

/**
 * ============ 请求日志中间件 ============
 */

/**
 * 自定义请求日志中间件
 * 记录每个请求的：方法、路径、状态码、响应时间
 * 方便调试和监控
 */
app.use(requestLogger);

/**
 * ============ 路由 ============
 */

/**
 * 注册主路由
 * 将所有路由规则应用到根路径 '/'
 * 例如：routes 中定义的 /health 会映射到 http://localhost:3000/health
 */
app.use('/', routes);

/**
 * ============ 错误处理中间件 ============
 */

/**
 * 404 处理中间件
 *
 * 作用：当请求的路由不存在时，返回 404 错误
 *
 * 位置很重要：
 * - 必须放在所有路由之后
 * - 只有当前面的路由都不匹配时，才会执行这个中间件
 */
app.use(notFound);

/**
 * 错误处理中间件
 *
 * 作用：捕获所有错误，返回统一的错误响应
 *
 * 位置很重要：
 * - 必须放在最后
 * - 捕获前面所有中间件和路由抛出的错误
 *
 * 特殊签名：
 * - 错误处理中间件有 4 个参数：(err, req, res, next)
 * - Express 根据参数数量识别这是错误处理中间件
 */
app.use(errorHandler);

/**
 * 导出 Express 应用实例
 * 在 index.ts 中导入这个实例，启动 HTTP 服务器
 */
export default app;
