<template>
  <div class="pro-form-wrapper">
    <el-form
      :model="formData"
      :label-width="node.props.labelWidth || '100px'"
      :size="node.props.size || 'default'"
      :inline="node.props.layout === 'inline'"
    >
      <el-row :gutter="16">
        <el-col v-for="item in items" :key="item.field" :span="node.props.layout === 'inline' ? undefined : 12">
          <el-form-item :label="item.label" :required="item.required" :error="fieldErrors[item.field]">
            <!-- Input -->
            <el-input
              v-if="item.component === 'input'"
              v-model="formData[item.field]"
              :placeholder="item.placeholder"
            />
            <!-- Select -->
            <el-select
              v-else-if="item.component === 'select'"
              v-model="formData[item.field]"
              :placeholder="item.placeholder"
              style="width: 100%"
            >
              <el-option v-for="opt in item.options || []" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <!-- Date Picker -->
            <el-date-picker
              v-else-if="item.component === 'date'"
              v-model="formData[item.field]"
              type="date"
              :placeholder="item.placeholder"
              style="width: 100%"
            />
            <!-- Switch -->
            <el-switch v-else-if="item.component === 'switch'" v-model="formData[item.field]" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit">提交</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ComponentNode } from '../types/designer';
import { ElMessage } from 'element-plus';
import { ApiExecutor, executeActions, nodeEventBus } from '../utils/dataSource';
import { submitDesignerForm } from '../utils/formValidation';
import { findNode } from '../utils/schemaTree';
import { useDesignerStore } from '../stores/designerStore';

const props = defineProps<{
  node: ComponentNode;
}>();

const formData = ref<Record<string, any>>({});
const fieldErrors = ref<Record<string, string>>({});
const loading = ref(false);

const executor = new ApiExecutor();

const items = computed(() => props.node.config?.items || []);

const handleSubmit = async () => {
  const designerStore = useDesignerStore();
  const result = await submitDesignerForm(props.node.events, items.value, formData.value, {
    notify: (type, message) => ElMessage({ type, message }),
    runActions: (actions) =>
      executeActions(actions, {
        scope: designerStore.pageSchema.state,
        event: formData.value,
        getNode: (id: string) => findNode(designerStore.activeChildren, id) ?? undefined,
        getLayer: (id: string) => designerStore.pageSchema.layers?.find((layer) => layer.id === id),
        reloadNode: (id: string) => nodeEventBus.emitReload(id),
        setLayerVisible: (layerId: string, visible: boolean) => {
          const layer = designerStore.pageSchema.layers?.find((item) => item.id === layerId);
          if (layer) layer.visible = visible;
        },
        notify: (type, message) => ElMessage({ type, message })
      })
  });
  fieldErrors.value = {};
  if (!result.ok) {
    for (const item of result.missing) fieldErrors.value[item.field] = `请填写${item.label}`;
  }
};

const handleReset = () => {
  for (const key of Object.keys(formData.value)) formData.value[key] = undefined;
  fieldErrors.value = {};
};

/** 加载数据：接口返回对象按 field 回填表单；缺省为空表单 */
const loadData = async () => {
  const binding = props.node.apiBinding;
  if (!binding?.url) return;
  try {
    loading.value = true;
    const designerStore = useDesignerStore();
    executor.setScope(designerStore.pageSchema.state);
    const { data } = await executor.fetchData(binding);
    if (data && typeof data === 'object') {
      formData.value = { ...data };
    }
  } catch (err: any) {
    ElMessage.error('表单数据加载失败: ' + (err.message || err));
  } finally {
    loading.value = false;
  }
};

let unsubscribe: (() => void) | undefined;

onMounted(() => {
  const binding = props.node.apiBinding;
  if (binding?.url && binding.autoFetch !== false) {
    loadData();
  }
  unsubscribe = nodeEventBus.onReload(props.node.id, () => loadData());
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<style scoped>
.pro-form-wrapper {
  width: 100%;
}
</style>
