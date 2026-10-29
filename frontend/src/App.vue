<template>
  <el-config-provider :locale="elementLocale">
  <div class="designer-app">
    <DesignerHeader
      :is-preview-mode="isPreviewMode"
      @open-load="handleOpenLoadDialog"
      @open-logs="handleOpenLogsDialog"
      @toggle-preview="isPreviewMode = !isPreviewMode"
      @generate-mock-docs="handleGenerateMockDocs"
      @open-export="exportDialogVisible = true"
      @save="handleSaveSchema"
    />

    <!-- Main Content Body -->
    <main class="designer-body">
      <!-- Left Material Palette -->
      <MaterialList v-if="!isPreviewMode" />

      <!-- Center Main Canvas -->
      <CanvasContainer v-slot="{ node }" :preview="isPreviewMode">
        <NodeRenderer v-if="node" :node="node" />
      </CanvasContainer>

      <!-- Right Property Drawer -->
      <PropertyDrawer v-if="!isPreviewMode" />
    </main>

    <!-- 多图层系统 (Multi-Layer Overlays) -->
    <!-- 1. 自定义 HTML 动态图层与生命周期组件 -->
    <div v-for="layer in customHtmlLayers" :key="layer.id">
      <div v-if="layer.visible" class="custom-html-floating-layer" :style="{ zIndex: layer.zIndex || 10 }">
        <CustomHtmlLayerNode :layer="layer" />
      </div>
    </div>

    <!-- 2. 弹窗/对话框图层 (Dialog Layers) -->
    <template v-for="layer in dialogLayers" :key="layer.id">
      <el-dialog
        v-model="layer.visible"
        :title="layer.props?.title || '业务弹窗图层'"
        :width="layer.props?.width || '50%'"
        :append-to-body="true"
      >
        <div class="dialog-layer-body">
          <template v-if="layer.children && layer.children.length > 0">
            <NodeRenderer v-for="child in layer.children" :key="child.id" :node="child" />
          </template>
          <p v-else style="color: #606266; font-size: 14px">
            弹窗图层为空，可在「多图层管理」点击编辑图标后向弹窗内拖入组件。
          </p>
        </div>
      </el-dialog>
    </template>

    <!-- 3. Loading 遮罩图层 (Loading Mask Layers) -->
    <template v-for="layer in loadingLayers" :key="layer.id">
      <div v-if="layer.visible" class="global-loading-overlay">
        <div class="loading-box">
          <el-icon class="is-loading loading-icon"><Loading /></el-icon>
          <p>{{ layer.props?.loadingText || '加载中...' }}</p>
          <el-button size="small" type="primary" plain @click="layer.visible = false">隐藏 Loading 图层</el-button>
        </div>
      </div>
    </template>

    <!-- Code Export Dialog -->
    <CodeExportDialog v-model="exportDialogVisible" />

    <ApiDocDialog v-model:visible="apiDocVisible" :markdown="apiDocMarkdown" />

    <!-- Bottom Right Auto-Save Loading Indicator -->
    <div v-if="isAutoSaving" class="auto-save-indicator">
      <el-tag type="warning" effect="dark" class="indicator-tag">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>自动备份保存中...</span>
      </el-tag>
    </div>

    <LoadDialog
      v-model:visible="loadDialogVisible"
      :schemas="savedSchemas"
      @loaded="handleSchemaLoaded"
      @deleted="handleSchemaDeleted"
    />

    <LogsDialog v-model:visible="logsDialogVisible" :logs="logsList" @view-diff="handleViewLogDiff" />

    <LogDiffDialog v-model:visible="logDiffDialogVisible" :log="selectedLog" />
  </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { http } from './utils/http';
