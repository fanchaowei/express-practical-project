/**
 * 响应工具类模块
 * 作用：统一API响应格式，确保所有接口返回一致的数据结构
 *
 * 为什么需要统一响应格式？
 * 1. 前端处理方便：所有响应结构一致，前端可以用统一的方式处理
 * 2. 易于调试：通过 success 字段快速判断请求是否成功
 * 3. 规范化：避免不同开发者返回不同的响应格式
 */

// 导入 Express 的 Response 类型
import { Response } from 'express';

// 导入自定义的响应类型定义
import { ApiResponse, PaginatedResponse } from '../types';

/**
 * 响应工具类
 *
 * 什么是静态方法？
 * - static：静态方法，直接通过类名调用，无需创建实例
 * - 调用方式：ResponseUtil.success() 而不是 new ResponseUtil().success()
 * - 好处：工具类不需要保存状态，直接调用更方便
 */
export class ResponseUtil {
  /**
   * 成功响应方法
   *
   * 泛型 <T> 说明：
   * - <T> 是泛型参数，表示"任意类型"
   * - 让函数可以处理不同类型的数据，同时保持类型安全
   * - 例如：success<User>(...) 表示返回用户数据，success<Post>(...) 表示返回文章数据
   *
   * @param res - Express 的响应对象，用于向客户端发送数据
   * @param data - 要返回的数据（可以是任意类型）
   * @param message - 成功消息，默认为 'Success'
   * @param statusCode - HTTP 状态码，默认为 200（OK）
   * @returns 返回 Express Response 对象（方便链式调用）
   *
   * 使用示例：
   * ResponseUtil.success(res, { id: 1, name: '张三' }, '获取用户成功');
   * // 返回：{ success: true, message: '获取用户成功', data: { id: 1, name: '张三' }, timestamp: '...' }
   */
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200
  ): Response {
    // 构造响应对象
    const response: ApiResponse<T> = {
      success: true, // 表示请求成功
      message, // 成功消息（ES6 简写，等同于 message: message）
      data, // 返回的数据
      timestamp: new Date().toISOString(), // ISO 8601 格式的时间戳，例如：2024-01-01T12:00:00.000Z
    };

    /**
     * 发送 JSON 响应
     * - res.status(statusCode)：设置 HTTP 状态码
     * - .json(response)：将对象转换为 JSON 字符串并发送给客户端
     * - return：返回 Response 对象，支持链式调用
     */
    return res.status(statusCode).json(response);
  }

  /**
   * 错误响应方法
   *
   * @param res - Express 响应对象
   * @param message - 错误消息，默认为 'Error'
   * @param statusCode - HTTP 状态码，默认为 500（服务器内部错误）
   * @param error - 可选的详细错误信息（通常只在开发环境显示）
   * @returns 返回 Express Response 对象
   *
   * 使用示例：
   * ResponseUtil.error(res, '用户不存在', 404);
   * // 返回：{ success: false, message: '用户不存在', timestamp: '...' }
   *
   * 参数 error?: string 说明：
   * - ? 表示可选参数，可以不传
   * - 在开发环境可以传入错误堆栈信息，方便调试
   * - 在生产环境通常不传，避免泄露敏感信息
   */
  static error(
    res: Response,
    message: string = 'Error',
    statusCode: number = 500,
    error?: string
  ): Response {
    // 构造错误响应对象
    const response: ApiResponse = {
      success: false, // 表示请求失败
      message, // 错误消息
      error, // 详细错误信息（可选）
      timestamp: new Date().toISOString(),
    };

    // 发送 JSON 响应
    return res.status(statusCode).json(response);
  }

  /**
   * 分页响应方法
   *
   * 什么是分页？
   * - 当数据很多时（例如1000条记录），一次性返回会很慢
   * - 分页：每次只返回一部分数据（例如每页10条）
   * - 前端可以通过"上一页""下一页"按钮加载更多数据
   *
   * @param res - Express 响应对象
   * @param data - 当前页的数据数组
   * @param page - 当前页码（从 1 开始）
   * @param limit - 每页数据条数
   * @param total - 总数据条数
   * @param message - 成功消息，默认为 'Success'
   * @returns 返回 Express Response 对象
   *
   * 使用示例：
   * const users = [...]; // 从数据库查询的用户列表
   * ResponseUtil.paginated(res, users, 1, 10, 100);
   * // 返回：{
   * //   success: true,
   * //   data: [...],
   * //   pagination: { page: 1, limit: 10, total: 100, totalPages: 10 },
   * //   timestamp: '...'
   * // }
   */
  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Success'
  ): Response {
    // 构造分页响应对象
    const response: PaginatedResponse<T> = {
      success: true,
      message,
      data, // 当前页的数据
      pagination: {
        page, // 当前页码
        limit, // 每页条数
        total, // 总条数
        /**
         * Math.ceil() 说明：
         * - ceil：ceiling，天花板，向上取整
         * - total / limit：总页数（可能是小数）
         * - 例如：101 条数据，每页 10 条，101 / 10 = 10.1 页
         * - Math.ceil(10.1) = 11 页（需要11页才能显示完所有数据）
         */
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };

    // 固定返回 200 状态码（因为成功响应）
    return res.status(200).json(response);
  }
}
