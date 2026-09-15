<template>
  <div class="designer-app">
    <!-- Header -->
    <header class="designer-header">
      <div class="logo">
        <el-icon class="logo-icon"><Platform /></el-icon>
        <span class="logo-text">低代码前端可视化平台 (Low-Code Studio)</span>
        <el-tag size="small" type="primary" effect="plain" style="margin-left: 10px">v0.0.1</el-tag>
      </div>
      <div class="header-actions">
        <el-button icon="FolderOpened" @click="handleOpenLoadDialog">加载配置</el-button>
        <el-button icon="View" @click="handleOpenLogsDialog">操作审计日志</el-button>
        <el-button type="success" icon="Select" @click="handleSaveSchema">保存并写入 JSON</el-button>
      </div>
    </header>

    <!-- Main Content Body -->
    <main class="designer-body">
      <!-- Left Material Palette -->
      <MaterialList />

      <!-- Center Main Canvas -->
      <CanvasContainer v-slot="{ node }">
        <template v-if="node">
          <ProTable v-if="node.type === 'pro-table'" :node="node" />
          <ProForm v-else-if="node.type === 'pro-form'" :node="node" />
          <el-button
            v-else-if="node.type === 'el-button'"
            :type="node.props.type || 'primary'"
          >
            {{ node.props.text || '按钮' }}
          </el-button>
          <el-input
            v-else-if="node.type === 'el-input'"
            :placeholder="node.props.placeholder"
            :clearable="node.props.clearable"
          />
        </template>
      </CanvasContainer>

      <!-- Right Property Drawer -->
      <PropertyDrawer />
    </main>

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

    <el-dialog v-model="logsDialogVisible" title="SQLite 操作审计日志" width="700px">
      <el-table :data="logsList" style="width: 100%" max-height="400px">
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column prop="action" label="操作类型" width="140" />
        <el-table-column prop="page_id" label="关联ID" width="140" />
        <el-table-column prop="operator" label="操作人" width="120" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useDesignerStore } from './stores/designerStore';
import MaterialList from './components/MaterialList.vue';
import CanvasContainer from './components/CanvasContainer.vue';
import PropertyDrawer from './components/PropertyDrawer.vue';
import ProTable from './components/ProTable.vue';
import ProForm from './components/ProForm.vue';
import { ElMessage } from 'element-plus';

const API_BASE = 'http://localhost:3001/api';
const designerStore = useDesignerStore();

const loadDialogVisible = ref(false);
const logsDialogVisible = ref(false);
const savedSchemas = ref<any[]>([]);
const logsList = ref<any[]>([]);

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
.designer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>
