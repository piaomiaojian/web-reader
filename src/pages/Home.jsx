import React, { useEffect, useState } from 'react';
import { addBook, getAllBooks } from '../db';
import { useNavigate } from 'react-router-dom';
import { Upload, BookOpen } from 'lucide-react';

export default function Home() {
  const [books, setBooks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    const list = await getAllBooks();
    setBooks(list);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const type = file.name.endsWith('.epub') ? 'epub' : 'txt';
    // 簡單檔名處理，實際可做更複雜解析
    const title = file.name.replace(/\.(epub|txt)$/i, ''); 
    
    await addBook(file, title, type);
    loadBooks();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">我的書架</h1>
        
        {/* 上傳區塊 */}
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-100 mb-8 transition">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">點擊或拖曳上傳 (TXT/EPUB)</p>
            </div>
            <input type="file" className="hidden" accept=".epub,.txt" onChange={handleFileUpload} />
        </label>

        {/* 書籍列表 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {books.map((book) => (
            <div 
              key={book.id} 
              onClick={() => navigate(`/read/${book.id}`)}
              className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition border border-gray-100"
            >
              <div className="h-32 bg-gray-200 rounded-md mb-3 flex items-center justify-center">
                <BookOpen className="text-gray-400 w-10 h-10" />
              </div>
              <h3 className="font-medium text-gray-900 truncate">{book.title}</h3>
              <p className="text-xs text-gray-500 mt-1">進度: {book.progress || 0}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}