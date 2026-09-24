import axios from 'axios';
import { ElMessage } from 'element-plus';

/**
 * 统一 HTTP 客户端（P2-6）
 * - 统一注入 baseURL 与可选 X-Api-Key
 * - 统一错误降级：后端不可达 / 认证失败 / 业务错误 → 全局提示
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001/api';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000
});

http.interceptors.request.use((config) => {
  if (API_KEY) {
    config.headers.set('X-Api-Key', API_KEY);
  }
  config.headers.set('X-Operator', 'designer_user');
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // 后端不可达：全局降级提示
      ElMessage.error(`无法连接后端服务，请确认服务已启动 (${API_BASE})`);
    } else if (error.response.status === 401) {
      ElMessage.error('认证失败：请检查前端 VITE_API_KEY 与后端 API_KEY 是否一致');
    }
    // 其余业务错误交由调用方处理（避免重复提示）
    return Promise.reject(error);
  }
);

export { API_BASE };
