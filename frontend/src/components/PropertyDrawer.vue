<template>
  <el-drawer
    v-model="designerStore.isDrawerOpen"
    class="property-drawer"
    title="组件配置面板"
    direction="rtl"
    size="420px"
    :modal="false"
    :before-close="handleClose"
  >
    <template v-if="node">
      <el-tabs v-model="activeTab" class="drawer-tabs">
        <!-- 属性配置 Tab -->
        <el-tab-pane label="属性 Props" name="props">
          <el-alert
            v-if="missingFields.length > 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 12px"
            :title="`剩余 ${missingFields.length} 项必填参数未配置`"
            :description="missingFields.map((field) => field.label).join('、')"
          />
          <el-form label-position="top" size="small">
            <el-form-item label="组件标识 (ID)">
              <el-input v-model="node.id" disabled />
            </el-form-item>
            <el-form-item label="组件显示名称">
              <el-input v-model="node.label" />
            </el-form-item>
            <el-form-item label="显隐条件">
              <el-input v-model="node.visibleWhen" placeholder="留空始终显示，例如 {{ state.show === true }}" />
              <p v-if="visibleWhenWarning" class="field-warning">{{ visibleWhenWarning }}</p>
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
                  <el-option label="大" value="large" />
                  <el-option label="默认" value="default" />
                  <el-option label="小" value="small" />
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
                  <el-radio value="horizontal">水平</el-radio>
                  <el-radio value="inline">内联</el-radio>
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
                  <el-option label="主要" value="primary" />
                  <el-option label="成功" value="success" />
                  <el-option label="警告" value="warning" />
                  <el-option label="危险" value="danger" />
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
                  <el-option label="总是" value="always" />
                  <el-option label="悬停" value="hover" />
                  <el-option label="从不" value="never" />
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
                  <el-option label="成功" value="success" />
                  <el-option label="信息" value="info" />
                  <el-option label="警告" value="warning" />
                  <el-option label="危险" value="danger" />
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
                  <el-option label="成功" value="success" />
                  <el-option label="信息" value="info" />
                  <el-option label="警告" value="warning" />
                  <el-option label="错误" value="error" />
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
                  <el-option label="靠左" value="left" />
                  <el-option label="居中" value="center" />
                  <el-option label="靠右" value="right" />
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
              <el-button type="primary" size="small" icon="Plus" link @click="addTableColumn"> 添加列 </el-button>
            </div>
            <div v-for="(col, index) in node.config.columns" :key="index" class="config-card">
              <el-input v-model="col.label" placeholder="列名" style="margin-bottom: 6px" />
              <el-input v-model="col.prop" placeholder="字段 (prop)" style="margin-bottom: 6px" />
              <div class="card-row">
                <el-input v-model="col.width" placeholder="宽度(px)" style="width: 110px" />
                <el-switch v-model="col.sortable" active-text="排序" />
                <el-button link size="small" :disabled="index === 0" @click="moveTableColumn(Number(index), -1)">上移</el-button>
                <el-button
                  link
                  size="small"
                  :disabled="index === node.config.columns.length - 1"
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
            <div v-for="(item, index) in node.config.items" :key="index" class="config-card">
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
                  :disabled="index === node.config.items.length - 1"
                  @click="moveFormItem(Number(index), 1)"
                >
                  下移
                </el-button>
                <el-button type="danger" icon="Delete" circle size="small" @click="removeFormItem(Number(index))" />
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
                  <el-button
                    type="danger"
                    icon="Delete"
                    circle
                    size="small"
                    @click="removeFormOption(item, Number(optIndex))"
                  />
                </div>
                <el-button type="primary" size="small" link @click="addFormOption(item)">添加选项</el-button>
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

        <!-- 数据源绑定 Tab (v1.3.0 L2) -->
        <el-tab-pane label="数据源" name="api">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 12px"
            title="接口数据源绑定"
            description="配置后组件从接口取数；URL/参数支持 {{ state.xxx }} 表达式。清空 URL 即恢复占位数据。"
          />
          <el-form label-position="top" size="small">
            <el-form-item label="接口 URL">
              <el-input v-model="apiForm.url" placeholder="/api/users 或 https://example.com/users" />
            </el-form-item>
            <el-form-item label="请求方法">
              <el-radio-group v-model="apiForm.method">
                <el-radio value="GET">GET</el-radio>
                <el-radio value="POST">POST</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="请求参数 (JSON，值支持 {{ state.xxx }})" :error="paramsError ? '参数不是合法的 JSON 对象，已保留上次的参数' : ''">
              <el-input
                v-model="apiForm.paramsText"
                type="textarea"
                :rows="4"
                placeholder='{"page": "{{ state.page }}", "size": 10}'
              />
            </el-form-item>
            <el-form-item label="响应数据路径">
              <el-input v-model="apiForm.responsePath" placeholder="data.list" />
            </el-form-item>
            <el-form-item label="分页总数路径">
              <el-input v-model="apiForm.totalProp" placeholder="data.total" />
            </el-form-item>
            <el-form-item label="挂载时自动请求">
              <el-switch v-model="apiForm.autoFetch" />
            </el-form-item>
            <div class="card-row">
              <el-button type="primary" size="small" icon="Refresh" @click="handleTestRequest">试请求并预览</el-button>
              <el-button v-if="hasApiBinding" type="warning" size="small" icon="Delete" @click="clearApiBinding"
                >清除数据源</el-button
              >
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 事件动作链 Tab (v1.3.0 L3) -->
        <el-tab-pane label="事件" name="events">
          <div class="section-title">
            <span>{{ eventName }} 事件动作链</span>
            <el-button type="primary" size="small" icon="Plus" link @click="addAction">添加动作</el-button>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 12px"
            title="动作链说明"
            description="按序执行：刷新数据/打开弹窗需填写目标节点或图层 id；消息提示在 payload 中配置 messageText。"
          />
          <div v-for="(action, index) in clickActions" :key="action.id" class="config-card">
            <div class="card-row">
              <el-select v-model="action.type" style="width: 150px">
                <el-option v-for="t in actionTypes" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
              <el-button type="danger" icon="Delete" circle size="small" @click="removeAction(index)" />
            </div>
            <el-select
              v-model="action.target"
              filterable
              clearable
              placeholder="选择目标组件或图层"
              style="width: 100%; margin-top: 6px"
            >
              <el-option-group label="组件">
                <el-option
                  v-for="item in targetNodes"
                  :key="item.id"
                  :label="`${item.label} (${item.id})`"
                  :value="item.id"
                />
              </el-option-group>
              <el-option-group label="图层">
                <el-option
                  v-for="layer in designerStore.pageSchema.layers || []"
                  :key="layer.id"
                  :label="`${layer.name} (${layer.id})`"
                  :value="layer.id"
                />
              </el-option-group>
            </el-select>
            <el-input
              v-model="action.when"
              placeholder="条件，如 {{ state.ok === true }}，留空则始终执行"
              style="margin-top: 6px"
            />
            <p v-if="action.when && !whenIsSafe(action.when)" class="field-warning">
              该条件无法安全求值，此动作会被跳过
            </p>
            <el-input
              v-model="action.payloadText"
              type="textarea"
              :rows="2"
              placeholder='payload JSON，如 {"messageText": "已保存"} / {"visible": true}'
              style="margin-top: 6px"
            />
          </div>
          <el-empty v-if="clickActions.length === 0" description="暂未配置 click 动作链" :image-size="60" />
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
import { ref, computed, watch } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { parseExpression } from '../utils/expression';
import { ApiExecutor, nodeEventBus } from '../utils/dataSource';
import type { ActionType, ComponentNode } from '../types/designer';
import SchemaJsonViewer from './SchemaJsonViewer.vue';
import { missingRequiredFields } from '../registry/materialContract';
import { inlineableExpression } from '../utils/condition';
import { mergeApiBinding, moveListItem } from '../utils/apiBindingForm';
import { ElMessage } from 'element-plus';

