/**
 * Durable, non-secret customer data.
 *
 * The application never treats this repository as a business authority. It is
 * only for recovery and continuity: drafts, recent searches, viewed places,
 * guest saves and opaque public tracking references. IndexedDB is used on the
 * Web and inside the Capacitor WebView; a native SQLite adapter can replace
 * this implementation without changing screen/domain code.
 */

export interface LocalStoreSnapshot {
  slug: string;
  name: string;
  area: string;
  category: string;
  imageUrl?: string | null;
}

export interface ViewedStoreRecord extends LocalStoreSnapshot {
  viewedAt: number;
}

export interface FavoriteStoreRecord extends LocalStoreSnapshot {
  savedAt: number;
}

export interface LocalOrderRecord {
  id: string;
  storeCode: string;
  storeName: string;
  trackingToken: string;
  orderNumber?: string;
  status?: string;
  createdAt: number;
}

export interface LocalReservationRecord {
  id: string;
  storeSlug: string;
  storeName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  partySize?: number;
  trackingToken?: string;
  createdAt: number;
}

export interface CartDraftRecord<T = unknown> {
  id: "cart";
  payload: T;
  updatedAt: number;
}

const databaseName = "aevo-go-local";
const databaseVersion = 1;
const storeNames = [
  "preferences",
  "recent-searches",
  "viewed-stores",
  "favorites",
  "orders",
  "reservations",
  "drafts"
] as const;
type StoreName = (typeof storeNames)[number];

const memoryStores = new Map<StoreName, Map<string, unknown>>(
  storeNames.map((name) => [name, new Map<string, unknown>()])
);

let databasePromise: Promise<IDBDatabase | null> | undefined;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function memoryStore(name: StoreName): Map<string, unknown> {
  return memoryStores.get(name) ?? new Map<string, unknown>();
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const name of storeNames) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, { keyPath: "id" });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return databasePromise;
}

async function readRecord<T>(name: StoreName, id: string): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return memoryStore(name).get(id) as T | undefined;

  return new Promise<T | undefined>((resolve) => {
    try {
      const transaction = database.transaction(name, "readonly");
      const request = transaction.objectStore(name).get(id);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => resolve(undefined);
      transaction.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function readRecords<T>(name: StoreName): Promise<T[]> {
  const database = await openDatabase();
  if (!database) return [...memoryStore(name).values()] as T[];

  return new Promise<T[]>((resolve) => {
    try {
      const transaction = database.transaction(name, "readonly");
      const request = transaction.objectStore(name).getAll();
      request.onsuccess = () => resolve((request.result ?? []) as T[]);
      request.onerror = () => resolve([]);
      transaction.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function writeRecord<T extends { id: string }>(name: StoreName, value: T): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    memoryStore(name).set(value.id, value);
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(name, "readwrite");
      transaction.objectStore(name).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteRecord(name: StoreName, id: string): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    memoryStore(name).delete(id);
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(name, "readwrite");
      transaction.objectStore(name).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function normalizeSearchTerm(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
}

export const localRepository = {
  async listRecentSearches(): Promise<string[]> {
    const records = await readRecords<{ id: string; term: string; searchedAt: number }>("recent-searches");
    return records
      .filter((record) => record.term)
      .sort((left, right) => right.searchedAt - left.searchedAt)
      .map((record) => record.term)
      .slice(0, 8);
  },

  async addRecentSearch(value: string): Promise<void> {
    const term = normalizeSearchTerm(value);
    if (!term) return;
    await writeRecord("recent-searches", { id: term.toLocaleLowerCase(), term, searchedAt: Date.now() });
    const records = await readRecords<{ id: string; searchedAt: number }>("recent-searches");
    const stale = records.sort((left, right) => right.searchedAt - left.searchedAt).slice(8);
    await Promise.all(stale.map((record) => deleteRecord("recent-searches", record.id)));
  },

  async saveViewedStore(store: LocalStoreSnapshot): Promise<void> {
    await writeRecord("viewed-stores", { ...store, id: store.slug, viewedAt: Date.now() });
  },

  async listViewedStores(): Promise<ViewedStoreRecord[]> {
    const records = await readRecords<ViewedStoreRecord & { id: string }>("viewed-stores");
    return records.sort((left, right) => right.viewedAt - left.viewedAt).slice(0, 8);
  },

  async saveFavorite(store: LocalStoreSnapshot): Promise<void> {
    await writeRecord("favorites", { ...store, id: store.slug, savedAt: Date.now() });
  },

  async removeFavorite(slug: string): Promise<void> {
    await deleteRecord("favorites", slug);
  },

  async listFavorites(): Promise<FavoriteStoreRecord[]> {
    const records = await readRecords<FavoriteStoreRecord & { id: string }>("favorites");
    return records.sort((left, right) => right.savedAt - left.savedAt);
  },

  async saveCartDraft<T>(payload: T): Promise<void> {
    await writeRecord("drafts", { id: "cart", payload, updatedAt: Date.now() });
  },

  async getCartDraft<T>(): Promise<CartDraftRecord<T> | undefined> {
    return readRecord<CartDraftRecord<T>>("drafts", "cart");
  },

  async clearCartDraft(): Promise<void> {
    await deleteRecord("drafts", "cart");
  },

  async saveOrder(record: Omit<LocalOrderRecord, "id"> & { id?: string }): Promise<void> {
    await writeRecord("orders", { ...record, id: record.id ?? record.trackingToken });
  },

  async listOrders(): Promise<LocalOrderRecord[]> {
    const records = await readRecords<LocalOrderRecord>("orders");
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, 20);
  },

  async saveReservation(record: LocalReservationRecord): Promise<void> {
    await writeRecord("reservations", record);
  },

  async listReservations(): Promise<LocalReservationRecord[]> {
    const records = await readRecords<LocalReservationRecord>("reservations");
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, 20);
  },

  async getPreference<T>(key: string): Promise<T | undefined> {
    const record = await readRecord<{ id: string; value: T }>("preferences", key);
    return record?.value;
  },

  async setPreference<T>(key: string, value: T): Promise<void> {
    await writeRecord("preferences", { id: key, value });
  },

  async removePreference(key: string): Promise<void> {
    await deleteRecord("preferences", key);
  }
};
