import type { MaterialItem } from '../types/designer';

export const MATERIAL_REGISTRY: MaterialItem[] = [
  {
    type: 'pro-table',
    label: '高端表格 (ProTable)',
    icon: 'Grid',
    category: 'pro',
    defaultLayout: { w: 12, h: 6 },
    defaultProps: {
      border: true,
      stripe: true,
      size: 'default'
    },
    defaultAttrs: {
      'data-testid': 'pro-table-wrapper'
    },
    defaultConfig: {
      columns: [
        { prop: 'id', label: 'ID', width: '80', sortable: true, align: 'center' },
        { prop: 'name', label: '姓名', width: '150', align: 'left' },
        { prop: 'role', label: '角色', width: '120', align: 'center' },
        { prop: 'status', label: '状态', width: '100', align: 'center' },
        { prop: 'updatedAt', label: '更新时间', align: 'left' }
      ],
      pagination: {
        enabled: true,
        pageSize: 10
      },
      actions: [
        { label: '查看', type: 'primary', eventKey: 'view' },
        { label: '删除', type: 'danger', eventKey: 'delete' }
      ]
    }
  },
  {
    type: 'pro-form',
    label: '高端表单 (ProForm)',
    icon: 'DocumentChecked',
    category: 'pro',
    defaultLayout: { w: 12, h: 5 },
    defaultProps: {
      labelWidth: '100px',
      layout: 'horizontal',
      size: 'default'
    },
    defaultAttrs: {
      'data-testid': 'pro-form-wrapper'
    },
    defaultConfig: {
      items: [
        { field: 'username', label: '用户名', component: 'input', placeholder: '请输入用户名', required: true },
        { field: 'gender', label: '性别', component: 'select', placeholder: '请选择性别', options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] },
        { field: 'birthday', label: '出生日期', component: 'date', placeholder: '请选择日期' },
        { field: 'enableNotice', label: '开启通知', component: 'switch' }
      ]
    }
  },
  {
    type: 'el-button',
    label: '基础按钮',
    icon: 'Pointer',
    category: 'basic',
    defaultLayout: { w: 2, h: 2 },
    defaultProps: {
      type: 'primary',
      text: '操作按钮',
      size: 'default'
    },
    defaultAttrs: {}
  },
  {
    type: 'el-input',
    label: '文本输入框',
    icon: 'EditPen',
    category: 'basic',
    defaultLayout: { w: 4, h: 2 },
    defaultProps: {
      placeholder: '请输入内容...',
      clearable: true
    },
    defaultAttrs: {}
  }
];
