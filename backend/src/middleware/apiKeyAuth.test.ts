import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { apiKeyAuth } from './apiKeyAuth';

function runAuth(key?: string) {
  const req = { headers: key === undefined ? {} : { 'x-api-key': key } } as Request;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  const next = vi.fn();
  apiKeyAuth(req, res, next);
  return { status, json, next };
}

describe('apiKeyAuth', () => {
  afterEach(() => {
    delete process.env.API_KEY;
  });

  test('未配置密钥时放行', () => {
    delete process.env.API_KEY;
    const { next, status } = runAuth();
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  test('错误密钥返回 401', () => {
    process.env.API_KEY = 'secret-value';
    const { next, status } = runAuth('wrong');
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});
