window.StorageRepository = (() => {
  const get = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const remove = (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  };

  const getList = (key) => get(key, []);

  const setList = (key, list) => set(key, list);

  const updateList = (key, updater) => {
    const list = getList(key);
    const updated = updater(list);
    return setList(key, updated);
  };

  return Object.freeze({ get, set, remove, getList, setList, updateList });
})();
