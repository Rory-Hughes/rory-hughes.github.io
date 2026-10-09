export function createBrowserDraftStore(getStorage) {
  const memory = new Map();
  let storageAvailable = true;

  return {
    read(key) {
      if (memory.has(key)) {
        return { value: memory.get(key), storageAvailable };
      }

      try {
        const value = getStorage().getItem(key);
        storageAvailable = true;
        return { value, storageAvailable };
      } catch {
        storageAvailable = false;
        return { value: null, storageAvailable };
      }
    },

    retain(key, value) {
      memory.set(key, value);
    },

    write(key, value) {
      memory.set(key, value);
      try {
        getStorage().setItem(key, value);
        storageAvailable = true;
        return { saved: true, storageAvailable };
      } catch {
        storageAvailable = false;
        return { saved: false, storageAvailable };
      }
    },

    clear(key) {
      memory.delete(key);
      try {
        getStorage().removeItem(key);
        storageAvailable = true;
        return { cleared: true, storageAvailable };
      } catch {
        storageAvailable = false;
        return { cleared: false, storageAvailable };
      }
    },
  };
}
