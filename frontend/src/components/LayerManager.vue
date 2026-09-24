<template>
  <div class="layer-manager-panel">
    <div class="layer-toolbar">
      <span class="toolbar-title">多图层堆叠管理</span>
      <el-dropdown @command="handleCreateLayer">
        <el-button type="primary" size="small" icon="Plus">
          新建图层 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="dialog">
              <el-icon><Message /></el-icon> 弹窗/对话框图层 (Dialog Layer)
            </el-dropdown-item>
            <el-dropdown-item command="loading">
              <el-icon><Loading /></el-icon> Loading 遮罩图层 (Loading Layer)
            </el-dropdown-item>
            <el-dropdown-item command="custom-html">
              <el-icon><Document /></el-icon> 自定义 HTML & 生命周期图层
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 图层列表 -->
    <div class="layers-list">
      <div
        v-for="layer in designerStore.pageSchema.layers"
        :key="layer.id"
        class="layer-item"
        :class="{ active: designerStore.activeLayerId === layer.id }"
        @click="designerStore.activeLayerId = layer.id"
      >
        <div class="layer-info">
          <el-icon class="layer-icon">
            <Files v-if="layer.type === 'canvas'" />
            <Message v-else-if="layer.type === 'dialog'" />
            <Loading v-else-if="layer.type === 'loading'" />
            <Document v-else />
          </el-icon>
          <span class="layer-name">{{ layer.name }}</span>
          <el-tag size="small" :type="getLayerTagType(layer.type)">
            {{ layer.type }}
          </el-tag>
        </div>

        <div class="layer-actions">
          <el-icon
            class="action-icon"
            :class="{ hidden: !layer.visible }"
            title="显隐切换"
            @click.stop="designerStore.toggleLayerVisible(layer.id)"
          >
            <View v-if="layer.visible" />
            <Hide v-else />
          </el-icon>

          <el-icon
            v-if="layer.type !== 'canvas'"
            class="action-icon delete-icon"
            title="删除图层"
            @click.stop="designerStore.removeLayer(layer.id)"
          >
            <Delete />
          </el-icon>
        </div>
      </div>
    </div>

    <!-- 当前激活图层的生命周期与配置面板 (自定义 HTML / 弹窗 / Loading) -->
    <div v-if="activeLayer && activeLayer.type !== 'canvas'" class="layer-config-box">
      <el-divider content-position="left">
        <span style="font-size: 13px; font-weight: 600; color: #409eff"> 图层配置: {{ activeLayer.name }} </span>
      </el-divider>

      <!-- 自定义 HTML 图层设置与生命周期脚本 -->
      <div v-if="activeLayer.type === 'custom-html'" class="html-lifecycle-editor">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="安全提示"
          description="自定义 HTML 渲染前会经 DOMPurify 消毒（剥离 script / on* 事件）；生命周期脚本将在浏览器本地执行，仅用于设计器内预览，导出代码时会原样嵌入目标代码，请由页面所有者自行评估脚本安全。"
        />
        <el-form label-position="top" size="small">
          <el-form-item label="自定义 HTML 代码">
            <el-input
              v-model="activeLayerProps.htmlCode"
              type="textarea"
              :rows="3"
              placeholder="例如: <div class='card'><h2>Hello</h2></div>"
            />
          </el-form-item>

          <el-form-item label="自定义 CSS 样式">
            <el-input
              v-model="activeLayerProps.cssCode"
              type="textarea"
              :rows="2"
              placeholder="例如: .card { color: red; }"
            />
          </el-form-item>

          <el-form-item label="🚀 onMounted 挂载生命周期脚本 (container, state)">
            <el-input
              v-model="activeLayerProps.scriptMounted"
              type="textarea"
              :rows="3"
              placeholder="// 挂载完成后执行 JS&#10;const title = container.querySelector('h2');&#10;console.log('Mounted:', title);"
            />
          </el-form-item>

          <el-form-item label="🧹 onUnmounted 卸载生命周期脚本 (container, state)">
            <el-input
              v-model="activeLayerProps.scriptUnmounted"
              type="textarea"
              :rows="2"
              placeholder="// 图层卸载销毁时执行 JS&#10;console.log('Unmounted layer');"
            />
          </el-form-item>
        </el-form>
      </div>

      <!-- 弹窗图层配置 -->
      <div v-else-if="activeLayer.type === 'dialog'">
        <el-form label-position="top" size="small">
          <el-form-item label="弹窗标题">
            <el-input v-model="activeLayerProps.title" placeholder="输入弹窗标题" />
          </el-form-item>
          <el-form-item label="弹窗宽度">
            <el-input v-model="activeLayerProps.width" placeholder="例如: 500px 或 50%" />
          </el-form-item>
        </el-form>
      </div>

      <!-- Loading 遮罩配置 -->
      <div v-else-if="activeLayer.type === 'loading'">
        <el-form label-position="top" size="small">
          <el-form-item label="Loading 提示文案">
            <el-input v-model="activeLayerProps.loadingText" placeholder="加载中..." />
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { Files, Message, Loading, Document, ArrowDown, View, Hide, Delete } from '@element-plus/icons-vue';

const designerStore = useDesignerStore();

const activeLayer = computed(() => {
  return designerStore.pageSchema.layers?.find((l) => l.id === designerStore.activeLayerId);
});

// 确保激活图层存在 props 容器（watch 中初始化，避免 computed 副作用）
watch(
  activeLayer,
  (layer) => {
    if (layer && !layer.props) {
      layer.props = {};
    }
  },
  { immediate: true }
);

const activeLayerProps = computed(() => activeLayer.value?.props ?? {});

const getLayerTagType = (type: string) => {
  switch (type) {
    case 'canvas':
      return 'primary';
    case 'dialog':
      return 'warning';
    case 'loading':
      return 'info';
    case 'custom-html':
      return 'success';
    default:
      return 'info';
  }
};

const handleCreateLayer = (type: 'dialog' | 'loading' | 'custom-html') => {
  designerStore.addLayer(type, '');
};
</script>

<style scoped>
.layer-manager-panel {
  padding: 10px;
  background-color: #ffffff;
}
.layer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.layers-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}
.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #fcfcfc;
  cursor: pointer;
  transition: all 0.2s ease;
}
.layer-item:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}
.layer-item.active {
  border-color: #409eff;
  background-color: #e6f1fc;
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.2);
}
.layer-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.layer-icon {
  font-size: 16px;
  color: #409eff;
}
.layer-name {
  font-size: 12px;
  font-weight: 500;
  color: #303133;
}
.layer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.action-icon {
  font-size: 14px;
  color: #606266;
  cursor: pointer;
}
.action-icon.hidden {
  color: #c0c4cc;
}
.delete-icon:hover {
  color: #f56c6c;
}
.layer-config-box {
  margin-top: 10px;
}
.html-lifecycle-editor {
  background-color: #fafafa;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}
</style>
