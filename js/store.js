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

    /* --- الخطّة والتركيز --------------------------------------------------
       كنّا نسجّل **ماذا** أنجز الطالب لا **متى**، فلا الروزنامة ولا الهدف
       الأسبوعي ممكنان من `lessons` وحده. هذه الحقول الثلاثة تسدّ ذلك، وكلّها
       محلّية بحتة: لا جدول ولا هجرة ولا مزامنة.

       ولا تُشتقّ من `outbox`: الطابور يُفرَّغ بعد الرفع، فتاريخُ النشاط
       يختفي مع أوّل مزامنة ناجحة. */
    activeDays: [],        // ['2026-08-09', …] الأيام التي درس فيها
    doneAt: {},            // lessonId → يوم الإنجاز، ليُعرف ما أُنجز اليوم
    focusMin: {},          // يوم → دقائق التركيز فيه
    pace: 'balanced',      // relaxed | balanced | intense — الاختيار الوحيد المطلوب

    // آخر شاشة نشطة — لاستئنافها بعد تحديث الصفحة بدل العودة إلى الرئيسية دائمًا
    route: null,

    // حالة الشبكة والمزامنة
    online: true,
    lastSync: null,
    /** طُردت الجلسة: دخل أحد بالحساب من جهاز آخر. */
    evicted: false,
    /**
     * إعدادات تشغيل من الخادم (جدول `app_config`) — مفتاح الإيقاف والإعلان.
     * الافتراضي «لا إيقاف»: بلا اتصال أو عند أي فشل قراءة يعمل التطبيق
     * طبيعيًّا. الاتجاه مقصود — عطلٌ في جدول الإعدادات يجب ألّا يحجب تطبيقًا
     * سليمًا عن طالب دفع ثمنه.
     */
    appConfig: { halted: false, notice: null, minVersion: null },
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
    /* محتوى مزامنة حقيقي سابق يبقى إلى الأبد لو لم يُمسح هنا أيضًا، فيستبدل
       SEED التجريبي بصمت عند كل إقلاع تالٍ — "إعادة ضبط" لا تُبقي أثرًا خفيًا.
       المحتوى انتقل إلى IndexedDB، فلا يكفي مسح مفاتيح localStorage القديمة:
       تركُ نسخة IndexedDB يعني إعادة ضبطٍ لا تُعيد ضبط شيء. */
    localStorage.removeItem('manhaji.content.v1');
    localStorage.removeItem('manhaji.idmap.v1');
    localStorage.removeItem('manhaji.content.ver');
    if (window.Sync?.clearContent) Sync.clearContent();
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

  /* --- يوم النشاط -------------------------------------------------------
     المفتاح **بالتوقيت المحلّي** لا `toISOString()`: الأخير يعطي UTC، فطالبٌ
     يدرس بعد منتصف الليل بتوقيت دمشق يُسجَّل نشاطه في يوم أمس — فتظهر خانةٌ
     خضراء في اليوم الخطأ، وينكسر «هدف اليوم» عند من يدرس ليلًا. */
  function dayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** يسجّل اليوم يومَ نشاط. تُستدعى من كل فعلٍ دراسي حقيقي. */
  function markActive() {
    const k = dayKey();
    if (state.activeDays.includes(k)) return;
    /* سقفٌ لا تجميل: الحقل يُكتب في localStorage مع بقيّة الحالة، ومصفوفةٌ
       تنمو بلا حدّ تقترب من الحصّة مع السنين. أربعمئة يوم تغطّي موسمين. */
    set((s) => ({ activeDays: [...s.activeDays, k].slice(-400) }));
  }

  function completeLesson(id) {
    if (state.lessons[id] === 'done') return;
    set((s) => ({
      lessons: { ...s.lessons, [id]: 'done' },
      doneAt: { ...s.doneAt, [id]: dayKey() },
    }));
    markActive();
    enqueue({ entity: 'lesson', lessonId: id, status: 'done',
              at: new Date().toISOString() });
  }

  function startLesson(id) {
    markActive();                     // فتحُ درسٍ نشاطٌ ولو لم يُنجَز
    if (state.lessons[id]) return;
    set((s) => ({ lessons: { ...s.lessons, [id]: 'doing' } }));
  }

  /** دقائق جلسة تركيز منتهية. تُحتسب لليوم وتجعله يومًا نشطًا. */
  function recordFocus(minutes) {
    const m = Math.max(0, Math.round(minutes || 0));
    if (!m) return;
    const k = dayKey();
    set((s) => ({ focusMin: { ...s.focusMin, [k]: (s.focusMin[k] || 0) + m } }));
    markActive();
  }

  function setPace(p) {
    if (!PACE[p]) return;
    set({ pace: p });
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

  /* =========================================================================
     الخطّة

     المبدأ الذي بُنيت عليه: **لا يُدخل الطالب شيئًا.** نعرف موادّه وعدد
     دروسها وكم يومًا بقي في اشتراكه، فنحسب له الوتيرة بدل أن نعطيه ورقة
     بيضاء. المُخطِّط الذي يملؤه المستخدم يبقى فارغًا عند أغلبهم — والقيمة
     المؤجَّلة خلف عملٍ فوريّ هي بعينها ما يقتل هذه الميزة في كل تطبيق.

     والصدق شرطٌ لا تجميل: إن كانت الوتيرة لا تكفي نقول ذلك صراحةً. توقّعٌ
     متفائل كاذب يُفقد الخطّة كلَّها ثقتها من أوّل أسبوع.
     ========================================================================= */
  /* الوتيرة **معدّلٌ مطلق** لا معاملٌ يُضرب في الأيام المتبقّية.
     الصياغة الأولى كانت تشتقّ الوتيرة من `daysLeft` ثم تسأل: أتكفي هذه
     الوتيرة قبل `daysLeft`؟ والجواب «نعم» دائمًا بحكم الحساب لا بحكم الواقع —
     دورةٌ مغلقة تجعل الاختيار زينةً والتوقّع تحصيلَ حاصل، وفرعُ «لا تكفي»
     شيفرةً ميتة لا تُرى أبدًا.
     بمعدّلٍ مطلق يصير للاختيار معنى: تختار كم درسًا في اليوم، ونقول لك بصدق
     إلى أين يوصلك ذلك. */
  const PACE = {
    relaxed:  { perDay: 1, label: 'مريح' },
    balanced: { perDay: 2, label: 'متوازن' },
    intense:  { perDay: 4, label: 'مكثّف' },
  };

  /** كل دروس المواد المشترَك بها، بترتيب المنهاج. */
  function planLessons() {
    const entitled = new Set((SEED.subjects || [])
      .filter((s) => s.entitled).map((s) => s.id));
    return (SEED.units || [])
      .filter((u) => entitled.has(u.subject))
      .flatMap((u) => (u.lessons || []).map((id) => ({ id, unit: u })));
  }

  function plan() {
    const s = state;
    const all = planLessons();
    const today = dayKey();

    const remaining = all.filter((x) => s.lessons[x.id] !== 'done');
    const doneToday = all.filter((x) => s.doneAt[x.id] === today);

    const days = Math.max(0, s.daysLeft || 0);
    const rate = (PACE[s.pace] || PACE.balanced).perDay;

    // لا نطلب أربعة دروس وقد بقي اثنان — الهدف لا يتجاوز ما تبقّى فعلًا
    const perDay = Math.min(rate, remaining.length);

    // قائمة اليوم: ما أُنجز اليوم أوّلًا (ليراه الطالب يمتلئ) ثم التالي
    const need = Math.max(0, perDay - doneToday.length);
    const upcoming = remaining.slice(0, need);

    // التوقّع: بهذه الوتيرة، كم يومًا نحتاج؟ وهل يسع الاشتراك ذلك؟
    let projection = null;
    if (remaining.length && perDay > 0) {
      const needDays = Math.ceil(remaining.length / perDay);
      projection = {
        needDays,
        margin: days > 0 ? days - needDays : null,   // موجب = تنتهي قبل الاشتراك
        enough: days > 0 ? needDays <= days : null,
      };
    }

    return {
      total: all.length,
      remaining: remaining.length,
      perDay,
      doneToday: doneToday.map((x) => x.id),
      todayIds: [...doneToday.map((x) => x.id), ...upcoming.map((x) => x.id)],
      metGoal: perDay > 0 && doneToday.length >= perDay,
      projection,
      pace: s.pace,
      paceLabel: (PACE[s.pace] || PACE.balanced).label,
    };
  }

  /**
   * الأسبوع الجاري من الأحد إلى السبت.
   *
   * الهدف **أسبوعي متسامح لا سلسلة تنكسر**: طالبٌ درس ستّة أيام ثم غاب يومًا
   * لظرف يخسر كل شيء في نظام السلسلة، فيترك التطبيق بعد أوّل انكسار. القياس
   * على الأسبوع كلّه يبقى قابلًا للتحقيق ولو غاب يومان.
   */
  const WEEK_GOAL = 5;
  function week() {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const names = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
    const todayK = dayKey();

    const days = names.map((label, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = dayKey(d);
      return { key, label, active: state.activeDays.includes(key),
               today: key === todayK, future: key > todayK };
    });

    const hit = days.filter((d) => d.active).length;
    return { days, hit, goal: WEEK_GOAL, met: hit >= WEEK_GOAL,
             minutes: days.reduce((n, d) => n + (state.focusMin[d.key] || 0), 0) };
  }

  /** شبكة شهر للروزنامة — تُبنى هنا لا في الشاشة كي تُفحص وحدها. */
  function month(year, m) {
    const first = new Date(year, m, 1);
    const days = new Date(year, m + 1, 0).getDate();
    const todayK = dayKey();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);   // فراغ ما قبل الأوّل
    for (let d = 1; d <= days; d++) {
      const key = dayKey(new Date(year, m, d));
      cells.push({ d, key, active: state.activeDays.includes(key),
                   today: key === todayK, minutes: state.focusMin[key] || 0 });
    }
    return { cells, activeCount: cells.filter((c) => c?.active).length };
  }

  return {
    get, set, subscribe, reset, signOut,
    enqueue, clearOutbox, pending,
    completeLesson, startLesson, recordAttempt, recordExam,
    toggleDownload, setTheme, toggleOnline,
    subjectProgress, unitProgress,
    dayKey, markActive, recordFocus, setPace, plan, week, month, PACE,
  };
})();
