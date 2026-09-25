import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * X-Api-Key 最小化认证
 * - 环境变量 API_KEY 配置后即启用（未配置则保持向后兼容，不限制访问）
 * - operator 由服务端从请求解析（优先 x-operator，缺省 designer_user）
 */
function keysMatch(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    next();
    return;
  }
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || !keysMatch(key, apiKey)) {
    res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing X-Api-Key' });
    return;
  }
  next();
}

/** 解析操作人。未启用 API_KEY 时仍清洗 header，避免把换行或路径写进审计日志。 */
export function resolveOperator(req: Request): string {
  if (process.env.API_KEY) {
    return 'api_user';
  }
  const raw = typeof req.headers['x-operator'] === 'string' ? req.headers['x-operator'] : 'designer_user';
  const cleaned = raw.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
  return cleaned || 'designer_user';
}
