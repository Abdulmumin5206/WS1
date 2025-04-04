import { openDB, IDBPDatabase, StoreNames, IDBPObjectStore } from 'idb';

interface StoredImage {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
  timestamp: number;
}

const DB_NAME = 'ReportBuilderImagesDB';
const STORE_NAME = 'images';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

let db: IDBPDatabase | null = null;

async function getDB() {
  if (!db) {
    db = await openDB(DB_NAME, 1, {
      upgrade(database: IDBPDatabase) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('size', 'size');
        }
      },
    });
  }
  return db;
}

export async function storeImage(
  id: string,
  url: string,
  width: number,
  height: number,
  size: number
): Promise<void> {
  const db = await getDB();
  const image: StoredImage = {
    id,
    url,
    width,
    height,
    size,
    timestamp: Date.now(),
  };
  
  await db.put(STORE_NAME, image);
  await cleanupCache();
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const db = await getDB();
  const image = await db.get(STORE_NAME, id);
  
  if (image) {
    // Update timestamp to mark as recently used
    await db.put(STORE_NAME, {
      ...image,
      timestamp: Date.now(),
    });
  }
  
  return image;
}

export async function removeImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

async function cleanupCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  // Get all images
  const images = await store.getAll();
  
  // Calculate total size
  let totalSize = images.reduce((sum: number, img: StoredImage) => sum + img.size, 0);
  
  // Sort by timestamp (oldest first)
  images.sort((a: StoredImage, b: StoredImage) => a.timestamp - b.timestamp);
  
  const now = Date.now();
  
  // Remove old or excess images
  for (const image of images) {
    if (totalSize > MAX_CACHE_SIZE || (now - image.timestamp) > MAX_CACHE_AGE) {
      await store.delete(image.id);
      totalSize -= image.size;
    } else {
      break;
    }
  }
  
  await tx.done;
}

export async function getCacheStats(): Promise<{
  totalSize: number;
  imageCount: number;
  oldestImage: number;
}> {
  const db = await getDB();
  const images = await db.getAll(STORE_NAME);
  
  return {
    totalSize: images.reduce((sum: number, img: StoredImage) => sum + img.size, 0),
    imageCount: images.length,
    oldestImage: images.length > 0 
      ? Math.min(...images.map((img: StoredImage) => img.timestamp))
      : Date.now()
  };
} 