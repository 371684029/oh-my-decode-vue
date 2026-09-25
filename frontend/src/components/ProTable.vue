<template>
  <div class="pro-table-wrapper">
    <el-table
      v-loading="loading"
      :data="rows"
      :border="node.props.border"
      :stripe="node.props.stripe"
      :size="node.props.size || 'default'"
      style="width: 100%"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :align="col.align || 'left'"
        :sortable="col.sortable"
      />
      <el-table-column v-if="actions.length > 0" label="操作" align="center" width="160">
        <template #default="scope">
          <el-button
            v-for="action in actions"
            :key="action.eventKey"
            :type="action.type || 'primary'"
            link
            size="small"
            @click="handleAction(action.eventKey, scope.row)"
          >
            {{ action.label }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="pagination.enabled" class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pagination.pageSize || 10"
        layout="total, prev, pager, next"
        :total="totalCount"
        size="small"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ComponentNode } from '../types/designer';
import { ElMessage } from 'element-plus';
import { ApiExecutor, executeActions, nodeEventBus } from '../utils/dataSource';
import { findNode } from '../utils/schemaTree';
import { TABLE_PLACEHOLDER_ROWS } from '../utils/tablePlaceholder';
import { useDesignerStore } from '../stores/designerStore';

const props = defineProps<{
  node: ComponentNode;
}>();

const currentPage = ref(1);
const totalCount = ref<number>(TABLE_PLACEHOLDER_ROWS.length);
const loading = ref(false);

/** 数据行：优先 apiBinding 数据源，缺省为占位 mock */
const rows = ref<any[]>([...TABLE_PLACEHOLDER_ROWS]);

const executor = new ApiExecutor();

const columns = computed(() => props.node.config?.columns || []);
const actions = computed(() => props.node.config?.actions || []);
const pagination = computed(() => props.node.config?.pagination || { enabled: true, pageSize: 10 });

/** 加载数据（供 autoFetch 与动作链 reload 调用） */
const loadData = async () => {
  const binding = props.node.apiBinding;
  if (!binding?.url) {
    rows.value = [...TABLE_PLACEHOLDER_ROWS];
    totalCount.value = TABLE_PLACEHOLDER_ROWS.length;
    return;
  }
  try {
    loading.value = true;
    const designerStore = useDesignerStore();
    executor.setScope(designerStore.pageSchema.state);
    const { data, total } = await executor.fetchData(binding);
    rows.value = Array.isArray(data) ? data : [];
    if (total !== undefined) totalCount.value = Number(total) || 0;
  } catch (err: any) {
    ElMessage.error('数据加载失败: ' + (err.message || err));
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number) => {
  // 分页参数通过 state.page 与表达式绑定联动
  const designerStore = useDesignerStore();
  designerStore.pageSchema.state.page = page;
  loadData();
};

const handleAction = async (key: string, row: any) => {
  const rule = props.node.events?.[key];
  if (rule?.enabled && rule.actions.length > 0) {
    const designerStore = useDesignerStore();
    await executeActions(rule.actions, {
      scope: designerStore.pageSchema.state,
      event: { row, eventKey: key },
      getNode: (id: string) => findNode(designerStore.activeChildren, id) ?? undefined,
      getLayer: (id: string) => designerStore.pageSchema.layers?.find((layer) => layer.id === id),
      reloadNode: (id: string) => nodeEventBus.emitReload(id),
      setLayerVisible: (layerId: string, visible: boolean) => {
        const layer = designerStore.pageSchema.layers?.find((item) => item.id === layerId);
        if (layer) layer.visible = visible;
      },
      notify: (type, message) => ElMessage({ type, message })
    });
    return;
  }
  ElMessage.info(`触发按钮 [${key}], 选中行: ${row.name}`);
};

let unsubscribe: (() => void) | undefined;

onMounted(() => {
  const binding = props.node.apiBinding;
  if (!binding?.url || binding.autoFetch !== false) {
    loadData();
  }
  // 订阅动作链 reload
  unsubscribe = nodeEventBus.onReload(props.node.id, () => loadData());
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<style scoped>
.pro-table-wrapper {
  width: 100%;
}
.pagination-bar {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
