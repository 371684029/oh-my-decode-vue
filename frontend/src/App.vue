<template>
  <div class="designer-app">
    <!-- Header -->
    <header class="designer-header">
      <div class="logo">
        <el-icon class="logo-icon"><Platform /></el-icon>
        <span class="logo-text">低代码前端可视化平台 (Low-Code Studio)</span>
        <el-tag size="small" type="primary" effect="plain" style="margin-left: 10px">v0.3.0</el-tag>
      </div>
      <div class="header-actions">
        <el-button-group class="history-btn-group">
          <el-button icon="RefreshLeft" :disabled="!designerStore.canUndo" @click="designerStore.undo()" title="撤销 (Ctrl+Z)">撤销</el-button>
          <el-button icon="RefreshRight" :disabled="!designerStore.canRedo" @click="designerStore.redo()" title="重做 (Ctrl+Y)">重做</el-button>
        </el-button-group>
        <el-button icon="FolderOpened" @click="handleOpenLoadDialog">加载配置</el-button>
        <el-button icon="View" @click="handleOpenLogsDialog">操作审计日志</el-button>
        <el-button :type="isPreviewMode ? 'info' : 'primary'" icon="VideoPlay" @click="isPreviewMode = !isPreviewMode">
          {{ isPreviewMode ? '退出预览' : '纯预览模式' }}
        </el-button>
        <el-button type="warning" icon="Download" @click="exportDialogVisible = true">导出代码</el-button>
        <el-button type="success" icon="Select" @click="handleSaveSchema">保存并写入 JSON</el-button>
      </div>
    </header>

    <!-- Main Content Body -->
    <main class="designer-body">
      <!-- Left Material Palette -->
      <MaterialList v-if="!isPreviewMode" />

      <!-- Center Main Canvas -->
      <CanvasContainer v-slot="{ node }">
        <ErrorBoundary v-if="node">
          <!-- 自有高端组件 -->
          <ProTable v-if="node.type === 'pro-table'" :node="node" />
          <ProForm v-else-if="node.type === 'pro-form'" :node="node" />

          <el-card v-else-if="node.type === 'pro-container'" class="pro-container-box">
            <template #header>
              <div class="card-header">
                <span style="font-weight: 600">{{ node.props.title || '嵌套弹性容器' }}</span>
                <el-tag size="small" type="info">Flex {{ node.props.direction || 'row' }}</el-tag>
              </div>
            </template>
            <div
              class="container-inner"
              :style="{ display: 'flex', flexDirection: node.props.direction || 'row', gap: '12px', padding: node.props.padding || '12px' }"
            >
              <p style="color: #909399; font-size: 13px; margin: 0">弹性嵌套容器 Slot 占位区域</p>
            </div>
          </el-card>

          <!-- Element Plus 原生组件 -->
          <el-button
            v-else-if="node.type === 'el-button'"
            :type="node.props.type || 'primary'"
            :size="node.props.size || 'default'"
          >
            {{ node.props.text || '按钮' }}
          </el-button>

          <el-input
            v-else-if="node.type === 'el-input'"
            :placeholder="node.props.placeholder"
            :clearable="node.props.clearable"
          />

          <el-card
            v-else-if="node.type === 'el-card'"
            :header="node.props.header"
            :shadow="node.props.shadow || 'always'"
            style="width: 100%"
          >
            <p style="color: #606266; font-size: 14px">这是 Element Plus Card 内容卡片区域</p>
          </el-card>

          <el-tag
            v-else-if="node.type === 'el-tag'"
            :type="node.props.type || 'success'"
            :effect="node.props.effect || 'light'"
          >
            {{ node.props.text || '标签' }}
          </el-tag>

          <el-alert
            v-else-if="node.type === 'el-alert'"
            :title="node.props.title"
            :type="node.props.type || 'info'"
            :show-icon="node.props.showIcon"
            :closable="node.props.closable"
            style="width: 100%"
          />

          <el-switch
            v-else-if="node.type === 'el-switch'"
            v-model="node.props.value"
            :active-text="node.props.activeText"
            :inactive-text="node.props.inactiveText"
          />

          <el-divider
            v-else-if="node.type === 'el-divider'"
            :content-position="node.props.contentPosition || 'center'"
          >
            {{ node.props.text }}
          </el-divider>
        </ErrorBoundary>
      </CanvasContainer>

      <!-- Right Property Drawer -->
      <PropertyDrawer v-if="!isPreviewMode" />
    </main>

    <!-- Code Export Dialog -->
    <CodeExportDialog v-model="exportDialogVisible" />

    <!-- Bottom Right Auto-Save Loading Indicator -->
    <div v-if="isAutoSaving" class="auto-save-indicator">
      <el-tag type="warning" effect="dark" class="indicator-tag">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>自动备份保存中...</span>
      </el-tag>
    </div>

    <!-- Dialogs -->
    <el-dialog v-model="loadDialogVisible" title="已保存的 JSON 配置列表" width="600px">
      <el-table :data="savedSchemas" style="width: 100%">
        <el-table-column prop="title" label="页面名称" />
        <el-table-column prop="id" label="页面ID" width="180" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="handleSelectSchema(scope.row)">
              载入
            </el-button>
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
          JSON 结构化快照 Diff 细节：
        </div>
        <pre class="diff-json-code">{{ formattedLogDetails }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { useDesignerStore } from './stores/designerStore';
import MaterialList from './components/MaterialList.vue';
import CanvasContainer from './components/CanvasContainer.vue';
import PropertyDrawer from './components/PropertyDrawer.vue';
import ProTable from './components/ProTable.vue';
import ProForm from './components/ProForm.vue';
import CodeExportDialog from './components/CodeExportDialog.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';

const API_BASE = 'http://localhost:3001/api';
const designerStore = useDesignerStore();

const isPreviewMode = ref(false);
const loadDialogVisible = ref(false);
const logsDialogVisible = ref(false);
const exportDialogVisible = ref(false);
const savedSchemas = ref<any[]>([]);
const logsList = ref<any[]>([]);
const logDiffDialogVisible = ref(false);
const selectedLog = ref<any>(null);
const formattedLogDetails = computed(() => {
  if (!selectedLog.value || !selectedLog.value.details) return '{}';
  try {
    const parsed = typeof selectedLog.value.details === 'string' ? JSON.parse(selectedLog.value.details) : selectedLog.value.details;
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return selectedLog.value.details;
  }
});

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
    await axios.post(`${API_BASE}/schemas`, designerStore.pageSchema);
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
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
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
    const res = await axios.post(`${API_BASE}/schemas`, designerStore.pageSchema);
    if (res.data.success) {
      ElMessage.success('Schema 已成功写入后端 .json 文件并持久化留痕 SQLite！');
    }
  } catch (err: any) {
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message));
  }
};

const handleOpenLoadDialog = async () => {
  try {
    const res = await axios.get(`${API_BASE}/schemas?type=page`);
    if (res.data.success) {
      savedSchemas.value = res.data.data;
      loadDialogVisible.value = true;
    }
  } catch (err: any) {
    ElMessage.error('获取列表失败: ' + err.message);
  }
};

const handleSelectSchema = (schema: any) => {
  designerStore.setPageSchema(schema);
  loadDialogVisible.value = false;
  ElMessage.success(`已成功载入配置: ${schema.title}`);
};

const handleOpenLogsDialog = async () => {
  try {
    const res = await axios.get(`${API_BASE}/logs`);
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
html, body, #app {
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
  height: 56px;
  background-color: #1f2d3d;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
  gap: 10px;
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
</style>
