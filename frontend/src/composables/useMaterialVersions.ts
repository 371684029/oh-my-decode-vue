/**
 * 物料版本管理逻辑 (v2.8.0 巨型文件拆分)。
 *
 * 从 MaterialManager.vue 抽出：版本列表 / 回滚 / 归档 / 差异 / fork / 批量升级。
 * 这组 handler 只依赖自身 refs 与 http、Element Plus 消息 API，
 * 不访问组件其它状态，因此可以独立成 composable。
 */
import { ref } from 'vue';
import { errorText } from '@lowcode/shared';
import { ElMessage, ElMessageBox } from 'element-plus';
import { http } from '../utils/http';
import type { MaterialManifest } from '../types/designer';

export function useMaterialVersions() {
  const versionTarget = ref<MaterialManifest | null>(null);
  const versionList = ref<Array<{ version: string; publishedAt: string; refCount: number }>>([]);
  const diffResult = ref<null | { base: string; target: string; bump: string; contractDiff: unknown[]; schemaDiff: unknown[] }>(null);
  const upgradeFrom = ref('');
  const upgradeTo = ref('');
  const upgradeReport = ref<Array<{ pageId: string; updated: number; failed?: string }>>([]);

  const loadVersionList = async () => {
    if (!versionTarget.value) return;
    try {
      const resp = await http.get(`/materials/${encodeURIComponent(versionTarget.value.type)}/versions`);
      versionList.value = resp.data?.data || [];
    } catch {
      versionList.value = [];
    }
  };

  const openVersions = async (manifest: MaterialManifest) => {
    versionTarget.value = manifest;
    diffResult.value = null;
    upgradeReport.value = [];
    upgradeFrom.value = '';
    upgradeTo.value = manifest.currentVersion || '';
    await loadVersionList();
  };

  const doRollback = async (version: string) => {
    if (!versionTarget.value) return;
    try {
      await http.post(`/materials/${encodeURIComponent(versionTarget.value.type)}/rollback`, { version });
      ElMessage.success(`已回滚当前版本到 ${version}`);
      await loadVersionList();
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '回滚失败'));
    }
  };

  const doArchive = async (version: string) => {
    if (!versionTarget.value) return;
    try {
      await http.delete(`/materials/${encodeURIComponent(versionTarget.value.type)}/versions/${version}`);
      ElMessage.success(`已归档版本 ${version}`);
      await loadVersionList();
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '归档失败（被引用或为当前版本）'));
    }
  };

  const doDiffPrevious = async (version: string) => {
    if (!versionTarget.value) return;
    const idx = versionList.value.findIndex((v) => v.version === version);
    const base = versionList.value[idx + 1]?.version;
    if (!base) {
      ElMessage.info('没有更早的版本可对比');
      return;
    }
    try {
      const resp = await http.get(
        `/materials/${encodeURIComponent(versionTarget.value.type)}/versions/${version}/diff`,
        { params: { base } }
      );
      diffResult.value = resp.data?.data || null;
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '差异获取失败'));
    }
  };

  const openFork = async () => {
    if (!versionTarget.value) return;
    try {
      const { value } = await ElMessageBox.prompt('新物料名称（派生为 custom-<slug>）', '复制新增 (fork)', {
        inputValue: `${versionTarget.value.label}-副本`
      });
      const label = String(value || '').trim();
      if (!label) return;
      const slug =
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'material';
      await http.post(`/materials/${encodeURIComponent(versionTarget.value.type)}/fork`, {
        fromVersion: versionTarget.value.currentVersion || '1.0.0',
        newType: `custom-${slug}`,
        label,
        icon: versionTarget.value.icon
      });
      ElMessage.success(`已派生新物料 custom-${slug}`);
      versionTarget.value = null;
    } catch (err: unknown) {
      if (err !== 'cancel') ElMessage.error(errorText(err, 'fork 失败'));
    }
  };

  const doUpgrade = async () => {
    if (!versionTarget.value || !upgradeFrom.value || !upgradeTo.value) {
      ElMessage.warning('请选择 from / to 版本');
      return;
    }
    try {
      const resp = await http.post('/pages/upgrade-material', {
        materialId: versionTarget.value.type,
        fromVersion: upgradeFrom.value,
        toVersion: upgradeTo.value
      });
      upgradeReport.value = resp.data?.data || [];
      ElMessage.success('批量升级完成');
    } catch (err: unknown) {
      ElMessage.error(errorText(err, '升级失败'));
    }
  };
  return {
    versionTarget,
    versionList,
    diffResult,
    upgradeFrom,
    upgradeTo,
    upgradeReport,
    openVersions,
    doRollback,
    doArchive,
    doDiffPrevious,
    openFork,
    doUpgrade
  };
}
