# -*- coding: utf-8 -*-
# 遇见 适配:用 MediaCrawler 的登录态浏览器抓知乎用户真实头像。
# 用法(项目根目录):python scripts/fetch-avatar-browser.py <url_token> <输出绝对路径>
# 依赖 media-crawler/browser_data/ 里的登录态(跑过一次爬虫就有)。

import os
import sys
from playwright.sync_api import sync_playwright

BROWSER_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media-crawler", "browser_data")

def main() -> int:
    if len(sys.argv) != 3:
        print("usage: fetch_avatar_browser.py <url_token> <out_path>")
        return 2
    url_token, out_path = sys.argv[1], sys.argv[2]
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_DATA,
            headless=True,
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        )
        page = context.new_page()
        page.goto(f"https://www.zhihu.com/people/{url_token}", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2500)
        avatar_url = ""
        for sel in ["img.Avatar", ".UserAvatar-link img", "meta[property='og:image']", ".ProfileHeader-avatar img"]:
            try:
                el = page.query_selector(sel)
                if not el:
                    continue
                if sel.startswith("meta"):
                    avatar_url = el.get_attribute("content") or ""
                else:
                    avatar_url = el.get_attribute("src") or el.get_attribute("data-src") or ""
                if avatar_url:
                    break
            except Exception:
                continue
        if not avatar_url:
            print("ERR: 页面里没找到头像元素(可能未登录或被风控)")
            context.close()
            return 1
        resp = context.request.get(avatar_url, headers={"Referer": "https://www.zhihu.com/"})
        if not resp.ok:
            print(f"ERR: 头像下载 HTTP {resp.status}")
            context.close()
            return 1
        body = resp.body()
        if len(body) < 1000:
            print("ERR: 头像过小,疑似占位图")
            context.close()
            return 1
        with open(out_path, "wb") as fh:
            fh.write(body)
        print(f"OK: {out_path} ({len(body) // 1024}KB) <- {avatar_url[:70]}")
        context.close()
        return 0

if __name__ == "__main__":
    sys.exit(main())
