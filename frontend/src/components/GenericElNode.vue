<template>
  <!-- 通用 Element Plus 物料渲染（v2.2.0 画布覆盖）：任意 el-* 类型落到真实组件，不再显示"未登记渲染器" -->
  <component :is="resolved" v-if="resolved" :id="node.id" v-bind="boundProps" />
  <div v-else :id="node.id" class="generic-el-fallback">
    {{ node.label || node.type }}（暂不支持的 Element 组件）
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import {
  ElAlert,
  ElAutocomplete,
  ElAvatar,
  ElBadge,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElEmpty,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLink,
  ElOption,
  ElOptionGroup,
  ElProgress,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTag,
  ElTimePicker
} from 'element-plus';
import { useDesignerStore } from '../stores/designerStore';
import { parseExpression } from '../utils/expression';
import type { ComponentNode } from '../types/designer';

const props = defineProps<{
  node: ComponentNode;
}>();

const designerStore = useDesignerStore();

/** 通用 el-* 组件映射（静态导入保证运行时可解析；unplugin 只接管静态模板标签） */
const EL_COMPONENTS: Record<string, Component> = {
  'el-alert': ElAlert,
  'el-autocomplete': ElAutocomplete,
  'el-avatar': ElAvatar,
  'el-badge': ElBadge,
  'el-card': ElCard,
  'el-cascader': ElCascader,
  'el-checkbox': ElCheckbox,
  'el-checkbox-group': ElCheckboxGroup,
  'el-col': ElCol,
  'el-date-picker': ElDatePicker,
  'el-descriptions': ElDescriptions,
  'el-descriptions-item': ElDescriptionsItem,
  'el-divider': ElDivider,
  'el-empty': ElEmpty,
  'el-image': ElImage,
  'el-input': ElInput,
  'el-input-number': ElInputNumber,
  'el-link': ElLink,
  'el-option': ElOption,
  'el-option-group': ElOptionGroup,
  'el-progress': ElProgress,
  'el-radio': ElRadio,
  'el-radio-group': ElRadioGroup,
  'el-rate': ElRate,
  'el-select': ElSelect,
  'el-slider': ElSlider,
  'el-switch': ElSwitch,
  'el-tag': ElTag,
  'el-time-picker': ElTimePicker
};

const resolved = computed<Component | null>(() => EL_COMPONENTS[props.node.type] ?? null);

/** props + attrs 合并求值（{{ state.xxx }} → 运行时值），attrs 兜底、props 优先 */
const boundProps = computed<Record<string, unknown>>(() => {
  const scope = designerStore.pageSchema.state;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries({ ...(props.node.attrs || {}), ...(props.node.props || {}) })) {
    out[k] = typeof v === 'string' ? parseExpression(v, scope) : v;
  }
  return out;
});
</script>

<style scoped>
.generic-el-fallback {
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}
</style>
