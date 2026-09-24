import { Request, Response, NextFunction } from 'express';

/**
 * X-Api-Key 最小化认证
 * - 环境变量 API_KEY 配置后即启用（未配置则保持向后兼容，不限制访问）
 * - operator 由服务端从请求解析（优先 x-operator，缺省 designer_user）
 */
const API_KEY = process.env.API_KEY;

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || key !== API_KEY) {
    res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing X-Api-Key' });
    return;
  }
  next();
}

/** 解析操作人（服务端判定，客户端 header 仅作展示） */
export function resolveOperator(req: Request): string {
  if (!API_KEY) {
    return (req.headers['x-operator'] as string) || 'designer_user';
  }
  // 启用认证后，operator 与认证 key 绑定（客户端不可伪造）
  return 'api_user';
}
