/* =============================================================================
   store.js — الحالة والتقدّم
   كل شيء يُقرأ ويُكتب محليًا. الشبكة (لاحقًا) تزامن هذه البيانات فقط.
   ============================================================================= */
window.Store = (function () {

  const KEY = 'manhaji.v1';

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
    grade: 'g9',
    daysLeft: 283,

    // التفضيلات
    theme: 'light',

    // التقدّم: lessonId → 'done' | 'doing'
    lessons: {},
    // topicId → { mastery, total, correct }
    mastery: {},
    // examId → { best, taken }
    exams: {},
    // الدروس المنزَّلة للاستخدام دون إنترنت
    downloaded: ['articles-definis'],

    // حالة الشبكة والمزامنة
    online: true,
    lastSync: null,
    /** طُردت الجلسة: دخل أحد بالحساب من جهاز آخر. */
    evicted: false,
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

  /**
   * تسجيل محاولة سؤال + تحديث إتقان الموضوع.
   *
   * المعادلة مطابقة حرفيًا لـ tg_apply_topic_mastery في السيرفر:
   *     mastery = round(0.7 × القديم + 0.3 × (صحيح ? 100 : 0))
   * البداية 50 محايدة — أول إجابة صحيحة ترفع إلى 65، وأول خطأ ينزل إلى 35.
   * أي اختلاف بين الاثنين يجعل المؤشر يقفز عند عودة الإنترنت.
   */
  function recordAttempt(topicId, isCorrect, questionId, kind = 'practice') {
    if (topicId) {
      set((s) => {
        const prev = s.mastery[topicId] || { mastery: 50, total: 0, correct: 0 };
        const next = Math.round(0.7 * prev.mastery + 0.3 * (isCorrect ? 100 : 0));
        return {
          mastery: {
            ...s.mastery,
            [topicId]: {
              mastery: Math.max(0, Math.min(100, next)),
              total: prev.total + 1,
              correct: prev.correct + (isCorrect ? 1 : 0),
            },
          },
        };
      });
    }
    // المعرّف يولّده العميل ⇒ إعادة الإرسال بعد انقطاع لا تُنشئ صفًا مكررًا
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

  // ---------------------------------------------------------------------------
  // مؤشر التقدّم — نفس أوزان v_subject_progress على السيرفر
  //   0.50 دروس مكتملة + 0.35 متوسط الإتقان + 0.15 أفضل امتحان
  // ---------------------------------------------------------------------------
  function subjectProgress() {
    const all = Object.keys(SEED.lessons);
    const done = all.filter((id) => state.lessons[id] === 'done').length;
    const lessonPct = all.length ? (done / all.length) * 100 : 0;

    const ms = Object.values(state.mastery);
    const masteryAvg = ms.length ? ms.reduce((a, m) => a + m.mastery, 0) / ms.length : 0;

    const bests = Object.values(state.exams).map((e) => e.best);
    const bestExam = bests.length ? Math.max(...bests) : 0;

    const pct = 0.50 * lessonPct + 0.35 * masteryAvg + 0.15 * bestExam;
    return {
      percent: Math.max(0, Math.min(100, Math.round(pct))),
      lessonsDone: done, lessonsTotal: all.length,
      lessonPct: Math.round(lessonPct),
      masteryAvg: Math.round(masteryAvg),
      bestExam: Math.round(bestExam),
    };
  }

  function unitProgress(unit) {
    const done = unit.lessons.filter((id) => state.lessons[id] === 'done').length;
    return { done, total: unit.lessons.length,
             pct: unit.lessons.length ? (done / unit.lessons.length) * 100 : 0 };
  }

  /** أضعف موضوع مُمارَس — يغذّي اقتراح «نقطة ضعفك الآن» */
  function weakestTopic() {
    const rows = SEED.topics
      .map((t) => ({ ...t, ...(state.mastery[t.id] || { mastery: null }) }))
      .filter((t) => t.mastery !== null);
    if (!rows.length) return null;
    return rows.sort((a, b) => a.mastery - b.mastery)[0];
  }

  return {
    get, set, subscribe, reset, signOut,
    enqueue, clearOutbox, pending,
    completeLesson, startLesson, recordAttempt, recordExam,
    toggleDownload, setTheme, toggleOnline,
    subjectProgress, unitProgress, weakestTopic,
  };
})();
