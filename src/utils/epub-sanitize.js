/**
 * 從 HTML/CSS 字串中移除所有 file:// 的 url() 引用，避免瀏覽器發送請求並報錯。
 * 在章節寫入 iframe 前對「字串」做處理，才能從根本避免 Not allowed to load local resource。
 */
const FILE_URL_REGEX = /url\s*\(\s*["']?file:\/\/[^"')]+["']?\s*\)/gi;

export function sanitizeHtmlFromLocalFonts(html) {
  if (typeof html !== 'string') return html;
  return html.replace(FILE_URL_REGEX, 'url("")');
}

/**
 * 移除指向 file:// 的 <link> 標籤（整段標籤移除，不發請求）
 */
export function stripLocalFontLinkTags(html) {
  if (typeof html !== 'string') return html;
  return html.replace(
    /<link[^>]+href\s*=\s*["']?file:\/\/[^"'>]+["']?[^>]*>/gi,
    ''
  );
}

/**
 * 合併：先移除 file:// 的 link 標籤，再替換 style 內的 file:// url()
 */
export function sanitizeEpubHtml(html) {
  if (typeof html !== 'string') return html;
  return stripLocalFontLinkTags(sanitizeHtmlFromLocalFonts(html));
}

/**
 * 移除 EPUB 內文對「本地絕對路徑字型」(file://) 的引用（DOM 版，備用）。
 * 若已用 serialize 鉤子淨化字串，理論上不需再跑此函式。
 */
export function removeLocalFontReferences(doc) {
  if (!doc || !doc.documentElement) return;

  const styleEls = doc.querySelectorAll('style');
  styleEls.forEach((style) => {
    let css = style.textContent || '';
    css = css.replace(FILE_URL_REGEX, 'url("")');
    style.textContent = css;
  });

  doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = (link.getAttribute('href') || '').trim();
    if (href.toLowerCase().startsWith('file://')) {
      link.remove();
    }
  });
}
