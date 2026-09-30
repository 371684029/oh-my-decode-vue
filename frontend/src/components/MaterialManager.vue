<template>
  <el-dialog :model-value="visible" title="物料管理" width="680px" top="8vh" @close="emitClose">
    <div class="mm-toolbar">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".json,.vue,.html,.js"
        :on-change="handleFileImport"
      >
        <el-button type="primary" size="small">导入文件</el-button>
      </el-upload>
      <el-button size="small" @click="showPaste = !showPaste">粘贴源码</el-button>
      <span class="mm-hint">共 {{ items.length }} 个自定义物料</span>
    </div>

    <template v-if="showPaste">
      <el-input v-model="pasteText" type="textarea" :rows="4" placeholder="粘贴 .vue / .html / .json 物料内容..." />
      <div class="mm-paste-actions">
        <el-button size="small" type="primary" @click="handlePasteImport">导入</el-button>
        <el-button size="small" @click="showPaste = false">取消</el-button>
      </div>
    </template>

    <el-table v-if="items.length > 0" :data="items" size="small" class="mm-table">
      <el-table-column label="物料" min-width="190">
        <template #default="{ row }">
          <div class="mm-cell">
            <el-icon class="mm-icon"><component :is="row.icon" /></el-icon>
            <span class="mm-label">{{ row.label }}</span>
            <el-tag size="small" type="info">{{ row.type }}</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="包含组件" width="90">
        <template #default="{ row }">{{ row.summary?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="操作" width="230" align="right">
        <template #default="{ row }">
          <el-dropdown trigger="click" @command="(cmd) => handleExport(asManifest(row), cmd)">
            <el-button size="small" link>
              导出
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="vue">Vue 组件 (.vue)</el-dropdown-item>
                <el-dropdown-item command="html">独立 HTML (.html)</el-dropdown-item>
                <el-dropdown-item command="json">物料定义 (.json)</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" link type="primary" @click="openEdit(asManifest(row))">编辑</el-button>
          <el-button size="small" link type="warning" @click="openVersions(asManifest(row))">版本</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(asManifest(row))">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无自定义物料，请先选中画布组件打包创建" :image-size="60" />

    <el-dialog :model-value="editForm !== null" title="编辑物料" width="420px" append-to-body @close="editForm = null">
      <el-form v-if="editForm" label-width="72px">
        <el-form-item label="名称">
          <el-input v-model="editForm.label" maxlength="50" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="editForm.icon" placeholder="Element Plus 图标名" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.category" style="width: 100%">
            <el-option label="自有高端 (pro)" value="pro" />
            <el-option label="Element (element)" value="element" />
            <el-option label="布局 (layout)" value="layout" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editForm = null">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 版本管理面板（v2.1.0） -->
    <el-dialog :model-value="versionTarget !== null" title="版本管理" width="720px" top="8vh" append-to-body @close="versionTarget = null">
      <template v-if="versionTarget">
        <div class="mm-version-head">
          <span>{{ versionTarget.label }} · {{ versionTarget.type }}</span>
          <el-button size="small" type="primary" link @click="openFork">复制新增 (fork)</el-button>
        </div>

        <el-table :data="versionList" size="small">
          <el-table-column label="版本" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.version === versionTarget.currentVersion" size="small" type="success">{{ row.version }}</el-tag>
              <span v-else>{{ row.version }}</span>
            </template>
          </el-table-column>
          <el-table-column label="发布时间" min-width="150">
            <template #default="{ row }">{{ (row.publishedAt || '').slice(0, 19).replace('T', ' ') }}</template>
          </el-table-column>
          <el-table-column label="引用" width="70">
            <template #default="{ row }">{{ row.refCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="right">
            <template #default="{ row }">
              <el-button size="small" link @click="doDiffPrevious(row.version)">差异</el-button>
              <el-button size="small" link type="primary" :disabled="row.version === versionTarget.currentVersion" @click="doRollback(row.version)">
                回滚
              </el-button>
              <el-button size="small" link type="danger" :disabled="row.version === versionTarget.currentVersion" @click="doArchive(row.version)">
                归档
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="diffResult" class="mm-diff">
          <el-alert
            type="warning"
            show-icon
            :title="`${diffResult.base} → ${diffResult.target}（${diffResult.bump}）`"
            :description="`契约差异 ${diffResult.contractDiff.length} 项，结构差异 ${diffResult.schemaDiff.length} 项`"
            @close="diffResult = null"
          />
        </div>

        <el-divider content-position="left">批量升级实例</el-divider>
        <div class="mm-upgrade">
          <el-select v-model="upgradeFrom" placeholder="从版本" size="small" style="width: 130px">
            <el-option v-for="v in versionList" :key="v.version" :label="v.version" :value="v.version" />
          </el-select>
          <span>→</span>
          <el-select v-model="upgradeTo" placeholder="到版本" size="small" style="width: 130px">
            <el-option v-for="v in versionList" :key="v.version" :label="v.version" :value="v.version" />
          </el-select>
          <el-button size="small" type="primary" @click="doUpgrade">升级全部实例</el-button>
        </div>
        <div v-if="upgradeReport.length > 0" class="mm-report">
          <p v-for="r in upgradeReport" :key="r.pageId">
            {{ r.pageId }}：更新 {{ r.updated }} 个实例<span v-if="r.failed">（失败：{{ r.failed }}）</span>
          </p>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { listCustomMaterials, registerMaterial, unregisterMaterial } from '../registry/materialRegistry';
