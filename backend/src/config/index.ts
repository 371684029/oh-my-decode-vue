import path from 'path';

export const PORT = process.env.PORT || 3001;
export const STORAGE_PAGES_DIR = path.resolve(__dirname, '../../storage/pages');
export const STORAGE_COMPONENTS_DIR = path.resolve(__dirname, '../../storage/components');
export const DB_FILE_PATH = path.resolve(__dirname, '../../data/logs.db');
