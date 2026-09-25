import type { ApiBinding } from '../types/designer';

export interface ApiFormInput {
  url: string;
  method: 'GET' | 'POST';
  paramsText: string;
  responsePath: string;
  totalProp: string;
  autoFetch: boolean;
}

export interface MergedApiBinding {
  binding?: ApiBinding;
  paramsError: boolean;
}

/** 把数据源表单写回绑定。URL 未改时保留 example；参数不是 JSON 对象时沿用原参数。 */
export function mergeApiBinding(previous: ApiBinding | undefined, form: ApiFormInput): MergedApiBinding {
  const url = form.url.trim();
  if (!url) return { paramsError: false };

  let params = previous?.params ?? {};
  let paramsError = false;
  const text = form.paramsText.trim();
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) paramsError = true;
      else params = parsed as Record<string, unknown>;
    } catch {
      paramsError = true;
    }
  } else {
    params = {};
  }

  const binding: ApiBinding = {
    url,
    method: form.method,
    params,
    autoFetch: form.autoFetch,
    responsePath: form.responsePath.trim() || undefined,
    totalProp: form.totalProp.trim() || undefined
  };
  if (previous?.example !== undefined && previous.url === url) binding.example = previous.example;
  return { binding, paramsError };
}

export function moveListItem<T>(list: T[], index: number, delta: number): void {
  const next = index + delta;
  if (next < 0 || next >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
}
