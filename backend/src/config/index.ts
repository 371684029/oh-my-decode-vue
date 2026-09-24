import path from 'path';

export const PORT = Number(process.env.PORT || 3001);
export const HOST = process.env.HOST || '127.0.0.1';
/** 逗号分隔的允许来源，默认只放行本地设计器 */
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
export const STORAGE_PAGES_DIR = path.resolve(__dirname, '../../storage/pages');
export const STORAGE_COMPONENTS_DIR = path.resolve(__dirname, '../../storage/components');
export const DB_FILE_PATH = path.resolve(__dirname, '../../data/logs.db');
