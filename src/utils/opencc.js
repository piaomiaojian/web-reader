/**
 * 繁簡轉換工具（基於 opencc-js）
 * 提供字串轉換與 DOM 文字節點轉換
 */
import * as OpenCC from 'opencc-js';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);

/**
 * 將文字轉為指定模式
 * @param {string} text
 * @param {'original'|'traditional'|'simplified'} mode
 * @returns {string}
 */
export function convertText(text, mode) {
  if (!text || mode === 'original') return text;
  if (mode === 'traditional') return toTraditional(text);
  if (mode === 'simplified') return toSimplified(text);
  return text;
}

/**
 * 遞迴轉換 DOM 內所有文字節點（跳過 SCRIPT/STYLE 等）
 * @param {Document|DocumentFragment|Element} root
 * @param {'traditional'|'simplified'} mode
 */
export function convertDocument(root, mode) {
  if (!root || mode === 'original') return;
  const converter = mode === 'traditional' ? toTraditional : toSimplified;

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const trimmed = node.textContent?.trim();
      if (trimmed) node.textContent = converter(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(node.tagName) || node.classList?.contains('ignore-opencc')) return;
    for (const child of node.childNodes) walk(child);
  }

  walk(root.body || root);
}
