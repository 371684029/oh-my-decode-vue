<template>
  <div class="pro-form-wrapper">
    <el-form
      :model="formData"
      :label-width="node.props.labelWidth || '100px'"
      :size="node.props.size || 'default'"
      :inline="node.props.layout === 'inline'"
    >
      <el-row :gutter="16">
        <el-col
          v-for="item in items"
          :key="item.field"
          :span="node.props.layout === 'inline' ? undefined : 12"
        >
          <el-form-item :label="item.label" :required="item.required">
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
              <el-option
                v-for="opt in item.options || []"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
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
            <el-switch
              v-else-if="item.component === 'switch'"
              v-model="formData[item.field]"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ComponentNode } from '../types/designer';

const props = defineProps<{
  node: ComponentNode;
}>();

const formData = ref<Record<string, any>>({});

const items = computed(() => props.node.config?.items || []);
</script>

<style scoped>
.pro-form-wrapper {
  width: 100%;
}
</style>
