/** The browser library: one record per project (its rfnm/1 JSON) and the id of the current one (spec §9). */
export interface LibraryEntry { id: string; name: string; savedAt: string; json: string }

const DB = 'rf-network-modeller';
const PROJECTS = 'projects';
const META = 'meta';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PROJECTS, { keyPath: 'id' });
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('the browser refused to open its project store'));
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    const fail = (): void => {
      db.close();
      reject(t.error ?? new Error('the browser could not save the project'));
    };
    t.onerror = fail;
    t.onabort = fail;
  });
}

export const putProject = (e: LibraryEntry): Promise<IDBValidKey> => tx(PROJECTS, 'readwrite', (s) => s.put(e));
export const getProject = (id: string): Promise<LibraryEntry | undefined> => tx(PROJECTS, 'readonly', (s) => s.get(id) as IDBRequest<LibraryEntry | undefined>);
export const setCurrentId = (id: string): Promise<IDBValidKey> => tx(META, 'readwrite', (s) => s.put(id, 'current'));
export const getCurrentId = (): Promise<string | undefined> => tx(META, 'readonly', (s) => s.get('current') as IDBRequest<string | undefined>);
export const listProjects = (): Promise<LibraryEntry[]> => tx(PROJECTS, 'readonly', (s) => s.getAll() as IDBRequest<LibraryEntry[]>);
