export async function clearCaches({ clearSession = false }: { clearSession?: boolean } = {}) {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { }
  try {
    const anyIDB: any = indexedDB as any;
    if (typeof anyIDB.databases === "function") {
      const dbs = await anyIDB.databases();
      await Promise.all(dbs.map((d: any) => d?.name ? indexedDB.deleteDatabase(d.name) : undefined));
    } else {
      indexedDB.deleteDatabase("transformers-cache");
      indexedDB.deleteDatabase("model-cache");
    }
  } catch { }
  try {
    localStorage.clear();
    if (clearSession) sessionStorage.clear();
  } catch { }
}