const designerStore = useDesignerStore();

const flattenNodes = (nodes: ComponentNode[] | undefined, acc: Array<{ id: string; label: string }> = []) => {
  for (const item of nodes || []) {
    acc.push({ id: item.id, label: item.label || item.type });
    flattenNodes(item.children, acc);
  }
  return acc;
};

const targetNodes = computed(() => flattenNodes(designerStore.activeChildren));

const getExpressionPreview = (exprStr: string) => {
  try {
    return parseExpression(exprStr, designerStore.pageSchema.state || {});
  } catch (err: any) {
    return '求值出错: ' + err.message;
  }
};
const activeTab = ref('props');

const node = computed(() => designerStore.selectedNode);
const missingFields = computed(() => (node.value ? missingRequiredFields(node.value) : []));

const handleClose = () => {
  designerStore.selectNode(null);
};

// ---------------------------------------------------------------------------
// 数据源 Tab (L2)
// ---------------------------------------------------------------------------

interface ApiFormState {
  url: string;
  method: 'GET' | 'POST';
  paramsText: string;
  responsePath: string;
  totalProp: string;
  autoFetch: boolean;
}

const apiForm = ref<ApiFormState>({
  url: '',
  method: 'GET',
  paramsText: '{}',
  responsePath: '',
  totalProp: '',
  autoFetch: true
});
const paramsError = ref(false);

const hasApiBinding = computed(() => !!node.value?.apiBinding?.url);

watch(
  () => ({ id: node.value?.id, binding: node.value?.apiBinding }),
  (next, prev) => {
    if (!node.value) return;
    const bindingUrl = next.binding?.url ?? '';
    const sameNode = !!prev && next.id === prev.id;
    if (sameNode && apiForm.value.url.trim() === bindingUrl) return;
    paramsError.value = false;
    const binding = next.binding;
    apiForm.value = {
      url: binding?.url ?? '',
      method: binding?.method ?? 'GET',
      paramsText: binding?.params ? JSON.stringify(binding.params, null, 2) : '{}',
      responsePath: binding?.responsePath ?? '',
      totalProp: binding?.totalProp ?? '',
      autoFetch: binding?.autoFetch ?? true
    };
  },
  { immediate: true }
);

