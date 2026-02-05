import { openDB } from 'idb';

const DB_NAME = 'WebReaderDB';
const STORE_NAME = 'books';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // id 為主鍵，自動生成
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title', 'title', { unique: false });
      }
    },
  });
};

export const addBook = async (file, title, type) => {
  const db = await initDB();
  return db.add(STORE_NAME, {
    title,
    data: file, // 儲存 Blob/File 物件
    type,       // 'epub' 或 'txt'
    progress: 0, // 閱讀進度
    createdAt: new Date(),
  });
};

export const getAllBooks = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const getBook = async (id) => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const updateProgress = async (id, progress) => {
    const db = await initDB();
    const book = await db.get(STORE_NAME, id);
    if(book) {
        book.progress = progress;
        await db.put(STORE_NAME, book);
    }
}