import { test, expect, type Page } from '@playwright/test';

async function addMaterial(page: Page, label: string) {
  const tab = label === '高端表格' || label === '高端表单' ? '自有高端组件' : 'Element 组件';
  await page.getByRole('tab', { name: tab }).click();
  await page.locator('.material-item', { hasText: label }).click();
}

async function closeDrawer(page: Page) {
  const drawer = page.locator('.el-drawer');
  if (await drawer.isVisible()) {
    await drawer.locator('.el-drawer__close-btn').click();
    await expect(drawer).toBeHidden();
  }
}

test.describe('低代码设计器核心闭环', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.designer-header')).toBeVisible();
  });

  test('页面加载显示标题与物料面板', async ({ page }) => {
    await expect(page.locator('.logo-text')).toContainText('低代码前端可视化平台');
    await expect(page.locator('.material-panel')).toBeVisible();
    await expect(page.locator('.canvas-container')).toBeVisible();
  });

  test('添加物料节点并渲染到画布', async ({ page }) => {
    await addMaterial(page, '高端表格');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(1);
    await expect(page.locator('.node-type-tag').first()).toContainText('高端表格');
  });

  test('选中节点打开属性抽屉并可切换数据源/事件 Tab', async ({ page }) => {
    await addMaterial(page, '按钮');
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('tab', { name: '数据源' }).click();
    await expect(drawer.locator('text=接口数据源绑定')).toBeVisible();

    await drawer.getByRole('tab', { name: '事件' }).click();
    await expect(drawer.locator('text=click 事件动作链')).toBeVisible();
  });

  test('撤销与重做闭环', async ({ page }) => {
    await addMaterial(page, '按钮');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(1);
    await closeDrawer(page);

    await page.click('button:has-text("撤销")');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(0);

    await page.click('button:has-text("重做")');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(1);
  });

  test('打开导出代码对话框并显示完整渲染产物', async ({ page }) => {
    await page.click('button:has-text("导出代码")');
    const dialog = page.locator('.el-dialog:has-text("零废码出码引擎")');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=完整渲染').first()).toBeVisible();
  });

  test('保存并写入后端 JSON', async ({ page }) => {
    await addMaterial(page, '按钮');
    await closeDrawer(page);
    await page.click('button:has-text("保存并写入 JSON")');
    await expect(page.locator('.el-message--success')).toBeVisible();
  });

  test('未绑定数据源的表格显示占位姓名', async ({ page }) => {
    await addMaterial(page, '高端表格');
    await expect(page.locator('.grid-node-wrapper')).toContainText('张三');
  });

  test('按钮动作链打开默认隐藏的对话框', async ({ page }) => {
    await page.getByRole('tab', { name: '多图层管理' }).click();
    await page.getByRole('button', { name: '新建图层' }).click();
    await page.getByRole('menuitem', { name: /弹窗\/对话框/ }).click();
    const dialog = page.locator('.el-dialog').filter({ hasText: '业务弹窗图层' });
    await expect(dialog).toBeHidden();

    await addMaterial(page, '按钮');
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('tab', { name: '事件' }).click();
    await drawer.getByRole('button', { name: '添加动作' }).click();
    const eventPane = drawer.locator('.el-tab-pane:visible');
    await eventPane.locator('.el-select').nth(0).click();
    await page.getByRole('option', { name: '打开弹窗' }).click();
    await eventPane.locator('.el-select').nth(1).click();
    await page.getByRole('option', { name: /业务弹窗图层/ }).click();
    await closeDrawer(page);

    await page.locator('.grid-node-wrapper').getByRole('button', { name: '按钮' }).click();
    await expect(dialog).toBeVisible();
  });

  test('页面状态控制按钮显隐', async ({ page }) => {
    await page.getByRole('tab', { name: '页面状态' }).click();
    await page.getByRole('button', { name: '添加状态' }).click();
    const panel = page.locator('.page-state-panel');
    await panel.getByPlaceholder('键名').fill('show');
    await panel.getByPlaceholder('JSON 值').fill('false');
    await panel.getByPlaceholder('JSON 值').blur();

    await addMaterial(page, '按钮');
    const drawer = page.locator('.el-drawer');
    await drawer.getByPlaceholder('留空始终显示，例如 {{ state.show === true }}').fill('{{ state.show === true }}');
    await closeDrawer(page);

    const button = page.locator('.grid-node-wrapper').getByRole('button', { name: '按钮' });
    await expect(button).toBeHidden();

    await page.getByRole('tab', { name: '页面状态' }).click();
    await panel.getByPlaceholder('JSON 值').fill('true');
    await panel.getByPlaceholder('JSON 值').press('Enter');
    await expect(button).toBeVisible();
  });

  test('抽屉打开时仍可生成 Mock，试请求保留示例', async ({ page }) => {
    await addMaterial(page, '高端表格');
    await page.getByRole('button', { name: '生成 Mock 与接口文档' }).click();
    const dialog = page.getByRole('dialog', { name: '前端接口文档' });
    await expect(dialog).toContainText('/api/mock/');
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('tab', { name: '数据源' }).click();
    await page.getByRole('button', { name: '试请求并预览' }).click();
    await expect(page.locator('.el-message').last()).toContainText('请求成功');
    await expect(page.locator('.pro-table-wrapper').getByText('张三')).toBeVisible();
    await expect(page.locator('.pro-table-wrapper')).toContainText('共');
  });

  test('表单项下移后画布顺序跟着变', async ({ page }) => {
    await addMaterial(page, '高端表单');
    await page.getByRole('tab', { name: '高级 Config' }).click();
    await page.locator('.el-drawer').getByRole('button', { name: '下移' }).first().click();
    await expect(page.locator('.pro-form-wrapper .el-form-item__label').first()).toContainText('性别');
  });

  test('一键生成 Mock 与接口文档', async ({ page }) => {
    await addMaterial(page, '高端表格');
    await closeDrawer(page);
    await page.getByRole('button', { name: '生成 Mock 与接口文档' }).click();
    const dialog = page.getByRole('dialog', { name: '前端接口文档' });
    await expect(dialog).toContainText('/api/mock/');
    await expect(dialog).toContainText('data.list');
    await expect(page.locator('.pro-table-wrapper').getByText('张三')).toBeVisible();
  });

  test('纯预览隐藏搭建控件，退出后恢复', async ({ page }) => {
    await addMaterial(page, '按钮');
    await expect(page.locator('.delete-btn')).toBeVisible();
    await closeDrawer(page);
    await page.getByRole('button', { name: '纯预览模式' }).click();
    await expect(page.locator('.delete-btn')).toHaveCount(0);
    await expect(page.locator('.material-panel')).toBeHidden();
    await expect(page.locator('.grid-node-wrapper').getByRole('button', { name: '按钮' })).toBeVisible();
    await page.getByRole('button', { name: '退出预览' }).click();
    await expect(page.locator('.delete-btn')).toBeVisible();
  });

  test('保存后可以从列表删除', async ({ page, request }) => {
    const health = await request.get('http://localhost:3001/health').catch(() => null);
    test.skip(!health?.ok(), '后端不可用');

    await addMaterial(page, '按钮');
    await closeDrawer(page);
    const title = `删除用例${Date.now()}`;
    await page.getByPlaceholder('页面标题').fill(title);
    await page.getByRole('button', { name: '保存并写入 JSON' }).click();
    await expect(page.locator('.el-message--success')).toBeVisible();

    await page.getByRole('button', { name: '加载配置' }).click();
    const dialog = page.locator('.el-dialog');
    const row = dialog.locator('tr', { hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '删除' }).click();
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click();
    await expect(dialog.locator('tr', { hasText: title })).toHaveCount(0);
  });
});
