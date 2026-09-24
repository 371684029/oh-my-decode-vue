import { test, expect } from '@playwright/test';

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
    await page.click('.material-item:has-text("高端表格")');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(1);
    await expect(page.locator('.node-type-tag').first()).toContainText('高端表格');
  });

  test('选中节点打开属性抽屉并可切换数据源/事件 Tab', async ({ page }) => {
    await page.click('.material-item:has-text("按钮")');
    await page.click('.grid-node-wrapper');
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('tab', { name: '数据源' }).click();
    await expect(drawer.locator('text=接口数据源绑定')).toBeVisible();

    await drawer.getByRole('tab', { name: '事件' }).click();
    await expect(drawer.locator('text=click 事件动作链')).toBeVisible();
  });

  test('撤销与重做闭环', async ({ page }) => {
    await page.click('.material-item:has-text("按钮")');
    await expect(page.locator('.grid-node-wrapper')).toHaveCount(1);

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
    await page.click('.material-item:has-text("按钮")');
    await page.click('button:has-text("保存并写入 JSON")');
    await expect(page.locator('.el-message--success')).toBeVisible();
  });
});
