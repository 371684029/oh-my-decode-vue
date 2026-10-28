<template>
  <aside v-show="designerStore.isDrawerOpen" class="inspector-pane">
    <header class="inspector-header">
      <span class="inspector-title">组件配置</span>
      <el-button text type="info" size="small" @click="handleClose">关闭</el-button>
    </header>
    <div class="inspector-body">
    <template v-if="node">
      <el-tabs v-model="activeTab" class="drawer-tabs">
        <!-- 属性配置 Tab -->
        <el-tab-pane label="属性 Props" name="props">
          <DrawerPropsTab />
        </el-tab-pane>

        <!-- 高级配置 Tab (ProTable/ProForm 专属) -->
        <el-tab-pane v-if="node.config" label="高级 Config" name="config">
          <DrawerConfigTab />
        </el-tab-pane>

        <!-- 事件动作链 Tab (v1.3.0 L3) -->
        <el-tab-pane label="事件" name="events">
          <DrawerEventsTab />
        </el-tab-pane>

        <!-- 黑盒物料 Tab (v2.1.0) -->
        <el-tab-pane v-if="node.materialRef" label="物料" name="material">
          <DrawerMaterialTab />
        </el-tab-pane>

        <el-tab-pane label="JSON 源码" name="json">
          <SchemaJsonViewer />
        </el-tab-pane>

        <!-- 数据源置末（v2.3.0） -->
        <el-tab-pane label="数据源" name="api">
          <DrawerDataSourceTab />
        </el-tab-pane>
      </el-tabs>
    </template>
    <div v-else class="no-selection">
      <el-empty description="请在画布中选中要配置的组件" />
    </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import SchemaJsonViewer from './SchemaJsonViewer.vue';
import DrawerPropsTab from './drawer/DrawerPropsTab.vue';
import DrawerConfigTab from './drawer/DrawerConfigTab.vue';
import DrawerEventsTab from './drawer/DrawerEventsTab.vue';
import DrawerMaterialTab from './drawer/DrawerMaterialTab.vue';
import DrawerDataSourceTab from './drawer/DrawerDataSourceTab.vue';

const designerStore = useDesignerStore();

const activeTab = ref('props');

const node = computed(() => designerStore.selectedNode);

const handleClose = () => {
  designerStore.closeInspector();
};
</script>

<style scoped>
.inspector-pane {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  height: 100%;
  overflow: hidden;
}
.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.inspector-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}
.inspector-body {
  flex: 1;
  overflow: auto;
  padding: 8px 12px 16px;
}
.drawer-tabs {
  height: 100%;
}
.no-selection {
  padding-top: 40px;
}
</style>

<style>
.property-drawer.el-drawer {
  top: 72px;
  height: calc(100vh - 72px);
}
</style>