import { loadMaterialsFromBackend } from './registry/materialRegistry';
import { useDesignerStore } from './stores/designerStore';
import MaterialList from './components/MaterialList.vue';
import CanvasContainer from './components/CanvasContainer.vue';
import PropertyDrawer from './components/PropertyDrawer.vue';
import NodeRenderer from './components/NodeRenderer.vue';
import CodeExportDialog from './components/CodeExportDialog.vue';
import CustomHtmlLayerNode from './components/CustomHtmlLayerNode.vue';
import DesignerHeader from './components/app/DesignerHeader.vue';
import LoadDialog from './components/app/LoadDialog.vue';
import LogsDialog from './components/app/LogsDialog.vue';
import type { AuditLogRow } from './components/app/LogsDialog.vue';
import LogDiffDialog from './components/app/LogDiffDialog.vue';
import ApiDocDialog from './components/app/ApiDocDialog.vue';
import { ElConfigProvider, ElMessage } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { Loading } from '@element-plus/icons-vue';
import { applyMockBindings, renderApiMarkdown } from './utils/frontendApi';
import { saveSchemaWithFallback } from './utils/schemaSave';
import type { PageSchema } from './types/designer';
import { nodeEventBus } from './utils/dataSource';
import { registerModalClose, registerModalOpen } from './utils/shortcutContext';
import { useDesignerHotkeys } from './composables/useDesignerHotkeys';

const designerStore = useDesignerStore();
const elementLocale = zhCn;

watch(
  () => JSON.stringify(designerStore.pageSchema),
  (next, prev) => {
    if (designerStore.layoutGesture) return;
    if (prev && prev !== next) designerStore.noteSchemaChange(prev);
  },
  { flush: 'sync' }
);

const isPreviewMode = ref(false);
const loadDialogVisible = ref(false);
const logsDialogVisible = ref(false);
const exportDialogVisible = ref(false);
const apiDocVisible = ref(false);
const apiDocMarkdown = ref('');
const savedSchemas = ref<Array<{ id: string; title?: string; type?: string }>>([]);
const logsList = ref<AuditLogRow[]>([]);

const customHtmlLayers = computed(() => {
  return designerStore.pageSchema.layers?.filter((l) => l.type === 'custom-html') || [];
});

const dialogLayers = computed(() => {
  return designerStore.pageSchema.layers?.filter((l) => l.type === 'dialog') || [];
});

const loadingLayers = computed(() => {
  return designerStore.pageSchema.layers?.filter((l) => l.type === 'loading') || [];
});
const logDiffDialogVisible = ref(false);
const selectedLog = ref<AuditLogRow | null>(null);

const handleGenerateMockDocs = () => {
  const draft = JSON.parse(JSON.stringify(designerStore.pageSchema));
  const added = applyMockBindings(draft);
  const markdown = renderApiMarkdown(draft);
  if (added.length === 0 && !markdown.includes('方法：')) {
    ElMessage.info('当前页面没有表格、表单或已绑定的接口');
    return;
  }
  if (added.length > 0) {
    designerStore.recordHistory();
    applyMockBindings(designerStore.pageSchema);
    for (const id of added) nodeEventBus.emitReload(id);
  }
  apiDocMarkdown.value = markdown;
  apiDocVisible.value = true;
};

const handleViewLogDiff = (log: AuditLogRow) => {
  selectedLog.value = log;
  logDiffDialogVisible.value = true;
};

// Silent Anti-Crash Auto Save State
const isAutoSaving = ref(false);
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

// 增量保存基线：上次成功落盘的 Schema 快照（v2.4.0 P1-1 增量自动保存）
const lastSavedSchema = ref<PageSchema | null>(null);

const snapshotSchema = (): PageSchema => JSON.parse(JSON.stringify(designerStore.pageSchema)) as PageSchema;

/**
 * 保存当前页面（v2.4.0 自测修复 #2/#3/#4）：
 * 提交「开始保存时」的快照并以其为增量基线——请求在途期间的编辑不吸收进基线；
 * 无变更跳过；PATCH 携带 baseVersion，版本冲突或失败一次回退全量 POST。
 */
