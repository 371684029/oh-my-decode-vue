import Database from 'better-sqlite3';
import { DB_FILE_PATH } from '../config';
import { OperationLog } from '../types/schema';

class LogDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_FILE_PATH);
    this.init();
  }

  private init() {
    const query = `
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id TEXT NOT NULL,
        action TEXT NOT NULL,
        operator TEXT NOT NULL DEFAULT 'system',
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    this.db.exec(query);
  }

  addLog(log: OperationLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO operation_logs (page_id, action, operator, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(log.page_id, log.action, log.operator || 'system', log.details || null);
  }

  getLogsByPageId(pageId: string): OperationLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM operation_logs WHERE page_id = ? ORDER BY id DESC LIMIT 50
    `);
    return stmt.all(pageId) as OperationLog[];
  }

  getAllLogs(limit: number = 100): OperationLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?
    `);
    return stmt.all(limit) as OperationLog[];
  }
}

export const logDatabase = new LogDatabase();