import { parseMaterialSource } from '../utils/materialImport';
import { generateMaterialBundle } from '../utils/codeGenerator';
import { http } from '../utils/http';
import type { MaterialCategory, MaterialManifest } from '../types/designer';

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const items = computed(() => listCustomMaterials());
/** el-table 行数据实为 MaterialManifest，做窄化转换 */
const asManifest = (row: unknown): MaterialManifest => row as MaterialManifest;
const showPaste = ref(false);
const pasteText = ref('');
const editForm = ref<null | { type: string; label: string; icon: string; category: MaterialCategory }>(null);

const emitClose = () => {
  showPaste.value = false;
  pasteText.value = '';
  emit('close');
};

/** 导入成功后注册 + 持久化 + 刷新 */
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
  } catch (err: any) {
    ElMessage.error(err?.message || '导入失败');
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
  } catch (err: any) {
    ElMessage.error(err?.message || '导入失败');
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

const openEdit = (manifest: MaterialManifest) => {
  editForm.value = {
    type: manifest.type,
    label: manifest.label,
    icon: manifest.icon,
    category: manifest.category
  };
};

// ============================================================
// 版本管理（v2.1.0）
// ============================================================
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
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '回滚失败');
  }
};

const doArchive = async (version: string) => {
  if (!versionTarget.value) return;
  try {
    await http.delete(`/materials/${encodeURIComponent(versionTarget.value.type)}/versions/${version}`);
    ElMessage.success(`已归档版本 ${version}`);
    await loadVersionList();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '归档失败（被引用或为当前版本）');
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
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '差异获取失败');
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
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err?.response?.data?.message || 'fork 失败');
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
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '升级失败');
  }
};

const handleSaveEdit = async () => {
  const form = editForm.value;
  if (!form) return;
  const current = listCustomMaterials().find((m) => m.type === form.type);
  if (!current) return;
  const updated: MaterialManifest = {
    ...current,
    label: form.label.trim() || current.label,
    icon: form.icon || current.icon,
    category: form.category
  };
  const reg = registerMaterial(updated);
  if (!reg.ok) {
    ElMessage.warning(reg.reason);
    return;
  }
  try {
    await http.post('/materials', updated);
    ElMessage.success('物料已更新');
  } catch {
    ElMessage.warning('物料已在本地面板更新，但后端保存失败');
  }
  editForm.value = null;
};

const handleDelete = async (manifest: MaterialManifest) => {
  try {
    await ElMessageBox.confirm(
      `删除物料「${manifest.label}」？已拖入画布的实例不受影响（展开模式实例与定义零引用）。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }

  // 先请求后端；成功后再移除本地，避免"本地已删、后端仍在"的不一致。
  try {
    await http.delete(`/materials/${encodeURIComponent(manifest.type)}`);
  } catch (err: any) {
    const status = err?.response?.status;
    const refs = err?.response?.data?.data?.refs;
    if (status === 409 && refs) {
      // 被引用：展示引用列表，用户确认后强制删除
      try {
        const pageList = (refs.pages || []).map((p: any) => p.title).join('、');
        await ElMessageBox.confirm(
          `该物料被 ${refs.count} 个实例引用（${pageList}）。删除后这些实例将渲染占位。仍要强制删除？`,
          '物料被引用',
          { type: 'warning', confirmButtonText: '强制删除', cancelButtonText: '取消' }
        );
      } catch {
        return;
      }
      try {
        await http.delete(`/materials/${encodeURIComponent(manifest.type)}?force=true`);
      } catch (forceErr: any) {
        ElMessage.error(forceErr?.response?.data?.message || '强制删除失败');
        return;
      }
    } else {
      ElMessage.error(err?.response?.data?.message || '删除失败（后端不可达），物料仍在面板中');
      return;
    }
  }

  unregisterMaterial(manifest.type);
  ElMessage.success('物料已删除');
};
</script>

<style scoped>
.mm-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.mm-hint {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}
.mm-paste-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 8px 0 12px;
}
.mm-table {
  margin-top: 4px;
}
.mm-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mm-icon {
  font-size: 16px;
  color: #e6a23c;
}
.mm-label {
  font-weight: 500;
}
.mm-version-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 500;
}
.mm-diff {
  margin-top: 12px;
}
.mm-upgrade {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mm-report {
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}
.mm-report p {
  margin: 2px 0;
}
</style>
