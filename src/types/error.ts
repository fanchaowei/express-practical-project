/**
 * 自定义错误类型模块
 * 作用：定义应用程序中的各种错误类型，统一错误处理
 *
 * 为什么需要自定义错误类？
 * 1. HTTP 状态码关联：每种错误对应一个 HTTP 状态码
 * 2. 错误分类：区分操作性错误（可预期的）和程序错误（bug）
 * 3. 统一处理：在错误处理中间件中可以根据错误类型做不同处理
 */

/**
 * 应用错误基类
 *
 * 什么是继承？
 * - AppError extends Error：AppError 继承自 JavaScript 内置的 Error 类
 * - 继承的好处：拥有 Error 的所有功能，还可以添加自己的功能
 *
 * 类的组成：
 * 1. 属性（properties）：存储数据
 * 2. 构造函数（constructor）：创建对象时自动调用
 * 3. 方法（methods）：对象可以执行的操作
 */
export class AppError extends Error {
  /**
   * 属性定义
   *
   * public 说明：
   * - public：公开属性，可以在类外部访问
   * - private：私有属性，只能在类内部访问
   * - protected：受保护属性，只能在类和子类内部访问
   */
  public statusCode: number;        // HTTP 状态码，例如：404、500
  public isOperational: boolean;    // 是否为操作性错误（true = 可预期的错误，false = 程序 bug）

  /**
   * 构造函数
   *
   * 参数说明：
   * @param message - 错误消息，描述发生了什么错误
   * @param statusCode - HTTP 状态码，默认值为 500（服务器内部错误）
   * @param isOperational - 是否为操作性错误，默认值为 true
   *
   * 默认参数说明：
   * - statusCode: number = 500 表示如果调用时不提供这个参数，就使用 500
   * - 例如：new AppError('错误') 等同于 new AppError('错误', 500, true)
   */
  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    // super(message)：调用父类（Error）的构造函数，设置错误消息
    super(message);

    // 设置 HTTP 状态码
    this.statusCode = statusCode;

    // 设置是否为操作性错误
    this.isOperational = isOperational;

    /**
     * Error.captureStackTrace 说明：
     * - 作用：捕获错误发生时的调用堆栈（call stack）
     * - 调用堆栈：记录错误发生时的代码执行路径，方便调试
     * - this：当前错误对象
     * - this.constructor：当前类的构造函数
     * - 好处：堆栈信息从我们的代码开始，而不是从 Error 类开始
     */
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误类
 * 用途：表单验证失败、参数不合法等情况
 * HTTP 状态码：400（Bad Request - 错误的请求）
 *
 * 什么是 extends？
 * - ValidationError extends AppError：ValidationError 继承自 AppError
 * - 继承后，ValidationError 拥有 AppError 的所有属性和方法
 * - 只需要指定不同的部分（这里是固定状态码为 400）
 */
export class ValidationError extends AppError {
  /**
   * 构造函数
   * @param message - 验证错误的具体消息，例如："邮箱格式不正确"
   *
   * super(message, 400) 说明：
   * - 调用父类 AppError 的构造函数
   * - 传入 message 和固定的状态码 400
   * - isOperational 使用默认值 true（因为验证错误是可预期的）
   */
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * 未授权错误类
 * 用途：用户未登录或登录已过期
 * HTTP 状态码：401（Unauthorized - 未授权）
 *
 * 默认参数示例：
 * - message: string = 'Unauthorized' 表示如果不提供消息，使用默认值 'Unauthorized'
 * - new UnauthorizedError() 等同于 new UnauthorizedError('Unauthorized')
 * - new UnauthorizedError('登录已过期') 会使用自定义消息
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 禁止访问错误类
 * 用途：用户已登录，但没有权限访问某个资源
 * HTTP 状态码：403（Forbidden - 禁止访问）
 *
 * 401 vs 403 的区别：
 * - 401：你是谁？需要登录（身份验证问题）
 * - 403：我知道你是谁，但你不能访问（权限问题）
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 资源未找到错误类
 * 用途：请求的资源不存在（如：用户不存在、文章不存在）
 * HTTP 状态码：404（Not Found - 未找到）
 *
 * 常见使用场景：
 * - 根据 ID 查询数据库，但记录不存在
 * - 访问不存在的路由
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 冲突错误类
 * 用途：请求的操作与当前状态冲突（如：邮箱已被注册、用户名已存在）
 * HTTP 状态码：409（Conflict - 冲突）
 *
 * 常见使用场景：
 * - 注册时，邮箱已被其他用户使用
 * - 创建资源时，唯一键冲突
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
