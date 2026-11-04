/**
 * 物料导入/导出 IO (v2.8.0 巨型文件拆分)。
 *
 * 从 MaterialManager.vue 抽出：文件/粘贴导入、导出 Vue 与 HTML。
 * 这组 handler 只依赖自身 refs 与物料注册表、出码器，
 * 不访问组件其它状态，因此可独立成 composable。
 */
import { ref } from 'vue';
import { errorText } from '@lowcode/shared';
import { ElMessage } from 'element-plus';
import { registerMaterial } from '../registry/materialRegistry';
import { parseMaterialSource } from '../utils/materialImport';
import { generateMaterialBundle } from '../utils/codeGenerator';
import { http } from '../utils/http';
import type { MaterialManifest } from '../types/designer';

export function useMaterialIO() {
  const showPaste = ref(false);
  const pasteText = ref('');

  const importManifest = async (manifest: MaterialManifest) => {
    const reg = registerMaterial(manifest);
    if (!reg.ok) {
      ElMessage.warning(reg.reason);
      return false;
    }
    try {
      await http.post('/materials', manifest);
      ElMessage.success(`已导入物料：${manifest.label}`);
    } catch {
      ElMessage.warning('物料已加入本地面板，但后端保存失败');
    }
    return true;
  };

  const handleFileImport = async (file: { raw?: File }) => {
    const raw = file.raw;
    if (!raw) return;
    const text = await raw.text();
    try {
      const { manifest, source } = parseMaterialSource(text, raw.name);
      await importManifest(manifest);
      if (source === 'degraded') {
        ElMessage.warning('该文件不含物料定义注释块，已降级为空快照物料（不可拖拽，需重新打包内容）');
      }
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '导入失败'));
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.value.trim()) {
      ElMessage.warning('请先粘贴内容');
      return;
    }
    try {
      const { manifest, source } = parseMaterialSource(pasteText.value, 'pasted.vue');
      await importManifest(manifest);
      if (source === 'degraded') {
        ElMessage.warning('该源码不含物料定义注释块，已降级为空快照物料');
      }
      showPaste.value = false;
      pasteText.value = '';
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '导入失败'));
    }
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (manifest: MaterialManifest, cmd: string) => {
    const base = manifest.type.replace(/^custom-/, '');
    if (cmd === 'vue' || cmd === 'html') {
      const bundle = generateMaterialBundle(manifest);
      downloadText(`${base}.${cmd === 'vue' ? 'vue' : 'html'}`, cmd === 'vue' ? bundle.vue : bundle.html);
    } else {
      downloadText(`${base}.material.json`, JSON.stringify(manifest, null, 2));
    }
  };
  return {
    showPaste,
    pasteText,
    handleFileImport,
    handlePasteImport,
    handleExport
  };
}
