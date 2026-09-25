<template>
  <el-config-provider :locale="elementLocale">
  <div class="designer-app">
    <!-- Header -->
    <header class="designer-header">
      <div class="logo">
        <el-icon class="logo-icon"><Platform /></el-icon>
        <span class="logo-text">低代码前端可视化平台 (Low-Code Studio)</span>
        <el-tag size="small" type="primary" effect="plain" style="margin-left: 10px">v1.12.0</el-tag>
      </div>
      <div class="header-actions">
        <el-button-group class="history-btn-group">
          <el-button
            icon="RefreshLeft"
            :disabled="!designerStore.canUndo"
            title="撤销 (Ctrl+Z)"
            @click="designerStore.undo()"
            >撤销</el-button
          >
          <el-button
            icon="RefreshRight"
            :disabled="!designerStore.canRedo"
            title="重做 (Ctrl+Y)"
            @click="designerStore.redo()"
            >重做</el-button
          >
        </el-button-group>
        <el-button icon="FolderOpened" @click="handleOpenLoadDialog">加载配置</el-button>
        <el-button icon="View" @click="handleOpenLogsDialog">操作审计日志</el-button>
        <el-button :type="isPreviewMode ? 'info' : 'primary'" icon="VideoPlay" @click="isPreviewMode = !isPreviewMode">
          {{ isPreviewMode ? '退出预览' : '纯预览模式' }}
        </el-button>
        <el-button icon="Connection" @click="handleGenerateMockDocs">生成 Mock 与接口文档</el-button>
        <el-button type="warning" icon="Download" @click="exportDialogVisible = true">导出代码</el-button>
        <el-button type="success" icon="Select" @click="handleSaveSchema">保存并写入 JSON</el-button>
      </div>
    </header>

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

    <el-dialog v-model="apiDocVisible" title="前端接口文档" width="720px">
      <pre class="api-doc">{{ apiDocMarkdown }}</pre>
      <template #footer>
        <el-button @click="apiDocVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyApiDoc">复制</el-button>
        <el-button type="success" @click="downloadApiDoc">下载 api.md</el-button>
      </template>
    </el-dialog>

    <!-- Bottom Right Auto-Save Loading Indicator -->
    <div v-if="isAutoSaving" class="auto-save-indicator">
      <el-tag type="warning" effect="dark" class="indicator-tag">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>自动备份保存中...</span>
      </el-tag>
    </div>

    <!-- Dialogs -->
    <el-dialog v-model="loadDialogVisible" title="已保存的 JSON 配置列表" width="720px">
      <el-table :data="savedSchemas" style="width: 100%">
        <el-table-column prop="title" label="页面名称" />
        <el-table-column prop="id" label="页面ID" width="180" />
        <el-table-column label="操作" width="240" align="center">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="handleSelectSchema(scope.row)">载入</el-button>
            <el-button type="warning" size="small" link @click="handleRestoreSchema(scope.row)">恢复上一份</el-button>
            <el-button type="danger" size="small" link @click="handleDeleteSchema(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="logsDialogVisible" title="SQLite 操作审计日志" width="800px">
      <el-table :data="logsList" style="width: 100%" max-height="400px">
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column prop="action" label="操作类型" width="130" />
        <el-table-column prop="page_id" label="关联ID" width="130" />
        <el-table-column prop="operator" label="操作人" width="110" />
        <el-table-column label="改动详情 / Schema Diff" align="center">
          <template #default="scope">
            <el-button type="primary" size="small" plain @click="handleViewLogDiff(scope.row)">
              查看 Details Diff
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Visual Log Details / Diff Dialog -->
    <el-dialog v-model="logDiffDialogVisible" title="操作日志 Schema 细节 & JSON Diff 快照" width="650px">
      <div v-if="selectedLog">
        <el-descriptions border :column="2" style="margin-bottom: 16px">
          <el-descriptions-item label="日志 ID">{{ selectedLog.id }}</el-descriptions-item>
          <el-descriptions-item label="操作类型">{{ selectedLog.action }}</el-descriptions-item>
          <el-descriptions-item label="关联 Page ID">{{ selectedLog.page_id }}</el-descriptions-item>
          <el-descriptions-item label="记录时间">{{ selectedLog.created_at }}</el-descriptions-item>
        </el-descriptions>
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #303133">
          {{ logDetailsTitle }}
        </div>
        <pre class="diff-json-code">{{ formattedLogDetails }}</pre>
      </div>
    </el-dialog>
  </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { http } from './utils/http';
import { useDesignerStore } from './stores/designerStore';
import MaterialList from './components/MaterialList.vue';
import CanvasContainer from './components/CanvasContainer.vue';
import PropertyDrawer from './components/PropertyDrawer.vue';
import NodeRenderer from './components/NodeRenderer.vue';
import CodeExportDialog from './components/CodeExportDialog.vue';
import CustomHtmlLayerNode from './components/CustomHtmlLayerNode.vue';
import { ElConfigProvider, ElMessage, ElMessageBox } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { Loading } from '@element-plus/icons-vue';
import { applyMockBindings, renderApiMarkdown } from './utils/frontendApi';
import { nodeEventBus } from './utils/dataSource';

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
const savedSchemas = ref<any[]>([]);
const logsList = ref<any[]>([]);

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
const selectedLog = ref<any>(null);
const logDetailsTitle = computed(() => {
  try {
    const raw = selectedLog.value?.details;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.initial) return '首次保存';
    if (Array.isArray(parsed?.patch)) return '保存差异 (JSON Patch)';
  } catch {
    /* 旧日志保持原样展示 */
  }
  return '操作详情';
});

