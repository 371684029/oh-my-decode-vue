/** 恢复接口同时接受 index 与 backup，缺省为最新一代 1。 */
export function parseRestoreIndex(body: unknown, query: unknown): number {
  const source = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
  const fromBody = source(body);
  const fromQuery = source(query);
  const raw = fromBody.index ?? fromBody.backup ?? fromQuery.index ?? fromQuery.backup ?? 1;
  const index = Number(raw);
  return Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1;
}
