/* =============================================================================
   store.js — الحالة والتقدّم
   كل شيء يُقرأ ويُكتب محليًا. الشبكة (لاحقًا) تزامن هذه البيانات فقط.
   ============================================================================= */
window.Store = (function () {

  /**
   * ⚠️ ارفع الرقم عند أي تغيير يجعل الحالة المحفوظة سابقًا خاطئة لا ناقصة.
   *
   * رُفع إلى v2 يوم حُذف المحتوى التجريبي: التقدّم المحفوظ حينها كان مرتبطًا
   * بدروس ومواضيع وهمية (salutations، articles…) لا وجود لها في المحتوى
   * الحقيقي، فيبقى في الحساب إلى الأبد ويُضخّم مؤشر التقدّم بدروس لم تُدرَس.
   * تغيير المفتاح يُسقطها من كل جهاز مثبَّت مسبقًا بلا خطوة يدوية.
   */
  const KEY = 'manhaji.v2';

  // مفاتيح إصدارات سابقة — تُمسح مرة واحدة عند أول إقلاع بعد الترقية
  ['manhaji.v1'].forEach((old) => {
    try { localStorage.removeItem(old); } catch { /* وضع خاص/حصة ممتلئة */ }
  });

  /**
   * النموذج الأمني: لا بريد ولا كلمة مرور. الكود بمثابة كلمة السر،
   * و**الجلسة الواحدة النشطة** هي ما يمنع تداوله: الدخول من أي جهاز يُبطل
   * الجلسة السابقة فورًا، فيطرد المتقاسمان بعضهما في كل مرة.
   *
   * (ربط الجهاز كان النموذج السابق. تراجع دوره إلى سجلّ للدعم الفني لأن بصمة
   * المتصفح تُصفَّر بمسح بيانات الموقع، فلم تكن تمنع شيئًا فعليًا.)
   */
  const initial = () => ({
    // الحساب والاشتراك — لا بريد ولا كلمة مرور
    signedIn: false,
    activated: false,
    username: '',
    // ⚠️ لا تضع هنا قيَمًا «معقولة» لحقول يملؤها السيرفر. كانت
    // `grade: 'g9'` و `daysLeft: 283` مثبَّتتين ولا تُحدَّثان أبدًا، فكان كل
    // طالب يرى الصف التاسع مهما اشترى، ويرى مدّة اشتراك مختلَقة. القيمة
    // الفارغة تُظهر النقص فورًا؛ القيمة المعقولة تُخفيه إلى الأبد.
    // يملؤهما Sync.pullEntitlements من الاشتراك ومن المحتوى الواصل.
    grade: null,
    daysLeft: 0,

    // التفضيلات
    theme: 'light',

    // التقدّم: lessonId → 'done' | 'doing'
    lessons: {},
    // examId → { best, taken }
    exams: {},
    // الدروس المنزَّلة للاستخدام دون إنترنت
    downloaded: ['articles-definis'],

    // آخر شاشة نشطة — لاستئنافها بعد تحديث الصفحة بدل العودة إلى الرئيسية دائمًا
    route: null,

    // حالة الشبكة والمزامنة
    online: true,
    lastSync: null,
    /** طُردت الجلسة: دخل أحد بالحساب من جهاز آخر. */
    evicted: false,
    /**
     * امتلأت مساحة التخزين فتعذّر حفظ المحتوى المسحوب. التطبيق يظلّ يعمل
     * بالمحتوى القديم، لكن الجديد لا يصل — وهذا ما يجب أن يراه الطالب صراحةً
     * بدل محتوًى متجمّد بلا تفسير.
     */
    storageFull: false,
    /**
     * طابور الرفع. كل نشاط يُقيَّد هنا لحظة حدوثه ويبقى حتى يُؤكَّد وصوله.
     * عدم تفريغه لا يفقد شيئًا — يؤخّر ظهوره على السيرفر فقط.
     */
    outbox: [],
  });

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...initial(), ...JSON.parse(raw) } : initial();
    } catch { return initial(); }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* حصة ممتلئة */ }
  }

  function set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    persist();
    subs.forEach((fn) => fn(state));
  }

  const get = () => state;
  const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  function reset() {
    localStorage.removeItem(KEY);
    // محتوى مزامنة حقيقي سابق (sync.js: manhaji.content.v1/idmap.v1) يبقى
    // في localStorage إلى الأبد لو لم يُمسح هنا أيضًا، فيستبدل SEED التجريبي
    // بصمت عند كل إقلاع تالٍ — "إعادة ضبط" لا تُبقي أثرًا خفيًا كهذا.
    localStorage.removeItem('manhaji.content.v1');
    localStorage.removeItem('manhaji.idmap.v1');
    state = initial();
    subs.forEach((fn) => fn(state));
  }

  // ---------------------------------------------------------------------------
  // التقدّم
  // ---------------------------------------------------------------------------

  // --- طابور الرفع -----------------------------------------------------------
  let seq = 0;
  const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

  function enqueue(item) {
    set((s) => ({ outbox: [...s.outbox, { key: uid(), ...item }] }));
  }

  function clearOutbox(keys) {
    const done = new Set(keys);
    set((s) => ({ outbox: s.outbox.filter((x) => !done.has(x.key)) }));
  }

  const pending = () => state.outbox.length;

  function completeLesson(id) {
    if (state.lessons[id] === 'done') return;
    set((s) => ({ lessons: { ...s.lessons, [id]: 'done' } }));
    enqueue({ entity: 'lesson', lessonId: id, status: 'done',
              at: new Date().toISOString() });
  }

  function startLesson(id) {
    if (state.lessons[id]) return;
    set((s) => ({ lessons: { ...s.lessons, [id]: 'doing' } }));
  }

  /** تسجيل محاولة سؤال. المعرّف يولّده العميل ⇒ إعادة الإرسال بعد انقطاع لا
   *  تُنشئ صفًا مكررًا. */
  function recordAttempt(isCorrect, questionId, kind = 'practice') {
    if (questionId) {
      enqueue({ entity: 'attempt', id: crypto.randomUUID(), questionId,
                correct: isCorrect, kind, at: new Date().toISOString() });
    }
  }

  function recordExam(examId, percent) {
    set((s) => {
      const prev = s.exams[examId] || { best: 0, taken: 0 };
      return {
        exams: {
          ...s.exams,
          [examId]: { best: Math.max(prev.best, percent), taken: prev.taken + 1 },
        },
      };
    });
    enqueue({ entity: 'exam', id: crypto.randomUUID(), examId, percent,
              at: new Date().toISOString() });
  }

  function toggleDownload(lessonId) {
    set((s) => ({
      downloaded: s.downloaded.includes(lessonId)
        ? s.downloaded.filter((x) => x !== lessonId)
        : [...s.downloaded, lessonId],
    }));
  }

  /**
   * الخروج المحلي فقط — لا يمسّ الجلسة على السيرفر ولا التقدّم.
   *
   * التقدّم يبقى عمدًا: قد يحمل الطابور نشاطًا لم يُرفع بعد، وسيُرسل فور
   * الدخول التالي. مسحه هنا يعني ضياعه بلا سبب.
   *
   * وإبطال الجلسة على السيرفر لا يحدث هنا بل عند **الدخول التالي** من أي
   * جهاز — فذلك ما يولّد معرّف جلسة جديدًا يُبطل ما قبله.
   */
  function signOut() {
    set({ signedIn: false, activated: false, evicted: false });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  }

  function toggleOnline() {
    set((s) => ({ online: !s.online, pendingSync: !s.online ? 0 : s.pendingSync }));
  }

  /**
   * مؤشر تقدّم مادة واحدة بعينها (كل مواد الطالب مبنية هيك بعد إزالة طبقة
   * الكورسات — لا حاجة لدالة عالمية منفصلة تجمع كل الدروس بلا تفريق).
   *
   * بعدان، بنسبة ٥٠:١٥ الأصلية موزَّعة على المجموع ١٠٠ بعد إلغاء بُعد إتقان
   * المواضيع:
   *   الدروس     (٧٥٪) — كل درس = فيديو + نص؛ إتمامه يعني مشاهدته
   *   الامتحانات (٢٥٪) — أفضل نتيجة بين امتحانات نفس المادة (والصف ضمنيًا،
   *                       لأن المزامنة لا تجلب غير محتوى صف الطالب أصلًا)
   *
   * لماذا الحصر ضروري لا رفاهية: بلا هذا الحصر، إكمال درس في مادة الفرنسي
   * كان يرفع رقمًا واحدًا يُعرض على بطاقة كل مادة أخرى أيضًا — أرقام كاذبة
   * فور وجود أكثر من مادة مشترَك بها.
   */
  function subjectProgress(subjectCode) {
    const lessonIds = (SEED.units || [])
      .filter((u) => u.subject === subjectCode)
      .flatMap((u) => u.lessons || []);

    const done = lessonIds.filter((id) => state.lessons[id] === 'done').length;
    const lessonPct = lessonIds.length ? (done / lessonIds.length) * 100 : 0;

    const subjectExams = (SEED.exams || []).filter((e) => e.subject === subjectCode);
    const examScores = subjectExams.map((e) => state.exams[e.id]?.best || 0);
    const bestExam = examScores.length ? Math.max(...examScores) : 0;

    const pct = 0.75 * lessonPct + 0.25 * bestExam;
    return {
      percent: Math.max(0, Math.min(100, Math.round(pct))),
      lessonsDone: done, lessonsTotal: lessonIds.length,
      lessonPct: Math.round(lessonPct),
      bestExam: Math.round(bestExam),
    };
  }

  function unitProgress(unit) {
    const done = unit.lessons.filter((id) => state.lessons[id] === 'done').length;
    return { done, total: unit.lessons.length,
             pct: unit.lessons.length ? (done / unit.lessons.length) * 100 : 0 };
  }

  return {
    get, set, subscribe, reset, signOut,
    enqueue, clearOutbox, pending,
    completeLesson, startLesson, recordAttempt, recordExam,
    toggleDownload, setTheme, toggleOnline,
    subjectProgress, unitProgress,
  };
})();