const saveCurrentSchema = async (): Promise<'saved' | 'skip'> => {
  const submitted = snapshotSchema();
  const { mode, baseline } = await saveSchemaWithFallback(submitted, lastSavedSchema.value, {
    post: async (schema) => {
      const res = await http.post('/schemas', schema);
      if (!res.data?.success) throw new Error(res.data?.message || '保存失败');
      return (res.data.data ?? {}) as { version?: string };
    },
    patch: async (id, ops, baseVersion) => {
      const res = await http.patch(`/schemas/${id}`, { ops, baseVersion });
      if (!res.data?.success) throw new Error(res.data?.message || '保存失败');
      return (res.data.data ?? {}) as { version?: string };
    }
  });
  lastSavedSchema.value = baseline;
  return mode === 'skip' ? 'skip' : 'saved';
};

const performAutoSave = async () => {
  if (isAutoSaving.value) return;
  isAutoSaving.value = true;
  try {
    await saveCurrentSchema();
  } catch (err: any) {
    console.error('Auto save failed:', err);
  } finally {
    // Hide loading indicator silently upon completion
    setTimeout(() => {
      isAutoSaving.value = false;
    }, 600);
  }
};

// v2.4.0 P2-1: App 内弹窗(含弹窗图层)开关时同步 activeModalCount,
// 供画布级快捷键门禁使用; 组件内部弹窗(物料管理等)由 keydown 里的 DOM 兜底覆盖
watch(
  () =>
    [
      loadDialogVisible.value,
      logsDialogVisible.value,
      exportDialogVisible.value,
      apiDocVisible.value,
      logDiffDialogVisible.value
    ].filter(Boolean).length + dialogLayers.value.filter((layer) => layer.visible).length,
  (next, prev) => {
    const delta = next - (prev ?? 0);
    for (let i = 0; i < delta; i += 1) {
      registerModalOpen();
    }
    for (let i = 0; i > delta; i -= 1) {
      registerModalClose();
    }
  }
);

useDesignerHotkeys();

onMounted(() => {
  // Set 3-minute interval timer (3 * 60 * 1000 ms)
  const AUTO_SAVE_INTERVAL = 3 * 60 * 1000;
  autoSaveTimer = setInterval(() => {
    performAutoSave();
  }, AUTO_SAVE_INTERVAL);

  // 启动时加载后端已存的自定义物料（后端不可达时静默降级，仅显示内置物料）
  void loadMaterialsFromBackend();
});

onUnmounted(() => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
});

const handleSaveSchema = async () => {
  try {
    const result = await saveCurrentSchema();
    if (result === 'skip') {
      ElMessage.info('无变更，已跳过保存');
    } else {
      ElMessage.success('Schema 已成功写入后端 .json 文件并持久化留痕 SQLite！');
    }
  } catch (err: any) {
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message));
  }
};

/** 载入/恢复成功：更新增量保存基线 */
const handleSchemaLoaded = (schema: PageSchema) => {
  lastSavedSchema.value = JSON.parse(JSON.stringify(schema)) as PageSchema;
};

const handleSchemaDeleted = (id: string) => {
  savedSchemas.value = savedSchemas.value.filter((item) => item.id !== id);
};

const handleOpenLoadDialog = async () => {
  try {
    const res = await http.get('/schemas', { params: { type: 'page' } });
    if (res.data.success) {
      savedSchemas.value = res.data.data;
      loadDialogVisible.value = true;
    }
  } catch (err: any) {
    ElMessage.error('获取列表失败: ' + err.message);
  }
};

const handleOpenLogsDialog = async () => {
  try {
    const res = await http.get('/logs');
    if (res.data.success) {
      logsList.value = res.data.data;
      logsDialogVisible.value = true;
    }
  } catch (err: any) {
    ElMessage.error('获取日志失败: ' + err.message);
  }
};
</script>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
.designer-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.designer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.auto-save-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
.indicator-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 4px;
}
.custom-html-floating-layer {
  position: fixed;
  bottom: 20px;
  left: 300px;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background-color: #ffffff;
}
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  z-index: 3000;
  display: flex;
  justify-content: center;
  align-items: center;
}
.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #409eff;
  font-weight: 600;
}
.loading-icon {
  font-size: 40px;
}
</style>