/** 表单状态 → node.apiBinding 同步 */
const syncApiBinding = () => {
  if (!node.value) return;
  const { binding, paramsError: invalid } = mergeApiBinding(node.value.apiBinding, apiForm.value);
  paramsError.value = invalid;
  if (JSON.stringify(node.value.apiBinding ?? null) === JSON.stringify(binding ?? null)) return;
  node.value.apiBinding = binding;
};

watch(apiForm, syncApiBinding, { deep: true });

const handleTestRequest = async () => {
  syncApiBinding();
  const binding = node.value?.apiBinding;
  if (!binding?.url) {
    ElMessage.warning('请先配置接口 URL');
    return;
  }
  try {
    const executor = new ApiExecutor(designerStore.pageSchema.state);
    const { data } = await executor.fetchData(binding);
    const count = Array.isArray(data) ? data.length : data && typeof data === 'object' ? Object.keys(data).length : 0;
    ElMessage.success(`请求成功，返回${Array.isArray(data) ? '数组 ' + count + ' 条' : '对象 ' + count + ' 字段'}`);
    nodeEventBus.emitReload(node.value!.id);
  } catch (err: any) {
    ElMessage.error('请求失败: ' + (err.message || err));
  }
};

const clearApiBinding = () => {
  if (node.value) {
    node.value.apiBinding = undefined;
  }
  apiForm.value = { url: '', method: 'GET', paramsText: '{}', responsePath: '', totalProp: '', autoFetch: true };
  paramsError.value = false;
};

// ---------------------------------------------------------------------------
// 事件 Tab (L3)
// ---------------------------------------------------------------------------

const actionTypes: Array<{ value: ActionType; label: string }> = [
  { value: 'reload_data', label: '刷新数据' },
  { value: 'open_dialog', label: '打开弹窗' },
  { value: 'close_dialog', label: '关闭弹窗' },
  { value: 'toggle_loading', label: '控制 Loading' },
  { value: 'show_message', label: '消息提示' },
  { value: 'set_state', label: '更新状态' }
];

interface ClickActionForm {
  id: string;
  type: ActionType | '';
  target?: string;
  payloadText: string;
  when?: string;
}

const eventName = computed(() => (node.value?.type === 'pro-form' ? 'submit' : 'click'));
const visibleWhenWarning = computed(() => {
  const raw = node.value?.visibleWhen?.trim();
  if (!raw) return '';
  return inlineableExpression(raw) ? '' : '显隐表达式无法安全求值，组件将保持显示';
});
const whenIsSafe = (when: string) => Boolean(inlineableExpression(when));

const clickActions = ref<ClickActionForm[]>([]);

watch(
  node,
  (n) => {
    const name = n?.type === 'pro-form' ? 'submit' : 'click';
    const rule = n?.events?.[name];
    clickActions.value = (rule?.actions ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      target: a.target ?? '',
      payloadText: a.payload ? JSON.stringify(a.payload, null, 2) : '',
      when: a.when ?? ''
    }));
  },
  { immediate: true }
);

/** 动作链表单 → node.events.click 同步 */
const syncEvents = () => {
  if (!node.value) return;
  const validActions = clickActions.value
    .filter((a) => a.type)
    .map((a) => {
      let payload: Record<string, any> | undefined;
      try {
        payload = a.payloadText.trim() ? JSON.parse(a.payloadText) : undefined;
      } catch {
        payload = undefined;
      }
      return {
        id: a.id || 'act_' + Date.now().toString(36),
        type: a.type as ActionType,
        target: a.target?.trim() || undefined,
        payload,
        when: a.when?.trim() || undefined
      };
    });
  const next = { ...(node.value.events || {}) };
  if (validActions.length > 0) next[eventName.value] = { enabled: true, actions: validActions };
  else delete next[eventName.value];
  node.value.events = next;
};

watch(clickActions, syncEvents, { deep: true });

const addAction = () => {
  clickActions.value.push({
    id: 'act_' + Date.now().toString(36),
    type: 'show_message',
    payloadText: JSON.stringify({ messageText: '操作完成' }, null, 2)
  });
};

const removeAction = (index: number) => {
  clickActions.value.splice(index, 1);
};

// ---------------------------------------------------------------------------
// 既有 Config Tab 操作
// ---------------------------------------------------------------------------

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
      placeholder: '请输入内容'
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
  flex-wrap: wrap;
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
.field-warning {
  margin: 4px 0 0;
  color: #e6a23c;
  font-size: 12px;
}
</style>

<style>
.property-drawer.el-drawer {
  top: 72px;
  height: calc(100vh - 72px);
}
</style>
