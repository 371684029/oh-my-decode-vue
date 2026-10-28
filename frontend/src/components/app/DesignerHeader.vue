<template>
  <header class="designer-header">
    <div class="logo">
      <el-icon class="logo-icon"><Platform /></el-icon>
      <span class="logo-text">Low-Code Studio</span>
      <el-tag size="small" type="primary" effect="plain" style="margin-left: 10px">v2.3.0</el-tag>
    </div>
    <div class="header-actions">
      <el-button-group class="history-btn-group">
        <el-button
          size="small"
          icon="RefreshLeft"
          :disabled="!designerStore.canUndo"
          title="撤销 (Ctrl+Z)"
          @click="designerStore.undo()"
        >
          撤销
        </el-button>
        <el-button
          size="small"
          icon="RefreshRight"
          :disabled="!designerStore.canRedo"
          title="重做 (Ctrl+Y)"
          @click="designerStore.redo()"
        >
          重做
        </el-button>
      </el-button-group>
      <el-popover placement="bottom-end" :width="320" trigger="click">
        <template #reference>
          <el-button size="small">快捷键</el-button>
        </template>
        <div class="shortcut-popover">
          <p><kbd>右键</kbd> / <kbd>双击</kbd> / <kbd>Enter</kbd> 开属性</p>
          <p><kbd>Ctrl</kbd>+<kbd>C</kbd> 复制 · <kbd>Ctrl</kbd>+<kbd>V</kbd> 粘贴</p>
          <p><kbd>Ctrl</kbd>+<kbd>Z</kbd> 撤销 · <kbd>Ctrl</kbd>+<kbd>Y</kbd> 重做</p>
          <p><kbd>Del</kbd> 删除 · <kbd>↑↓←→</kbd> 微调</p>
        </div>
      </el-popover>
      <el-button size="small" icon="FolderOpened" @click="emit('open-load')">加载配置</el-button>
      <el-button size="small" icon="View" @click="emit('open-logs')">操作审计日志</el-button>
      <el-button size="small" :type="isPreviewMode ? 'info' : 'primary'" icon="VideoPlay" @click="emit('toggle-preview')">
        {{ isPreviewMode ? '退出预览' : '纯预览模式' }}
      </el-button>
      <el-button size="small" icon="Connection" @click="emit('generate-mock-docs')">生成 Mock 与接口文档</el-button>
      <el-button size="small" type="warning" icon="Download" @click="emit('open-export')">导出代码</el-button>
      <el-button size="small" type="success" icon="Select" @click="emit('save')">保存并写入 JSON</el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useDesignerStore } from '../../stores/designerStore';

defineProps<{
  isPreviewMode: boolean;
}>();

const emit = defineEmits<{
  'open-load': [];
  'open-logs': [];
  'toggle-preview': [];
  'generate-mock-docs': [];
  'open-export': [];
  save: [];
}>();

const designerStore = useDesignerStore();
</script>

<style scoped>
.designer-header {
  position: relative;
  z-index: 4000;
  height: 56px;
  min-height: 56px;
  background-color: #1f2d3d;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  padding: 0 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.logo-icon {
  font-size: 24px;
  color: #409eff;
}
.logo-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.history-btn-group {
  margin-right: 4px;
}
.shortcut-popover {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}
.shortcut-popover p {
  margin: 0;
}
.shortcut-popover kbd {
  display: inline-block;
  padding: 0 5px;
  font-size: 11px;
  font-family: ui-monospace, Consolas, monospace;
  line-height: 18px;
  color: #303133;
  background: #f4f4f5;
  border: 1px solid #dcdfe6;
  border-bottom-width: 2px;
  border-radius: 3px;
}
</style>
