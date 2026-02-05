import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub from 'epubjs';
import jschardet from 'jschardet';
import { getBook, updateProgress } from '../db';
import { convertText, convertDocument } from '../utils/opencc';
import { sanitizeEpubHtml, removeLocalFontReferences } from '../utils/epub-sanitize';
import { ArrowLeft, Settings, Menu, ChevronLeft, ChevronRight } from 'lucide-react';

// 字型選項：key -> CSS font-family
const FONT_OPTIONS = [
  { key: 'default', label: '預設', family: 'inherit' },
  { key: 'noto_sans', label: 'Noto Sans 黑體', family: '"Noto Sans TC", sans-serif' },
  { key: 'noto_serif', label: 'Noto Serif 明體', family: '"Noto Serif TC", serif' },
  { key: 'jhenghei', label: '微軟正黑體', family: 'Microsoft JhengHei, 微軟正黑體, sans-serif' },
  { key: 'pingfang', label: '蘋方', family: 'PingFang TC, 蘋方-繁, sans-serif' },
  { key: 'kai', label: '標楷體', family: 'DFKai-SB, 標楷體, KaiTi, serif' },
];

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const txtContainerRef = useRef(null); // 專門給 TXT 用
  const renditionRef = useRef(null);    // 用於 effect 清理，避免閉包抓到錯的 rendition（Strict Mode 雙重掛載）
  const isTurningRef = useRef(false);   // 翻頁鎖，避免連續點擊造成 epub.js 狀態錯亂

  // 狀態管理
  const [bookData, setBookData] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [theme, setTheme] = useState('light'); 
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('default');
  const [textMode, setTextMode] = useState('original'); // 'original' | 'traditional' | 'simplified'
  const [txtContentRaw, setTxtContentRaw] = useState(''); // TXT 原文，供繁簡轉換
  const [rendition, setRendition] = useState(null);
  const [isReady, setIsReady] = useState(false); // 確保內容載入才允許操作
  const textModeRef = useRef(textMode);
  textModeRef.current = textMode;

  // 主題樣式
  const themeStyles = {
    light: 'bg-[#f8f9fa] text-gray-900', // 米白更舒適
    dark: 'bg-[#1a1a1a] text-[#a8a8a8]',
    green: 'bg-[#e3edcd] text-gray-800', 
  };

  // 1. 初始化讀取
  useEffect(() => {
    const initReader = async () => {
      const book = await getBook(Number(id));
      if (!book) return navigate('/');
      setBookData(book);

      if (book.type === 'epub') {
        renderEpub(book.data, book.progress);
      } else {
        renderTxt(book.data);
      }
    };
    initReader();

    // 清理函數：必須用 ref 銷毀「這次 effect 建立的」rendition，否則 Strict Mode 雙重掛載時會留下殭屍 rendition 導致翻頁失效
    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
    };
  }, [id]);

  // 2. EPUB 渲染邏輯
  const renderEpub = (data, savedCfi) => {
    if (!viewerRef.current) return;
    const book = ePub(data);
    const rend = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated', // 強制分頁模式
      manager: 'default', // 嘗試解決部分 iframe 錯誤
      allowScriptedContent: true // 允許部分腳本執行
    });

    renditionRef.current = rend; // 讓 effect cleanup 能正確銷毀「這次建立的」rendition
    setRendition(rend);

    // 在章節 HTML 寫入 iframe 前淨化字串，移除 file:// 字型引用，從根本避免發送請求與報錯
    rend.book.spine.hooks.serialize.register((output, section) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          section.output = sanitizeEpubHtml(section.output ?? output);
          resolve();
        }, 0);
      });
    });

    const startLoc = savedCfi && savedCfi !== 0 ? savedCfi : undefined;
    rend.display(startLoc).then(() => setIsReady(true));

    rend.on('relocated', (location) => {
      updateProgress(Number(id), location.start.cfi);
    });

    // EPUB 內容鉤子：DOM 再淨化一次（備援），再套用繁簡
    rend.hooks.content.register((contents) => {
      const doc = contents?.document;
      if (!doc?.body) return;
      removeLocalFontReferences(doc);
      if (textModeRef.current !== 'original') {
        convertDocument(doc, textModeRef.current);
      }
    });

    const fontCss = FONT_OPTIONS.find(f => f.key === fontFamily)?.family || 'inherit';
    rend.themes.fontSize(`${fontSize}px`);
    rend.themes.font(fontCss); // 使用 epub.js 的 font() override，會套用到 iframe body 並帶 !important
  };

  // 3. TXT 渲染邏輯（儲存原文，顯示時依 textMode 轉換）
  const renderTxt = (data) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const detected = jschardet.detect(new Uint8Array(arrayBuffer).slice(0, 1000)); 
      const decoder = new TextDecoder(detected.encoding || 'utf-8');
      const text = decoder.decode(arrayBuffer);
      setTxtContentRaw(text);
      setIsReady(true);
    };
    reader.readAsArrayBuffer(data);
  };

  // 4. 樣式動態更新（字體、字級、主題）
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`);
      const color = theme === 'dark' ? '#a8a8a8' : '#000000';
      rendition.themes.default({ body: { color } });
      const fontCss = FONT_OPTIONS.find(f => f.key === fontFamily)?.family || 'inherit';
      rendition.themes.font(fontCss); // 使用 epub.js font() 才會正確套用到 iframe 內文
    }
  }, [fontSize, theme, fontFamily, rendition]);

  // EPUB：切換繁簡時，原文需重新載入章節；繁/簡則對目前已載入的 iframe 套用轉換
  useEffect(() => {
    if (!rendition || bookData?.type !== 'epub') return;
    if (textMode === 'original') {
      const cfi = rendition.location?.start?.cfi;
      if (cfi) rendition.display(cfi); // 重新載入目前章節以還原原文
      return;
    }
    const contents = rendition.getContents?.();
    if (contents?.length) {
      contents.forEach((content) => {
        const doc = content.document;
        if (doc?.body) convertDocument(doc, textMode);
      });
    }
  }, [textMode, rendition, bookData?.type]);

  // ==========================
  // 核心功能：翻頁邏輯
  // ==========================

  const prevPage = useCallback(() => {
    if (bookData?.type === 'epub' && rendition) {
      if (isTurningRef.current) return;
      isTurningRef.current = true;
      rendition.prev()
        .catch(err => console.error("EPUB翻頁失敗:", err))
        .finally(() => { isTurningRef.current = false; });
    } else if (bookData?.type === 'txt' && txtContainerRef.current) {
      txtContainerRef.current.scrollBy({ 
        top: -txtContainerRef.current.clientHeight * 0.9, // 稍微留一點重疊方便閱讀
        behavior: 'smooth' 
      });
    }
  }, [bookData, rendition]);
  
  const nextPage = useCallback(() => {
    if (bookData?.type === 'epub' && rendition) {
      if (isTurningRef.current) return;
      isTurningRef.current = true;
      rendition.next()
        .catch(err => console.error("EPUB翻頁失敗:", err))
        .finally(() => { isTurningRef.current = false; });
    } else if (bookData?.type === 'txt' && txtContainerRef.current) {
      txtContainerRef.current.scrollBy({ 
        top: txtContainerRef.current.clientHeight * 0.9, 
        behavior: 'smooth' 
      });
    }
  }, [bookData, rendition]);

  // ==========================
  // 核心功能：鍵盤監聽
  // ==========================
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') nextPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPage, nextPage]);


  // 處理點擊區域 (左翻、中選單、右翻)
  const handleZoneClick = (e) => {
    const width = window.innerWidth;
    const x = e.clientX;

    // 左邊 20% -> 上一頁
    if (x < width * 0.2) {
      prevPage();
    } 
    // 右邊 20% -> 下一頁
    else if (x > width * 0.8) {
      nextPage();
    } 
    // 中間 60% -> 切換選單
    else {
      setShowMenu(!showMenu);
    }
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden ${themeStyles[theme]}`}>
      
      {/* 頂部選單：選單開啟時 z-50 高於翻頁層 z-40，才能點擊 */}
      <div className={`absolute top-0 left-0 w-full p-4 flex justify-between items-center bg-white border-b border-gray-200 transition-transform duration-300 text-gray-800 ${showMenu ? 'translate-y-0 z-50' : '-translate-y-full z-30'}`}>
        <button onClick={() => navigate('/')}><ArrowLeft /></button>
        <span className="font-bold truncate max-w-[200px]">{bookData?.title}</span>
        <button><Menu /></button>
      </div>

      {/* 閱讀核心區域 */}
    <div className="w-full h-full relative">
    
        {/* 強制翻頁導航層 - 放在最前方 (z-50) */}
        <div className="absolute inset-0 z-40 pointer-events-none flex">
            {/* 左側點擊區 */}
            <button 
            onClick={(e) => { e.stopPropagation(); prevPage(); }}
            className="w-[20%] h-full pointer-events-auto cursor-west-resize group flex items-center justify-start p-4"
            >
            <ChevronLeft className="opacity-0 group-hover:opacity-100 text-gray-400 bg-white/20 rounded-full transition-opacity" size={48} />
            </button>

            {/* 中間喚起選單區 */}
            <div 
            onClick={() => setShowMenu(!showMenu)}
            className="w-[60%] h-full pointer-events-auto cursor-pointer"
            ></div>

            {/* 右側點擊區 */}
            <button 
            onClick={(e) => { e.stopPropagation(); nextPage(); }}
            className="w-[20%] h-full pointer-events-auto cursor-east-resize group flex items-center justify-end p-4"
            >
            <ChevronRight className="opacity-0 group-hover:opacity-100 text-gray-400 bg-white/20 rounded-full transition-opacity" size={48} />
            </button>
        </div>

        {/* 內容渲染層 */}
        <div className="w-full h-full flex justify-center items-center z-0">
            <div 
                ref={viewerRef} 
                className="w-full max-w-4xl h-full"
                style={{ display: bookData?.type === 'epub' ? 'block' : 'none' }}
            ></div>
            
            {bookData?.type === 'txt' && (
            <div 
                ref={txtContainerRef}
                className="w-full max-w-3xl h-full overflow-y-hidden p-6 whitespace-pre-wrap leading-relaxed no-scrollbar select-none"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: FONT_OPTIONS.find(f => f.key === fontFamily)?.family || 'inherit',
                }}
            >
                {convertText(txtContentRaw, textMode)}
            </div>
            )}
        </div>
    </div>

      {/* 底部設定選單：選單開啟時 z-50 高於翻頁層 z-40，才能點擊 */}
      <div className={`absolute bottom-0 left-0 w-full p-6 bg-white border-t border-gray-200 text-gray-800 transition-transform duration-300 ${showMenu ? 'translate-y-0 z-50' : 'translate-y-full z-30'}`}>
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {/* 字體大小 */}
            <div className="flex items-center justify-between">
                <span>字體大小</span>
                <div className="flex gap-4 items-center">
                    <button onClick={() => setFontSize(s => Math.max(14, s - 2))} className="border px-3 py-1 rounded hover:bg-gray-100">A-</button>
                    <span>{fontSize}</span>
                    <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="border px-3 py-1 rounded hover:bg-gray-100">A+</button>
                </div>
            </div>
            {/* 字型 */}
            <div className="flex flex-col gap-1">
                <span>字型</span>
                <div className="flex flex-wrap gap-2">
                    {FONT_OPTIONS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFontFamily(f.key)}
                            className={`px-3 py-1.5 border rounded text-sm ${fontFamily === f.key ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            {/* 繁簡轉換 */}
            <div className="flex flex-col gap-1">
                <span>繁簡轉換</span>
                <div className="flex gap-2">
                    <button onClick={() => setTextMode('original')} className={`flex-1 py-2 border rounded text-sm ${textMode === 'original' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}>原文</button>
                    <button onClick={() => setTextMode('traditional')} className={`flex-1 py-2 border rounded text-sm ${textMode === 'traditional' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}>繁體</button>
                    <button onClick={() => setTextMode('simplified')} className={`flex-1 py-2 border rounded text-sm ${textMode === 'simplified' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-100'}`}>簡體</button>
                </div>
            </div>
            {/* 主題 */}
            <div className="flex flex-col gap-1">
                <span>主題</span>
                <div className="flex justify-between gap-2 text-sm">
                    <button onClick={() => setTheme('light')} className={`flex-1 py-2 border rounded ${theme === 'light' ? 'ring-2 ring-blue-500' : ''}`}>白天</button>
                    <button onClick={() => setTheme('green')} className={`flex-1 py-2 border rounded bg-[#e3edcd] text-black ${theme === 'green' ? 'ring-2 ring-blue-500' : ''}`}>護眼</button>
                    <button onClick={() => setTheme('dark')} className={`flex-1 py-2 border rounded bg-gray-900 text-white ${theme === 'dark' ? 'ring-2 ring-blue-500' : ''}`}>黑夜</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}