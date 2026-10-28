<template>
  <template v-if="node">
    <!-- ProTable 特有配置 -->
    <div v-if="node.type === 'pro-table'" class="config-section">
      <div class="section-title">
        <span>表格列配置 (Columns)</span>
        <el-button type="primary" size="small" icon="Plus" link @click="addTableColumn"> 添加列 </el-button>
      </div>
      <div v-for="(col, index) in node.config?.columns" :key="index" class="config-card">
        <el-input v-model="col.label" placeholder="列名" style="margin-bottom: 6px" />
        <el-input v-model="col.prop" placeholder="字段 (prop)" style="margin-bottom: 6px" />
        <div class="card-row">
          <el-input v-model="col.width" placeholder="宽度(px)" style="width: 110px" />
          <el-switch v-model="col.sortable" active-text="排序" />
          <el-button link size="small" :disabled="index === 0" @click="moveTableColumn(Number(index), -1)">上移</el-button>
          <el-button
            link
            size="small"
            :disabled="index === (node.config?.columns?.length ?? 0) - 1"
            @click="moveTableColumn(Number(index), 1)"
          >
            下移
          </el-button>
          <el-button type="danger" icon="Delete" circle size="small" @click="removeTableColumn(Number(index))" />
        </div>
      </div>
    </div>

    <!-- ProForm 特有配置 -->
    <div v-if="node.type === 'pro-form'" class="config-section">
      <div class="section-title">
        <span>表单项配置 (Items)</span>
        <el-button type="primary" size="small" icon="Plus" link @click="addFormItem"> 添加项 </el-button>
      </div>
      <div v-for="(item, index) in node.config?.items" :key="index" class="config-card">
        <el-input v-model="item.label" placeholder="Label" style="margin-bottom: 6px" />
        <el-input v-model="item.field" placeholder="字段名 (field)" style="margin-bottom: 6px" />
        <div class="card-row">
          <el-select
            v-model="item.component"
            placeholder="控件类型"
            style="width: 140px"
            @change="onFormComponentChange(item)"
          >
            <el-option label="输入框" value="input" />
            <el-option label="下拉框" value="select" />
            <el-option label="日期" value="date" />
            <el-option label="开关" value="switch" />
          </el-select>
          <el-switch v-model="item.required" active-text="必填" />
          <el-button link size="small" :disabled="index === 0" @click="moveFormItem(Number(index), -1)">上移</el-button>
          <el-button
            link
            size="small"
            :disabled="index === (node.config?.items?.length ?? 0) - 1"
            @click="moveFormItem(Number(index), 1)"
          >
            下移
          </el-button>
          <el-button type="danger" icon="Delete" circle size="small" @click="removeFormItem(Number(index))" />
        </div>
        <div class="card-row" style="margin-top: 6px">
          <el-input-number v-model="item.span" :min="1" :max="24" placeholder="span" controls-position="right" />
          <el-input v-model="item.width" placeholder="控件宽度 如 100% / 240px" />
        </div>
        <el-input
          v-if="item.component !== 'switch'"
          v-model="item.placeholder"
          placeholder="占位提示"
          style="margin-top: 6px"
        />
        <div v-if="item.component === 'select'" class="select-options">
          <div v-for="(opt, optIndex) in item.options || []" :key="optIndex" class="card-row">
            <el-input v-model="opt.label" placeholder="显示文字" />
            <el-input v-model="opt.value" placeholder="值" />
            <el-button type="danger" icon="Delete" circle size="small" @click="removeFormOption(item, Number(optIndex))" />
          </div>
          <el-button type="primary" size="small" link @click="addFormOption(item)">添加选项</el-button>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { moveListItem } from '../../utils/apiBindingForm';
import { useDrawerNode } from '../../composables/useDrawerNode';

const { node } = useDrawerNode();

const addTableColumn = () => {
  if (node.value && node.value.config) {
    node.value.config.columns.push({
      prop: 'new_field_' + Date.now().toString(36).substring(4),
      label: '新字段列',
      width: '120',
      align: 'left'
    });
  }
};

const removeTableColumn = (index: number) => {
  if (node.value && node.value.config) {
    node.value.config.columns.splice(index, 1);
  }
};

const onFormComponentChange = (item: any) => {
  if (item.component === 'select' && !Array.isArray(item.options)) {
    item.options = [
      { label: '选项一', value: '1' },
      { label: '选项二', value: '2' }
    ];
  }
};

const addFormOption = (item: any) => {
  if (!Array.isArray(item.options)) item.options = [];
  item.options.push({ label: '新选项', value: 'value_' + item.options.length });
};

const removeFormOption = (item: any, index: number) => {
  item.options?.splice(index, 1);
};

const addFormItem = () => {
  if (node.value && node.value.config) {
    node.value.config.items.push({
      field: 'field_' + Date.now().toString(36).substring(4),
      label: '新表单项',
      component: 'input',
      placeholder: '请输入内容',
      span: 12
    });
  }
};

const removeFormItem = (index: number) => {
  if (node.value && node.value.config) {
    node.value.config.items.splice(index, 1);
  }
};

const moveTableColumn = (index: number, delta: number) => {
  if (node.value?.config?.columns) moveListItem(node.value.config.columns, index, delta);
};

const moveFormItem = (index: number, delta: number) => {
  if (node.value?.config?.items) moveListItem(node.value.config.items, index, delta);
};
</script>

<style scoped>
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
  color: #303133;
}
.config-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #fafafa;
}
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
