import os
import time
from playwright.sync_api import sync_playwright

def run():
    screenshot_dir = "/tmp/verification/screenshots"
    os.makedirs(screenshot_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})

        print("Navigating to http://localhost:5173 ...")
        page.goto("http://localhost:5173")
        page.wait_for_timeout(1000)

        # Click on '多图层管理' Tab
        page.click('.el-tabs__item:has-text("多图层管理")')
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(screenshot_dir, "v120_multi_layer_tab.png"))

        # Click '新建图层' dropdown and add Custom HTML layer
        page.click('button:has-text("新建图层")')
        page.wait_for_timeout(300)
        page.click('.el-dropdown-menu__item:has-text("自定义 HTML")')
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(screenshot_dir, "v120_custom_html_layer_added.png"))

        # Add Dialog Layer
        page.click('button:has-text("新建图层")')
        page.wait_for_timeout(300)
        page.click('.el-dropdown-menu__item:has-text("弹窗/对话框图层")')
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(screenshot_dir, "v120_dialog_layer_added.png"))

        browser.close()
        print("Playwright Python v1.2.0 verification completed successfully.")

if __name__ == "__main__":
    run()
