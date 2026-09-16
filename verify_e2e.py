from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # 点击选择“自有高端组件” Tab 并添加一个高端表格物料
    page.get_by_text("高端表格 (ProTable)").click()
    page.wait_for_timeout(1000)

    # 点击关闭抽屉
    page.locator(".el-drawer__close-btn").click()
    page.wait_for_timeout(500)

    # 切换到 Element-UI 组件 Tab
    page.get_by_text("Element-UI 组件").click()
    page.wait_for_timeout(1000)

    # 添加卡片和按钮物料
    page.get_by_text("卡片 (Card)").click()
    page.wait_for_timeout(1000)

    page.locator(".el-drawer__close-btn").click()
    page.wait_for_timeout(500)

    # 点击保存并写入 JSON 按钮
    page.get_by_text("保存并写入 JSON").click()
    page.wait_for_timeout(1000)

    # 截图与等待
    page.screenshot(path="/tmp/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/tmp/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
