'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { buildAbsoluteRedmineUrl, buildRedmineAssetProxyUrl, isRedmineAssetPath } from '@/lib/redmineAssets'

// ── Redmine 상대경로 → 절대경로 변환 ──────────────────────────────────────────

function resolveRedmineUrls(html: string, baseUrl: string): string {
  if (!baseUrl) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll<HTMLElement>('[src],[href]').forEach((node) => {
    const src = node.getAttribute('src')
    const href = node.getAttribute('href')

    if (src) {
      const absoluteSrc = buildAbsoluteRedmineUrl(src, baseUrl)
      if (isRedmineAssetPath(src, baseUrl)) {
        node.setAttribute('src', buildRedmineAssetProxyUrl(src, baseUrl))
        node.setAttribute('data-original-src', absoluteSrc)
      } else {
        node.setAttribute('src', absoluteSrc)
      }
    }

    if (href) {
      const absoluteHref = buildAbsoluteRedmineUrl(href, baseUrl)
      if (isRedmineAssetPath(href, baseUrl)) {
        node.setAttribute('href', buildRedmineAssetProxyUrl(href, baseUrl))
        node.setAttribute('data-original-href', absoluteHref)
      } else {
        node.setAttribute('href', absoluteHref)
      }
    }
  })

  return doc.body.innerHTML
}

function hasMeaningfulHtml(html: string): boolean {
  return /<(p|div|h[1-6]|ul|ol|li|table|blockquote|pre|img|a)\b/i.test(html)
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)#{1,6}\s|\*\*[^*]+\*\*|(^|\n)(-|\*)\s+|(^|\n)\d+\.\s+|```|\[[^\]]+\]\([^\)]+\)/m.test(text)
}

function htmlStillContainsMarkdownTokens(html: string): boolean {
  return /###\s|\*\*[^*]+\*\*|(^|\n)(-|\*)\s+|(^|\n)\d+\.\s+/m.test(html)
}

function markdownToHtml(text: string): string {
  marked.setOptions({
    gfm: true,
    breaks: true,
  })

  return marked.parse(text) as string
}

// ── Plain text → 기본 HTML 변환 (fallback) ─────────────────────────────────────

function plainTextToHtml(text: string): string {
  // HTML 엔티티 escape
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // URL을 링크로 변환
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  // **bold** 처리
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // *italic* 처리
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 빈 줄을 문단 구분으로
  html = html
    .split(/\n{2,}/)
    .map(p => `<p>${p.trim()}</p>`)
    .join('')

  // 단일 줄바꿈을 <br>로
  html = html.replace(/\n/g, '<br>')

  return html
}

// ── Sanitize 설정 ──────────────────────────────────────────────────────────────

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'blockquote',
    'pre', 'code',
    'a',
    'img',
    'hr',
    'dl', 'dt', 'dd',
    'figure', 'figcaption',
    'abbr', 'cite', 'q',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'class', 'id',
    'data-original-src', 'data-original-href',
    'width', 'height',
    'colspan', 'rowspan', 'headers', 'scope',
    'start', 'type', 'value',
    'cite',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
}

// ── 이미지 에러 핸들러 ────────────────────────────────────────────────────────

function handleImgError(e: React.SyntheticEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement
    // 이미 fallback 처리된 경우 무시
    if (img.dataset.fallback) return
    img.dataset.fallback = '1'
    img.style.display = 'none'
    const fallback = document.createElement('div')
    fallback.className = 'issue-rich-img-fallback'
    fallback.textContent = `이미지를 불러올 수 없습니다: ${img.alt || img.src}`
    img.parentNode?.insertBefore(fallback, img.nextSibling)
  }
}

// ── 이미지 클릭 → 새 탭 열기 ──────────────────────────────────────────────────

function handleImgClick(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement
    const originalSrc = img.getAttribute('data-original-src')
    if (originalSrc || img.src) {
      window.open(originalSrc ?? img.src, '_blank', 'noopener,noreferrer')
    }
  }
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

interface IssueRichContentProps {
  html?: string | null     // 서버에서 변환된 HTML (우선 사용)
  raw?: string | null      // 원문 텍스트 (fallback)
  baseUrl?: string         // Redmine base URL (상대경로 변환용)
  className?: string
}

export default function IssueRichContent({
  html,
  raw,
  baseUrl = '',
  className = '',
}: IssueRichContentProps) {
  const sanitizedHtml = useMemo(() => {
    let content: string
    const rawText = raw?.trim() ?? ''
    const htmlText = html?.trim() ?? ''
    const preferMarkdown = !!rawText && looksLikeMarkdown(rawText)
    const canUseHtml = !!htmlText && hasMeaningfulHtml(htmlText) && !htmlStillContainsMarkdownTokens(htmlText)

    if (canUseHtml && !preferMarkdown) {
      content = resolveRedmineUrls(htmlText, baseUrl)
    } else if (preferMarkdown) {
      content = markdownToHtml(rawText)
      content = resolveRedmineUrls(content, baseUrl)
    } else if (rawText) {
      content = plainTextToHtml(rawText)
      content = resolveRedmineUrls(content, baseUrl)
    } else {
      return ''
    }

    // 모든 링크를 새 탭에서 열리도록 처리
    const purified = DOMPurify.sanitize(content, PURIFY_CONFIG)

    // a 태그에 target="_blank" 자동 추가
    return purified.replace(
      /<a\s/g,
      '<a target="_blank" rel="noopener noreferrer" '
    )
  }, [html, raw, baseUrl])

  if (!sanitizedHtml) {
    return <p className="text-xs text-gray-400">내용 없음</p>
  }

  return (
    <div
      className={`issue-rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      onError={handleImgError}
      onClick={handleImgClick}
    />
  )
}
