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
});
