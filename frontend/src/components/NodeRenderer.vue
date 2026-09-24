<template>
  <!-- eslint-disable vue/no-mutating-props -- 设计器场景 node 为响应式 store 节点，el-switch 需双向绑定 props -->
  <ErrorBoundary>
    <!-- 自有高端组件 -->
    <ProTable v-if="node.type === 'pro-table'" :node="node" />
    <ProForm v-else-if="node.type === 'pro-form'" :node="node" />

    <el-card v-else-if="node.type === 'pro-container'" class="pro-container-box">
      <template #header>
        <div class="card-header">
          <span style="font-weight: 600">{{ np(node).title || '嵌套弹性容器' }}</span>
          <el-tag size="small" type="info">Flex {{ np(node).direction || 'row' }}</el-tag>
        </div>
      </template>
      <div
        class="container-inner"
        :style="{
          display: 'flex',
          flexDirection: np(node).direction || 'row',
          gap: '12px',
          padding: np(node).padding || '12px'
        }"
      >
        <template v-if="node.children && node.children.length > 0">
          <NodeRenderer v-for="child in node.children" :key="child.id" :node="child" />
        </template>
        <p v-else style="color: #909399; font-size: 13px; margin: 0">弹性嵌套容器：可拖入子组件</p>
      </div>
    </el-card>

    <!-- Element Plus 原生组件 -->
    <el-button
      v-else-if="node.type === 'el-button'"
      :type="np(node).type || 'primary'"
      :size="np(node).size || 'default'"
      @click="triggerNodeEvent(node, 'click', $event)"
    >
      {{ np(node).text || '按钮' }}
    </el-button>

    <el-input
      v-else-if="node.type === 'el-input'"
      :placeholder="np(node).placeholder"
      :clearable="np(node).clearable"
      @change="triggerNodeEvent(node, 'change', $event)"
    />

    <el-card
      v-else-if="node.type === 'el-card'"
      :header="np(node).header"
      :shadow="np(node).shadow || 'always'"
      style="width: 100%"
    >
      <p style="color: #606266; font-size: 14px">这是 Element Plus Card 内容卡片区域</p>
    </el-card>

    <el-tag v-else-if="node.type === 'el-tag'" :type="np(node).type || 'success'" :effect="np(node).effect || 'light'">
      {{ np(node).text || '标签' }}
    </el-tag>

    <el-alert
      v-else-if="node.type === 'el-alert'"
      :title="np(node).title"
      :type="np(node).type || 'info'"
      :show-icon="np(node).showIcon"
      :closable="np(node).closable"
      style="width: 100%"
    />

    <el-switch
      v-else-if="node.type === 'el-switch'"
      v-model="node.props.value"
      :active-text="np(node).activeText"
      :inactive-text="np(node).inactiveText"
      @change="triggerNodeEvent(node, 'change', $event)"
    />

    <el-divider v-else-if="node.type === 'el-divider'" :content-position="np(node).contentPosition || 'center'">
      {{ np(node).text }}
    </el-divider>

    <!-- 未知类型兜底 -->
    <div v-else :id="node.id" style="padding: 8px; border: 1px dashed #dcdfe6; border-radius: 4px">
      {{ node.label }}
    </div>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { parseExpression } from '../utils/expression';
import { executeActions, nodeEventBus } from '../utils/dataSource';
import { useDesignerStore } from '../stores/designerStore';
import type { ComponentNode } from '../types/designer';
import ProTable from './ProTable.vue';
import ProForm from './ProForm.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import { ElMessage } from 'element-plus';

defineProps<{
  node: ComponentNode;
}>();

const designerStore = useDesignerStore();

/** 节点 props 表达式真实求值（{{ state.xxx }} → 运行时值） */
const np = (n: ComponentNode): Record<string, any> => {
  const scope = designerStore.pageSchema.state;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(n.props || {})) {
    out[k] = typeof v === 'string' ? parseExpression(v, scope) : v;
  }
  return out;
};

/** 触发节点事件动作链（目标节点查找基于当前编辑上下文） */
const triggerNodeEvent = async (node: ComponentNode, eventName: string, event: any) => {
  const rule = node.events?.[eventName];
  if (!rule?.enabled || rule.actions.length === 0) return;
  await executeActions(rule.actions, {
    scope: designerStore.pageSchema.state,
    event,
    getNode: (id: string) => designerStore.activeChildren.find((n) => n.id === id),
    getLayer: (id: string) => designerStore.pageSchema.layers?.find((l) => l.id === id),
    reloadNode: (id: string) => nodeEventBus.emitReload(id),
    setLayerVisible: (layerId: string, visible: boolean) => {
      const layer = designerStore.pageSchema.layers?.find((l) => l.id === layerId);
      if (layer) layer.visible = visible;
    },
    notify: (type, message) => ElMessage({ type, message })
  });
};
</script>

<style scoped>
.pro-container-box {
  width: 100%;
}
.container-inner {
  min-height: 40px;
  flex-wrap: wrap;
}
</style>
