<template>
  <el-drawer
    v-model="designerStore.isDrawerOpen"
    title="组件配置面板"
    direction="rtl"
    size="420px"
    :before-close="handleClose"
  >
    <template v-if="node">
      <el-tabs v-model="activeTab" class="drawer-tabs">
        <!-- 属性配置 Tab -->
        <el-tab-pane label="属性 Props" name="props">
          <el-form label-position="top" size="small">
            <el-form-item label="组件标识 (ID)">
              <el-input v-model="node.id" disabled />
            </el-form-item>
            <el-form-item label="组件显示名称">
              <el-input v-model="node.label" />
            </el-form-item>

            <!-- ProTable 属性 -->
            <template v-if="node.type === 'pro-table'">
              <el-form-item label="显示边框 (Border)">
                <el-switch v-model="node.props.border" />
              </el-form-item>
              <el-form-item label="斑马纹 (Stripe)">
                <el-switch v-model="node.props.stripe" />
              </el-form-item>
              <el-form-item label="尺寸 (Size)">
                <el-select v-model="node.props.size" style="width: 100%">
                  <el-option label="Large" value="large" />
                  <el-option label="Default" value="default" />
                  <el-option label="Small" value="small" />
                </el-select>
              </el-form-item>
            </template>

            <!-- ProForm 属性 -->
            <template v-if="node.type === 'pro-form'">
              <el-form-item label="Label 宽度">
                <el-input v-model="node.props.labelWidth" />
              </el-form-item>
              <el-form-item label="表单布局方式">
                <el-radio-group v-model="node.props.layout">
                  <el-radio value="horizontal">Horizontal (水平)</el-radio>
                  <el-radio value="inline">Inline (内联)</el-radio>
                </el-radio-group>
              </el-form-item>
            </template>

            <!-- el-button 属性 -->
            <template v-if="node.type === 'el-button'">
              <el-form-item label="按钮文案">
                <el-input v-model="node.props.text" placeholder="支持绑定表达式，如 {{ '提交' }}" />
                <div v-if="node.props.text && node.props.text.includes('{{')" class="expression-preview">
                  <span class="preview-label">表达式实时计算结果：</span>
                  <span class="preview-val">{{ getExpressionPreview(node.props.text) }}</span>
                </div>
              </el-form-item>
              <el-form-item label="按钮类型">
                <el-select v-model="node.props.type" style="width: 100%">
                  <el-option label="Primary" value="primary" />
                  <el-option label="Success" value="success" />
                  <el-option label="Warning" value="warning" />
                  <el-option label="Danger" value="danger" />
                </el-select>
              </el-form-item>
            </template>

            <!-- el-card 属性 -->
            <template v-if="node.type === 'el-card'">
              <el-form-item label="卡片标题">
                <el-input v-model="node.props.header" />
              </el-form-item>
              <el-form-item label="阴影时机">
                <el-select v-model="node.props.shadow" style="width: 100%">
                  <el-option label="Always" value="always" />
                  <el-option label="Hover" value="hover" />
                  <el-option label="Never" value="never" />
                </el-select>
              </el-form-item>
            </template>

            <!-- el-tag 属性 -->
            <template v-if="node.type === 'el-tag'">
              <el-form-item label="标签文案">
                <el-input v-model="node.props.text" />
              </el-form-item>
              <el-form-item label="标签类型">
                <el-select v-model="node.props.type" style="width: 100%">
                  <el-option label="Success" value="success" />
                  <el-option label="Info" value="info" />
                  <el-option label="Warning" value="warning" />
                  <el-option label="Danger" value="danger" />
                </el-select>
              </el-form-item>
            </template>

            <!-- el-alert 属性 -->
            <template v-if="node.type === 'el-alert'">
              <el-form-item label="提示标题">
                <el-input v-model="node.props.title" />
              </el-form-item>
              <el-form-item label="提示类型">
                <el-select v-model="node.props.type" style="width: 100%">
                  <el-option label="Success" value="success" />
                  <el-option label="Info" value="info" />
                  <el-option label="Warning" value="warning" />
                  <el-option label="Error" value="error" />
                </el-select>
              </el-form-item>
            </template>

            <!-- el-divider 属性 -->
            <template v-if="node.type === 'el-divider'">
              <el-form-item label="分割线文案">
                <el-input v-model="node.props.text" />
              </el-form-item>
              <el-form-item label="文案位置">
                <el-select v-model="node.props.contentPosition" style="width: 100%">
                  <el-option label="Left" value="left" />
                  <el-option label="Center" value="center" />
                  <el-option label="Right" value="right" />
                </el-select>
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>

        <!-- 高级配置 Tab (ProTable/ProForm 专属) -->
        <el-tab-pane v-if="node.config" label="高级 Config" name="config">
          <!-- ProTable 特有配置 -->
          <div v-if="node.type === 'pro-table'" class="config-section">
            <div class="section-title">
              <span>表格列配置 (Columns)</span>
              <el-button type="primary" size="small" icon="Plus" link @click="addTableColumn">
                添加列
              </el-button>
            </div>
            <div
              v-for="(col, index) in node.config.columns"
              :key="index"
              class="config-card"
            >
              <el-input v-model="col.label" placeholder="列名" style="margin-bottom: 6px" />
              <el-input v-model="col.prop" placeholder="字段 (prop)" style="margin-bottom: 6px" />
              <div class="card-row">
                <el-input v-model="col.width" placeholder="宽度(px)" style="width: 110px" />
                <el-switch v-model="col.sortable" active-text="排序" />
                <el-button type="danger" icon="Delete" circle size="small" @click="removeTableColumn(Number(index))" />
              </div>
            </div>
          </div>

          <!-- ProForm 特有配置 -->
          <div v-if="node.type === 'pro-form'" class="config-section">
            <div class="section-title">
              <span>表单项配置 (Items)</span>
              <el-button type="primary" size="small" icon="Plus" link @click="addFormItem">
                添加项
              </el-button>
            </div>
            <div
              v-for="(item, index) in node.config.items"
              :key="index"
              class="config-card"
            >
              <el-input v-model="item.label" placeholder="Label" style="margin-bottom: 6px" />
              <el-input v-model="item.field" placeholder="字段名 (field)" style="margin-bottom: 6px" />
              <div class="card-row">
                <el-select v-model="item.component" placeholder="控件类型" style="width: 140px">
                  <el-option label="Input" value="input" />
                  <el-option label="Select" value="select" />
                  <el-option label="Date" value="date" />
                  <el-option label="Switch" value="switch" />
                </el-select>
                <el-switch v-model="item.required" active-text="必填" />
                <el-button type="danger" icon="Delete" circle size="small" @click="removeFormItem(Number(index))" />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- HTML/原生 Attrs Tab -->
        <el-tab-pane label="原生 Attrs" name="attrs">
          <div class="section-title">
            <span>透传 Attrs (Key-Value)</span>
          </div>
          <div v-for="(_val, key) in node.attrs" :key="key" class="card-row" style="margin-bottom: 8px">
            <el-input :model-value="key" disabled style="width: 140px" />
            <el-input v-model="node.attrs[key]" placeholder="Value" />
          </div>
        </el-tab-pane>

        <!-- JSON 实时预览 Tab -->
        <el-tab-pane label="JSON 源码" name="json">
          <SchemaJsonViewer />
        </el-tab-pane>
      </el-tabs>
    </template>
    <div v-else class="no-selection">
      <el-empty description="请在画布中选中要配置的组件" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { parseExpression } from '../utils/expression';
import SchemaJsonViewer from './SchemaJsonViewer.vue';

const designerStore = useDesignerStore();

const getExpressionPreview = (exprStr: string) => {
  try {
    return parseExpression(exprStr, designerStore.pageSchema.state || {});
  } catch (err: any) {
    return '求值出错: ' + err.message;
  }
};
const activeTab = ref('props');

const node = computed(() => designerStore.selectedNode);

const handleClose = () => {
  designerStore.selectNode(null);
};

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

const addFormItem = () => {
  if (node.value && node.value.config) {
    node.value.config.items.push({
      field: 'field_' + Date.now().toString(36).substring(4),
      label: '新表单项',
      component: 'input',
      placeholder: '请输入内容'
    });
  }
};

const removeFormItem = (index: number) => {
  if (node.value && node.value.config) {
    node.value.config.items.splice(index, 1);
  }
};
</script>

<style scoped>
.drawer-tabs {
  height: 100%;
}
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
  gap: 8px;
}
.no-selection {
  padding-top: 40px;
}
.expression-preview {
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #f4f4f5;
  border-radius: 4px;
  font-size: 11px;
  color: #606266;
}
.preview-label {
  color: #909399;
}
.preview-val {
  color: #409eff;
  font-weight: 600;
}
</style>
