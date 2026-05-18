"""메인 대시보드 백엔드에서 사용하는 위키 export 로직."""

from __future__ import annotations

import base64
import mimetypes
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.parse import unquote, urljoin, urlparse

from bs4 import BeautifulSoup

from app.client.redmine_client import RedmineClient


@dataclass
class WikiPageNode:
    text: str
    href: str
    url: str
    page_name: str
    page_name_decoded: str
    level: int
    anchor_id: str
    children: list["WikiPageNode"] = field(default_factory=list)


class WikiExportService:
    def __init__(self, client: RedmineClient):
        self._client = client

    async def export_project_wiki_html(self, project_key: str, on_progress=None) -> str:
        self._emit_progress(on_progress, "위키 목차 페이지를 불러오는 중입니다.", progress=5, step="목차 수집")
        toc_html = await self._client.fetch_html_page(f"/projects/{project_key}/wiki")
        toc_tree, links = self._parse_toc_links(toc_html)
        self._emit_progress(on_progress, f"목차에서 {len(links)}개 문서를 찾았습니다.", progress=12, step="목차 분석")

        pages: list[dict[str, Any]] = []
        total = len(links)
        for index, link in enumerate(links, start=1):
            page_progress = 12 if total == 0 else 12 + int((index - 1) / max(total, 1) * 76)
            self._emit_progress(
                on_progress,
                f"[{index}/{total}] {link.text} 문서를 수집하는 중입니다.",
                progress=page_progress,
                step="문서 수집",
            )
            page_html = await self._client.fetch_html_page(link.url, absolute_url=True)
            content_html = self._extract_wiki_content(page_html)
            content_html = await self._inline_images(content_html)
            content_html = self._rewrite_wiki_links(content_html, links)
            pages.append(
                {
                    "anchor_id": link.anchor_id,
                    "title": link.text,
                    "level": link.level,
                    "content": content_html,
                }
            )

        self._emit_progress(on_progress, "단일 HTML 파일로 병합하는 중입니다.", progress=92, step="HTML 생성")
        return self._generate_merged_html(project_key, toc_tree, pages)

    def _emit_progress(self, callback, message: str, progress: int | None = None, step: str | None = None) -> None:
        if callback is None:
            return
        callback(message, progress, step)

    def _extract_wiki_content(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        wiki_content = None

        for selector in ["#content .wiki-page", "#content", ".wiki-page", ".wiki", ".content"]:
            wiki_content = soup.select_one(selector)
            if wiki_content:
                break

        if wiki_content is None:
            return html

        for anchor in wiki_content.find_all("a", class_="wiki-anchor"):
            anchor.decompose()

        for node in wiki_content.find_all(["a", "div", "span"], class_=re.compile(r"edit|contextual", re.IGNORECASE)):
            node.decompose()

        return str(wiki_content)

    def _parse_toc_links(self, toc_html: str) -> tuple[list[WikiPageNode], list[WikiPageNode]]:
        soup = BeautifulSoup(toc_html, "html.parser")
        toc_ul = soup.find("ul", class_="pages-hierarchy")
        if toc_ul is None:
            for ul in soup.find_all("ul"):
                if ul.find("a", href=re.compile(r"/wiki/")):
                    toc_ul = ul
                    break

        if toc_ul is None:
            return [], []

        flat_links: list[WikiPageNode] = []
        tree = self._extract_links_tree(toc_ul, flat_links, level=0)
        return tree, flat_links

    def _extract_links_tree(self, element: Any, flat_links: list[WikiPageNode], level: int) -> list[WikiPageNode]:
        nodes: list[WikiPageNode] = []

        for li in element.find_all("li", recursive=False):
            link = li.find("a", recursive=False)
            if link is None or not link.get("href") or "/wiki/" not in link["href"]:
                nested = li.find("ul", recursive=False)
                if nested:
                    nodes.extend(self._extract_links_tree(nested, flat_links, level + 1))
                continue

            href = link["href"]
            page_name = href.split("/wiki/")[-1].split("#")[0]
            decoded = unquote(page_name)
            node = WikiPageNode(
                text=link.get_text(strip=True),
                href=href,
                url=urljoin(self._client.base_url, href),
                page_name=page_name,
                page_name_decoded=decoded,
                level=level,
                anchor_id=self._generate_anchor_id(decoded),
            )

            nested_ul = li.find("ul", recursive=False)
            if nested_ul:
                node.children = self._extract_links_tree(nested_ul, flat_links, level + 1)

            flat_links.append(node)
            nodes.append(node)

        return nodes

    def _generate_anchor_id(self, page_name: str) -> str:
        normalized = " ".join(page_name.split())
        anchor = re.sub(r"[^\w\s-]", "-", normalized, flags=re.UNICODE)
        anchor = re.sub(r"-+", "-", anchor).strip(" -").lower().replace(" ", "-")
        return f"page-{anchor}" if anchor else "page-unknown"

    async def _inline_images(self, html_content: str) -> str:
        soup = BeautifulSoup(html_content, "html.parser")

        for img in soup.find_all("img", src=True):
            src = img.get("src")
            if not src:
                continue

            absolute_url = src if src.startswith("http") else urljoin(self._client.base_url, src)
            try:
                asset = await self._client.fetch_asset(absolute_url)
            except Exception:
                continue

            mime_type = asset.headers.get("content-type", "").split(";")[0].strip()
            if not mime_type:
                guessed, _ = mimetypes.guess_type(urlparse(absolute_url).path)
                mime_type = guessed or "application/octet-stream"

            encoded = base64.b64encode(asset.content).decode("ascii")
            img["src"] = f"data:{mime_type};base64,{encoded}"

        return str(soup)

    def _rewrite_wiki_links(self, html_content: str, all_links: list[WikiPageNode]) -> str:
        soup = BeautifulSoup(html_content, "html.parser")
        page_name_to_anchor = {node.page_name_decoded: node.anchor_id for node in all_links}

        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "/wiki/" not in href:
                continue

            page_name = unquote(href.split("/wiki/")[-1].split("#")[0])
            anchor_id = page_name_to_anchor.get(page_name, self._generate_anchor_id(page_name))
            link["href"] = f"#{anchor_id}"

        return str(soup)

    def _generate_merged_html(self, project_key: str, toc_tree: list[WikiPageNode], pages: list[dict[str, Any]]) -> str:
        toc_html = self._build_toc_html(toc_tree)
        page_html = "\n".join(
            f"""
            <section id="{page['anchor_id']}" class="wiki-page">
              <h2>{page['title']}</h2>
              <div class="wiki-content">
                {page['content']}
              </div>
              <div class="back-to-toc"><a href="#toc">Back to TOC</a></div>
            </section>
            """
            for page in pages
        )
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redmine Wiki Export - {project_key}</title>
  <style>
    * {{ box-sizing: border-box; }}
    html, body {{ margin: 0; padding: 0; }}
    body {{ font-family: "Segoe UI", Arial, sans-serif; background: #f5f7fb; color: #1f2937; line-height: 1.7; }}
    #toc {{ position: fixed; top: 0; left: 0; width: 320px; height: 100vh; overflow-y: auto; padding: 24px; background: #fff; border-right: 1px solid #e5e7eb; }}
    #toc h1 {{ margin: 0 0 12px; font-size: 20px; }}
    #toc ul {{ list-style: none; padding-left: 0; margin: 0; }}
    #toc ul ul {{ padding-left: 16px; margin-top: 4px; }}
    #toc li {{ margin: 4px 0; }}
    #toc a {{ display: block; padding: 6px 8px; border-radius: 8px; text-decoration: none; color: #2563eb; }}
    #toc a:hover {{ background: #eff6ff; }}
    #content {{ margin-left: 320px; padding: 28px; }}
    .export-info {{ margin-bottom: 20px; padding: 16px 18px; background: #fff; border: 1px solid #dbeafe; border-radius: 16px; }}
    .wiki-page {{ margin-bottom: 28px; padding: 28px; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; box-shadow: 0 8px 24px -20px rgba(15, 23, 42, 0.18); }}
    .wiki-page h2 {{ margin: 0 0 18px; font-size: 28px; line-height: 1.25; }}
    .wiki-content img {{ max-width: 100%; height: auto; border-radius: 12px; }}
    .wiki-content table {{ width: 100%; border-collapse: collapse; }}
    .wiki-content th, .wiki-content td {{ border: 1px solid #d1d5db; padding: 8px 10px; }}
    .wiki-content th {{ background: #f9fafb; }}
    .wiki-content code {{ background: #f3f4f6; color: #1f2937; padding: 2px 4px; border-radius: 4px; }}
    .wiki-content pre {{
      overflow-x: auto;
      background: #111827;
      color: #f8fafc !important;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #1f2937;
      white-space: pre-wrap;
    }}
    .wiki-content pre code {{
      display: block;
      background: transparent !important;
      color: inherit !important;
      -webkit-text-fill-color: currentColor !important;
      text-shadow: none !important;
      opacity: 1 !important;
      font-family: "Consolas", "Courier New", monospace;
      font-weight: 500;
    }}
    .wiki-content pre code *,
    .wiki-content pre span,
    .wiki-content pre font {{
      color: inherit !important;
      fill: currentColor !important;
      stroke: transparent;
      -webkit-text-fill-color: currentColor !important;
      opacity: 1 !important;
    }}
    .back-to-toc {{ margin-top: 20px; padding-top: 14px; border-top: 1px solid #e5e7eb; }}
    .back-to-toc a {{ color: #2563eb; text-decoration: none; font-weight: 600; }}
    @media (max-width: 960px) {{
      #toc {{ position: static; width: auto; height: auto; border-right: 0; border-bottom: 1px solid #e5e7eb; }}
      #content {{ margin-left: 0; padding: 16px; }}
      .wiki-page {{ padding: 20px; }}
    }}
  </style>
</head>
<body>
  <nav id="toc">
    <h1>Table of Contents</h1>
    <div>Project: {project_key}</div>
    <div style="margin-top:8px;color:#6b7280;font-size:13px;">Generated: {generated_at}</div>
    <div style="margin-top:18px;">{toc_html}</div>
  </nav>
  <main id="content">
    <div class="export-info">
      <strong>Redmine Wiki Export</strong><br />
      Exported {len(pages)} wiki pages into a single HTML file.
    </div>
    {page_html}
  </main>
</body>
</html>"""

    def _build_toc_html(self, nodes: list[WikiPageNode]) -> str:
        if not nodes:
            return "<div>Unable to build a wiki table of contents.</div>"

        def render(items: list[WikiPageNode]) -> str:
            inner = "".join(
                f'<li><a href="#{item.anchor_id}">{item.text}</a>{render(item.children) if item.children else ""}</li>'
                for item in items
            )
            return f"<ul>{inner}</ul>"

        return render(nodes)
