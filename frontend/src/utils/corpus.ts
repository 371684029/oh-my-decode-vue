import type { PageSchema } from '../types/designer';
import { generateHTML, generateVueSFC } from './codeGenerator';

export type CorpusKind = 'vue' | 'html';

export interface CorpusEntry {
  id: string;
  title: string;
  kind: CorpusKind;
  filename: string;
  source: string;
}

function fileBase(id: string): string {
  const base = id
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'page';
}

/** 同一 id 只留一份。后出现的 Schema 覆盖先前的，便于当前画布盖过已保存副本。 */
export function mergeCorpusSchemas(schemas: PageSchema[]): PageSchema[] {
  const map = new Map<string, PageSchema>();
  for (const schema of schemas) {
    if (!schema?.id) continue;
    map.set(schema.id, schema);
  }
  return [...map.values()];
}

/** 每个页面各产出一条 Vue 组件和一条 HTML 组件。 */
export function buildCorpus(schemas: PageSchema[]): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const schema of mergeCorpusSchemas(schemas)) {
    const title = schema.title?.trim() || '未命名页面';
    const base = fileBase(schema.id);
    entries.push({
      id: schema.id,
      title,
      kind: 'vue',
      filename: `${base}.vue`,
      source: generateVueSFC(schema)
    });
    entries.push({
      id: schema.id,
      title,
      kind: 'html',
      filename: `${base}.html`,
      source: generateHTML(schema)
    });
  }
  return entries;
}

export function renderCorpusJsonl(entries: CorpusEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
}