const formattedLogDetails = computed(() => {
  if (!selectedLog.value || !selectedLog.value.details) return '{}';
  try {
    const parsed =
      typeof selectedLog.value.details === 'string' ? JSON.parse(selectedLog.value.details) : selectedLog.value.details;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return selectedLog.value.details;
  }
});

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

const copyApiDoc = () => {
  navigator.clipboard.writeText(apiDocMarkdown.value);
  ElMessage.success('接口文档已复制');
};

const downloadApiDoc = () => {
  const blob = new Blob([apiDocMarkdown.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'api.md';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleViewLogDiff = (log: any) => {
  selectedLog.value = log;
  logDiffDialogVisible.value = true;
};

// Silent Anti-Crash Auto Save State
const isAutoSaving = ref(false);
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

const performAutoSave = async () => {
  if (isAutoSaving.value) return;
  isAutoSaving.value = true;
  try {
    await http.post('/schemas', designerStore.pageSchema);
  } catch (err: any) {
    console.error('Auto save failed:', err);
  } finally {
    // Hide loading indicator silently upon completion
    setTimeout(() => {
      isAutoSaving.value = false;
    }, 600);
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  // 如果正在 input / textarea / contenteditable 中打字，则跳过快捷键
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
  ) {
    return;
  }

  // Ctrl + C -> Copy
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    if (designerStore.copySelectedNode()) {
      e.preventDefault();
      ElMessage.success('已复制选中的组件节点');
    }
  }
  // Ctrl + V -> Paste
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (designerStore.pasteNode()) {
      e.preventDefault();
      ElMessage.success('已粘贴组件节点');
    }
  }
  // Delete / Backspace -> Delete Selected Node
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (designerStore.selectedNodeId) {
      e.preventDefault();
      designerStore.removeNode(designerStore.selectedNodeId);
      ElMessage.info('已删除选中节点');
    }
  }
  // Ctrl + Z -> Undo
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (designerStore.canUndo) {
      e.preventDefault();
      designerStore.undo();
      ElMessage.info('已撤销上一步操作');
    }
  }
  // Ctrl + Y or Ctrl + Shift + Z -> Redo
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    if (designerStore.canRedo) {
      e.preventDefault();
      designerStore.redo();
      ElMessage.info('已重做操作');
    }
  }
  // 方向键微调选中组件位置 (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (designerStore.selectedNodeId) {
      e.preventDefault();
      const step = e.shiftKey ? 2 : 1;
      let deltaX = 0;
      let deltaY = 0;
      if (e.key === 'ArrowUp') deltaY = -step;
      else if (e.key === 'ArrowDown') deltaY = step;
      else if (e.key === 'ArrowLeft') deltaX = -step;
      else if (e.key === 'ArrowRight') deltaX = step;

      designerStore.moveSelectedNodeBy(deltaX, deltaY);
    }
  }
};

onMounted(() => {
  // Set 3-minute interval timer (3 * 60 * 1000 ms)
  const AUTO_SAVE_INTERVAL = 3 * 60 * 1000;
  autoSaveTimer = setInterval(() => {
    performAutoSave();
  }, AUTO_SAVE_INTERVAL);

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  window.removeEventListener('keydown', handleKeydown);
});

const handleSaveSchema = async () => {
  try {
    const res = await http.post('/schemas', designerStore.pageSchema);
    if (res.data.success) {
      ElMessage.success('Schema 已成功写入后端 .json 文件并持久化留痕 SQLite！');
    }
  } catch (err: any) {
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message));
  }
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

const handleSelectSchema = async (schema: any) => {
  try {
    const res = await http.get(`/schemas/${schema.id}`, { params: { type: schema.type || 'page' } });
    if (!res.data.success) return;
    designerStore.setPageSchema(res.data.data);
    loadDialogVisible.value = false;
    ElMessage.success(`已成功载入配置: ${res.data.data.title}`);
  } catch (err: any) {
    ElMessage.error('载入失败: ' + (err.response?.data?.message || err.message));
  }
};

const handleDeleteSchema = async (schema: any) => {
  try {
    await ElMessageBox.confirm(`删除页面「${schema.title || schema.id}」？`, '删除已保存页面', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    const res = await http.delete(`/schemas/${schema.id}`, { params: { type: schema.type || 'page' } });
    if (res.data.success) {
      savedSchemas.value = savedSchemas.value.filter((item) => item.id !== schema.id);
      ElMessage.success('已删除');
    }
  } catch (err: any) {
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message));
  }
};

const handleRestoreSchema = async (schema: any) => {
  try {
    const type = schema.type || 'page';
    const listed = await http.get(`/schemas/${schema.id}/backups`, { params: { type } });
    const backups = listed.data.data || [];
    if (!backups.length) {
      ElMessage.warning('还没有可恢复的上一份');
      return;
    }
    const res = await http.post(`/schemas/${schema.id}/restore`, { index: backups[0].index }, { params: { type } });
    if (res.data.success) {
      designerStore.setPageSchema(res.data.data);
      loadDialogVisible.value = false;
      ElMessage.success('已恢复上一份');
    }
  } catch (err: any) {
    ElMessage.error('恢复失败: ' + (err.response?.data?.message || err.message));
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
.designer-header {
  position: relative;
  z-index: 4000;
  min-height: 56px;
  height: auto;
  background-color: #1f2d3d;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon {
  font-size: 24px;
  color: #409eff;
}
.logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.api-doc {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
}
.history-btn-group {
  margin-right: 4px;
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
.diff-json-code {
  background-color: #1e1e1e;
  color: #a9b7c6;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  margin: 0;
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
