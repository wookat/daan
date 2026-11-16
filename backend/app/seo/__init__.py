"""SEO 题库落地页包：SSR 页族 + sitemap/robots/llms.txt/IndexNow。

子模块按原单文件顺序导入，保持 Starlette 路由注册顺序（catchall 必须最后）。
"""
# 路由注册副作用：具体路径页族先注册，/{module} 兜底必须最后，勿按字母序合并
from app.seo import shenlun  # noqa: F401  # isort: skip
from app.seo import pages  # noqa: F401  # isort: skip
from app.seo import catchall  # noqa: F401  # isort: skip
from app.seo import landings
from app.seo import sitefiles  # noqa: F401  # isort: skip
from .common import PAGE_SIZE, _not_found, _pager, _url, root_router, router  # noqa: F401
from .pages import _daily_archive_days
from .sitefiles import _indexnow_page_urls, _indexnow_post, _indexnow_submit_pages, _sitemap_page_urls, _sitemap_topic_urls, _sitemap_year_urls

__all__ = [
    "_daily_archive_days",
    "_indexnow_page_urls",
    "_indexnow_post",
    "_indexnow_submit_pages",
    "_not_found",
    "_sitemap_page_urls",
    "_sitemap_topic_urls",
    "_sitemap_year_urls",
    "_url",
    "root_router",
    "router",
]
