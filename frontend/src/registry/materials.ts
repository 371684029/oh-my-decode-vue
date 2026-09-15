export interface MaterialItem {
  type: string;
  label: string;
  icon: string;
  category: 'pro' | 'element';
  defaultLayout: {
    w: number;
    h: number;
  };
  defaultProps: Record<string, any>;
  defaultAttrs: Record<string, any>;
  defaultConfig?: Record<string, any>;
}

export const MATERIAL_REGISTRY: MaterialItem[] = [
  // --- 自有高端组件 ---
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

  // --- Element Plus 常用组件 ---
  {
    type: 'el-button',
    label: '按钮 (Button)',
    icon: 'Pointer',
    category: 'element',
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
    label: '输入框 (Input)',
    icon: 'EditPen',
    category: 'element',
    defaultLayout: { w: 4, h: 2 },
    defaultProps: {
      placeholder: '请输入内容...',
      clearable: true
    },
    defaultAttrs: {}
  },
  {
    type: 'el-card',
    label: '卡片 (Card)',
    icon: 'Box',
    category: 'element',
    defaultLayout: { w: 6, h: 4 },
    defaultProps: {
      header: '卡片标题',
      shadow: 'always'
    },
    defaultAttrs: {}
  },
  {
    type: 'el-tag',
    label: '标签 (Tag)',
    icon: 'PriceTag',
    category: 'element',
    defaultLayout: { w: 2, h: 2 },
    defaultProps: {
      text: '标签内容',
      type: 'success',
      effect: 'light'
    },
    defaultAttrs: {}
  },
  {
    type: 'el-alert',
    label: '警告提示 (Alert)',
    icon: 'Warning',
    category: 'element',
    defaultLayout: { w: 6, h: 3 },
    defaultProps: {
      title: '温馨提示信息',
      type: 'info',
      showIcon: true,
      closable: true
    },
    defaultAttrs: {}
  },
  {
    type: 'el-switch',
    label: '开关 (Switch)',
    icon: 'Switch',
    category: 'element',
    defaultLayout: { w: 2, h: 2 },
    defaultProps: {
      value: true,
      activeText: '开启',
      inactiveText: '关闭'
    },
    defaultAttrs: {}
  },
  {
    type: 'el-divider',
    label: '分割线 (Divider)',
    icon: 'SemiSelect',
    category: 'element',
    defaultLayout: { w: 12, h: 1 },
    defaultProps: {
      contentPosition: 'center',
      text: '分割线文字'
    },
    defaultAttrs: {}
  }
];
