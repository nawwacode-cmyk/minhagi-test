/* =============================================================================
   blobstore.js — تخزين الكتل الكبيرة (المحتوى المزامَن) على الجهاز

   لماذا لا localStorage؟ حصّته ~٥ م.ب، ويخزّن UTF-16 أي **بايتان لكل حرف
   عربي**. مادة واحدة ≈ ٠٫٩ م.ب نصًّا فتشغل ~١٫٥ م.ب: الجدار عند ثلاث مواد.
   بكالوريا وتاسع معًا يتجاوزانه بأضعاف.

   وIndexedDB يكسب مرّتين لا مرّة:
     · الحصّة بمئات الميغابايت بدل خمسة.
     · يخزّن **الكائن نفسه** (structured clone) لا نصًّا، فلا JSON.stringify
       عند كل حفظ ولا JSON.parse عند كل إقلاع — ولا مضاعفة UTF-16.

   والكتابة غير متزامنة، فلا تُجمّد الواجهة كما كان setItem بمليون حرف يفعل.

   السقوط إلى localStorage مقصود لا تجميل: بعض المتصفّحات تمنع IndexedDB في
   التصفّح الخاص. الطالب هناك يبقى محدودًا بخمسة ميغابايت — لكنه يعمل.
   ============================================================================= */
window.Blob2 = (function () {
  const DB = 'manhaji';
  const STORE = 'blobs';
  const VERSION = 1;

  let dbp = null;                 // وعد فتح القاعدة، يُنشأ مرّة
  let usable = null;              // null = لم نجرّب بعد · true/false = النتيجة

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB, VERSION); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexeddb blocked'));
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }

  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.onabort = t.onerror = () => reject(t.error || new Error('idb tx failed'));
      t.oncomplete = () => resolve(req ? req.result : undefined);
    });
  };

  /** هل IndexedDB صالح للاستعمال فعلًا؟ نجرّبه مرّة بدل أن نفترضه. */
  async function available() {
    if (usable !== null) return usable;
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no idb');
      await open();
      usable = true;
    } catch { usable = false; }
    return usable;
  }

  // --- بديل localStorage عند غياب IndexedDB -----------------------------------
  const lsKey = (k) => `manhaji.blob.${k}`;
  const lsGet = (k) => {
    const raw = localStorage.getItem(lsKey(k));
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const lsSet = (k, v) => localStorage.setItem(lsKey(k), JSON.stringify(v));
  const lsDel = (k) => localStorage.removeItem(lsKey(k));

  async function get(key) {
    if (await available()) {
      try { return (await tx('readonly', (s) => s.get(key))) ?? null; }
      catch { return null; }
    }
    return lsGet(key);
  }

  /** يرمي عند امتلاء المساحة — المنادي هو من يقرّر ماذا يفعل بذلك. */
  async function set(key, value) {
    if (await available()) { await tx('readwrite', (s) => s.put(value, key)); return; }
    lsSet(key, value);
  }

  async function del(key) {
    if (await available()) { try { await tx('readwrite', (s) => s.delete(key)); } catch { /* لا شيء */ } }
    lsDel(key);
  }

  /**
   * ترحيل لمرّة واحدة من مفاتيح localStorage القديمة.
   *
   * يُنقل ولا يُنسخ: تركُ النسخة القديمة يعني أن ٥ م.ب تبقى محجوزة بلا فائدة،
   * وأن إقلاعًا لاحقًا قد يقرأ القديم فيتجاهل الجديد. ولا نحذف القديم إلّا
   * **بعد** نجاح الكتابة — انقطاعُ الكهرباء بينهما يجب ألّا يفقد محتوى الطالب.
   */
  async function migrate(pairs) {
    let moved = 0;
    for (const [oldKey, newKey] of pairs) {
      const raw = localStorage.getItem(oldKey);
      if (raw === null) continue;
      let value;
      try { value = JSON.parse(raw); } catch { localStorage.removeItem(oldKey); continue; }
      try { await set(newKey, value); localStorage.removeItem(oldKey); moved++; }
      catch { /* المساحة أو IDB معطّل — نُبقي القديم كما هو */ }
    }
    return moved;
  }

  return { get, set, del, migrate, available };
})();
