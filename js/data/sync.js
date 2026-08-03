/* =============================================================================
   sync.js — سحب المحتوى ورفع التقدّم

   المبدأ: التطبيق يقرأ **دائمًا** من المخزون المحلي، لا من الشبكة. هذه الطبقة
   تملأ ذلك المخزون في الخلفية وتستنزف طابور التقدّم. لا شاشة تنتظر شبكة.

   ترجمة المعرّفات: السيرفر يعمل بـ UUID والتطبيق يعمل بالرموز (`salutations`،
   `u1`، `q-art-1`). الترجمة تحدث هنا وحدها، فتبقى الشاشات بسيطة ويبقى
   المخزون المحلي مقروءًا عند التنقيح.
   ============================================================================= */
window.Sync = (function () {

  const CONTENT_KEY = 'manhaji.content.v1';
  const IDMAP_KEY   = 'manhaji.idmap.v1';

  /**
   * وضع المعاينة — `index.html?demo=1`.
   *
   * سببه أن المحتوى المزامَن يستبدل SEED كليًا عند كل إقلاع (applyStored)، فما
   * إن يزامن الجهاز مرة واحدة حتى يصير من المستحيل معاينة الواجهة ببيانات
   * seed.js التجريبية — تُعدَّل فلا يظهر أثرها، ويبدو الأمر كأنه عطل في الحفظ
   * أو الكاش. هذا العَلم يقطع ذلك: SEED كما هو في الملف، ولا سحب محتوى إطلاقًا.
   */
  const DEMO = new URLSearchParams(location.search).has('demo');

  // ---------------------------------------------------------------------------
  // ترجمة أنواع الأسئلة
  // ---------------------------------------------------------------------------
  const TYPE_MAP = {
    mcq: 'mcq', multi_select: 'multi', fill_blank: 'blank',
    reorder: 'order', match: 'match', short_text: 'text',
  };

  /** الأنواع التي يعرف `questionCard` رسمها. البقية تُستبعد بدل أن تظهر مكسورة. */
  const SUPPORTED = new Set(['mcq', 'multi', 'blank', 'order']);

  const AR_KEYS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

  // ---------------------------------------------------------------------------
  // سحب المحتوى
  // ---------------------------------------------------------------------------
  async function pullContent() {
    // كل شيء بتوكن المستخدم ⇒ RLS تحصر الناتج باشتراكه. لا فلترة أمنية هنا.
    const [subjects, grades, courses, teachers, units, lessons,
           questions, options, exams, examQuestions, videos] = await Promise.all([
      Api.from('subjects',  { select: 'id,code,name_ar,name_native,color_hex,sort_order' }),
      Api.from('grades',    { select: 'id,code,name_ar,sort_order' }),
      Api.from('courses',   { select: 'id,code,title_ar,subject_id,grade_id,teacher_id' }),
      Api.from('teachers',  { select: 'id,name' }).catch(() => []),
      Api.from('units',     { select: 'id,code,title_ar,course_id,sort_order', order: 'sort_order' }),
      Api.from('lessons',   { select: 'id,code,title_ar,body_html,est_minutes,is_free,unit_id,video_id,sort_order', order: 'sort_order' }),
      Api.from('questions', { select: 'id,code,type,stem_md,passage_md,answer_key,difficulty,explanation_md,lesson_id,section,unit_code' }),
      Api.from('question_options', { select: 'id,question_id,code,text_md,is_correct,sort_order', order: 'sort_order' }),
      Api.from('exams',     { select: 'id,code,title_ar,kind,duration_minutes,pass_percent,subject_id,grade_id,sort_order', order: 'sort_order' }),
      Api.from('exam_questions', { select: 'exam_id,question_id,sort_order,points' }),
      Api.from('videos',    { select: 'id,title,quality,duration_s,size_bytes' }).catch(() => []),
    ]);

    // --- خرائط الترجمة ---
    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const L = byId(lessons), Q = byId(questions), V = byId(videos || []);
    const idMap = {};                       // 'lesson:salutations' → uuid
    const put = (kind, code, id) => { idMap[`${kind}:${code}`] = id; };

    lessons.forEach((l) => put('lesson', l.code, l.id));
    questions.forEach((q) => put('question', q.code, q.id));
    exams.forEach((e) => put('exam', e.code, e.id));

    // --- الأسئلة ---
    const optsByQ = {};
    options.forEach((o) => (optsByQ[o.question_id] = optsByQ[o.question_id] || []).push(o));

    const mappedQuestions = {};
    let skipped = 0;
    for (const q of questions) {
      const type = TYPE_MAP[q.type] || q.type;
      if (!SUPPORTED.has(type)) { skipped++; continue; }

      const out = {
        id: q.code, type,
        lesson: L[q.lesson_id]?.code || null,
        // تبويب «تمارين» عند الطالب: مفردات · قاعدة · ترتيب حوار · مواضيع
        // الوحدة. null = لم يصنَّفه المدرّس بعد، فلا يظهر في أي قسم تصفّح —
        // يبقى في القاعدة المحلية بلا أثر حتى يُصنَّف ويصل في مزامنة لاحقة.
        section: q.section || null,
        // تفريع «سلايد الأقسام» بحسب الوحدة — راجع UNIT_THEME/UNIT_GRAMMAR
        // في screens/course.js. نفس رمز u1..u6 يُعرض باسم مختلف حسب section.
        unitCode: q.unit_code || null,
        difficulty: q.difficulty,
        stem: q.stem_md,
        passage: q.passage_md || null,
        why: q.explanation_md || '',
      };

      if (type === 'mcq' || type === 'multi') {
        out.options = (optsByQ[q.id] || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o, i) => ({ k: AR_KEYS[i] || String(i + 1), t: o.text_md, correct: o.is_correct }));

      } else if (type === 'blank') {
        // النصّ يحمل علامات ___ ؛ نشتقّ منها بنية الفراغات بدل تخزينها مرتين
        const segs = String(q.stem_md).split('___');
        out.parts = [];
        segs.forEach((s, i) => {
          if (s) out.parts.push(s);
          if (i < segs.length - 1) out.parts.push({ blank: i });
        });
        const accepts = (q.answer_key?.blanks) || [];
        out.blanks = accepts.map((acc) => ({ accept: acc, choices: acc }));
        out.stem = 'أكمل الفراغات:';

      } else if (type === 'order') {
        out.answer = q.answer_key?.order || [];
      }

      mappedQuestions[q.code] = out;
    }
    if (skipped) console.info(`sync: استُبعد ${skipped} سؤالًا بأنواع غير مدعومة بعد`);

    // --- الوحدات والدروس ---
    const unitLessons = {};
    lessons.forEach((l) => (unitLessons[l.unit_id] = unitLessons[l.unit_id] || []).push(l));

    const lessonQuestions = {};
    Object.values(mappedQuestions).forEach((q) => {
      if (q.lesson) (lessonQuestions[q.lesson] = lessonQuestions[q.lesson] || []).push(q.id);
    });

    // --- الكورسات: وحدة الوصول الفعلية، لا المادة -----------------------------
    // `courses` مرئية للجميع (كتالوج) بفضل RLS، بينما `units` تصل فقط لمن
    // يملك صلاحية الكورس. لذلك: «الكورس عنده وحدات وصلتنا» = مشترَك فيه فعلًا.
    // هذا الحساب هو الفرق بين كتالوج صادق وكتالوج يعرض كل شيء «مفتوحًا».
    const subjectByUuid = byId(subjects), gradeByUuid = byId(grades);
    const teacherByUuid = byId(teachers || []);
    const entitledCourseIds = new Set(units.map((u) => u.course_id));

    const content = {
      pulledAt: new Date().toISOString(),

      subjects: subjects.map((s) => ({
        id: s.code, name: s.name_ar, native: s.name_native,
        cover: s.code === 'fr' ? 'assets/img/cover-fr.jpg' : null,
      })),
      grades: grades.sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({ id: g.code, name: g.name_ar, note: '' })),

      /**
       * الكتالوج الكامل — يشمل كورسات لا يملكها الطالب، لعرضها في شاشة الكورسات.
       * اسم الأستاذ يظهر هنا سواء كان من فريقنا أو أستاذًا متعاقَدًا خارجيًا؛
       * التطبيق لا يفرّق بينهما — الفرق تجاري (نسبة الأرباح) لا تقني، ويُدار
       * خارج المخطط بلا حاجة لأي تمييز في البيانات.
       */
      courses: courses.map((c) => ({
        id: c.code, title: c.title_ar,
        subject: subjectByUuid[c.subject_id]?.code || null,
        grade: gradeByUuid[c.grade_id]?.code || null,
        teacher: teacherByUuid[c.teacher_id]?.name || null,
        entitled: entitledCourseIds.has(c.id),
      })),

      units: units.map((u) => {
        const course = courses.find((c) => c.id === u.course_id);
        return {
          id: u.code, title: u.title_ar, course: course?.code || null,
          lessons: (unitLessons[u.id] || []).sort((a, b) => a.sort_order - b.sort_order)
            .map((l) => l.code),
        };
      }),

      lessons: Object.fromEntries(lessons.map((l) => [l.code, {
        id: l.code, title: l.title_ar, minutes: l.est_minutes, free: l.is_free,
        body: l.body_html || '',
        video: l.video_id && V[l.video_id]
          ? { id: l.video_id, title: V[l.video_id].title,
              length: fmtDuration(V[l.video_id].duration_s), thumb: 'assets/img/video-thumb.svg' }
          : { title: l.title_ar, length: '—', thumb: 'assets/img/video-thumb.svg' },
        exercises: lessonQuestions[l.code] || [],
      }])),

      questions: mappedQuestions,

      // subject/grade — لا course_id: الامتحان الوزاري مشترَك عمدًا بين كل
      // كورسات نفس المادة والصف مهما اختلف الأستاذ، فيُربط بالمستوى الأعلى
      // لا بكورس بعينه. هذا ما يمكّن courseProgress من حصر أفضل نتيجة امتحان
      // بمادة الكورس تحديدًا بدل خلطها بامتحانات مواد أخرى.
      exams: exams.map((e) => ({
        id: e.code, kind: { past_paper: 'ministry', unit_test: 'unit' }[e.kind] || e.kind,
        title: e.title_ar, minutes: e.duration_minutes, pass: e.pass_percent,
        subject: subjectByUuid[e.subject_id]?.code || null,
        grade: gradeByUuid[e.grade_id]?.code || null,
        questions: examQuestions.filter((x) => x.exam_id === e.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((x) => Q[x.question_id]?.code)
          .filter((c) => c && mappedQuestions[c]),
      })),
    };

    localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
    localStorage.setItem(IDMAP_KEY, JSON.stringify(idMap));
    return content;
  }

  const fmtDuration = (s) =>
    !s ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ---------------------------------------------------------------------------
  // تطبيق المحتوى على التطبيق
  // ---------------------------------------------------------------------------

  /**
   * يستبدل `SEED` بالمحتوى المسحوب.
   * الشاشات تقرأ `SEED` كما هي بلا أي تعديل — لذلك اخترنا مطابقة الشكل تمامًا
   * في التحويل أعلاه بدل تغيير عشرات المواضع في الواجهة.
   */
  function applyStored() {
    if (DEMO) return false;
    try {
      const raw = localStorage.getItem(CONTENT_KEY);
      if (!raw) return false;
      const c = JSON.parse(raw);
      if (!c.lessons || !Object.keys(c.lessons).length) return false;
      window.SEED = c;
      return true;
    } catch { return false; }
  }

  const idOf = (kind, code) => {
    try { return JSON.parse(localStorage.getItem(IDMAP_KEY) || '{}')[`${kind}:${code}`] || null; }
    catch { return null; }
  };

  /** العكس: uuid ← رمز. نبنيه عند الحاجة لأن سحب التقدّم يعود بمعرّفات السيرفر. */
  function reverseMap(kind) {
    const out = {};
    try {
      const map = JSON.parse(localStorage.getItem(IDMAP_KEY) || '{}');
      for (const [k, uuid] of Object.entries(map)) {
        const [t, code] = k.split(':');
        if (t === kind) out[uuid] = code;
      }
    } catch { /* خريطة فارغة */ }
    return out;
  }

  // ---------------------------------------------------------------------------
  // رفع التقدّم
  // ---------------------------------------------------------------------------

  /**
   * يستنزف طابور التقدّم.
   *
   * محاولات الأسئلة append-only بمعرّف يولّده العميل، فإعادة إرسالها بعد
   * انقطاع آمنة تمامًا (`ignoreDuplicates`). أما تقدّم الدروس فـ Last-Write-Wins
   * على `client_updated_at`.
   */
  async function pushProgress() {
    const queue = Store.get().outbox || [];
    if (!queue.length || !Api.isSignedIn()) return { sent: 0, failed: 0 };

    const uid = Api.userId();
    let sent = 0, failed = 0;
    const done = new Set();

    for (const item of queue.slice(0, 100)) {
      try {
        if (item.entity === 'attempt') {
          const qid = idOf('question', item.questionId);
          if (!qid) { done.add(item.key); continue; }   // سؤال لم يعد موجودًا
          await Api.upsert('question_attempts', {
            id: item.id, user_id: uid, question_id: qid,
            is_correct: item.correct, attempted_at: item.at,
            session_kind: item.kind || 'practice',
          }, { ignoreDuplicates: true });

        } else if (item.entity === 'lesson') {
          const lid = idOf('lesson', item.lessonId);
          if (!lid) { done.add(item.key); continue; }
          await Api.upsert('lesson_progress', {
            user_id: uid, lesson_id: lid, status: item.status,
            completed_at: item.status === 'done' ? item.at : null,
            client_updated_at: item.at,
          }, { onConflict: 'user_id,lesson_id' });

        } else if (item.entity === 'exam') {
          const eid = idOf('exam', item.examId);
          if (!eid) { done.add(item.key); continue; }
          await Api.upsert('exam_attempts', {
            id: item.id, user_id: uid, exam_id: eid,
            started_at: item.at, submitted_at: item.at, score_percent: item.percent,
          }, { onConflict: 'id' });
        }
        done.add(item.key);
        sent++;
      } catch (e) {
        failed++;
        if (e.code === 'offline') break;    // لا فائدة من متابعة الطابور بلا شبكة
      }
    }

    if (done.size) Store.clearOutbox([...done]);
    return { sent, failed };
  }

  // ---------------------------------------------------------------------------
  // سحب التقدّم
  // ---------------------------------------------------------------------------

  /**
   * يجلب تقدّم الطالب من السيرفر ويدمجه محليًا.
   *
   * بدون هذا كان الطالب الذي يبدّل جهازه — أو يعيد تثبيت التطبيق — يجد تقدّمه
   * صفرًا رغم أنه محفوظ على السيرفر كاملًا. الرفع وحده لا يكفي.
   *
   * يُنفَّذ **بعد** تفريغ الطابور: لو سحبنا أولًا لطمس المخزون البعيد نشاطًا
   * محليًا لم يُرسل بعد.
   */
  async function pullProgress() {
    if (!Api.isSignedIn()) return 0;

    const [lessons, exams] = await Promise.all([
      Api.from('lesson_progress',  { select: 'lesson_id,status,completed_at,client_updated_at' }),
      Api.from('exam_attempts',    { select: 'exam_id,score_percent,submitted_at' }),
    ]);

    const L = reverseMap('lesson'), E = reverseMap('exam');
    const s = Store.get();

    // --- الدروس: أحدث تعديل يفوز (نفس قاعدة السيرفر) ---
    const nextLessons = { ...s.lessons };
    for (const row of lessons) {
      const code = L[row.lesson_id];
      if (!code) continue;
      // المحلي المكتمل لا يتراجع: قد يكون أُنجز للتوّ ولم يُرفع بعد
      if (s.lessons[code] === 'done' && row.status !== 'done') continue;
      nextLessons[code] = row.status;
    }

    // --- الامتحانات: أفضل نتيجة وعدد المحاولات ---
    const nextExams = { ...s.exams };
    for (const row of exams) {
      const code = E[row.exam_id];
      if (!code || row.submitted_at === null) continue;
      const prev = nextExams[code] || { best: 0, taken: 0 };
      nextExams[code] = {
        best: Math.max(prev.best, Math.round(row.score_percent || 0)),
        taken: Math.max(prev.taken, 1),
      };
    }
    // عدد المحاولات الحقيقي من عدّ الصفوف لا من الحد الأدنى
    const counts = {};
    exams.forEach((r) => { const c = E[r.exam_id]; if (c) counts[c] = (counts[c] || 0) + 1; });
    for (const [code, n] of Object.entries(counts)) {
      if (nextExams[code]) nextExams[code].taken = Math.max(nextExams[code].taken, n);
    }

    Store.set({ lessons: nextLessons, exams: nextExams });
    return lessons.length + exams.length;
  }

  // ---------------------------------------------------------------------------
  // حالة الجلسة
  // ---------------------------------------------------------------------------

  /**
   * هل ما زالت جلستنا هي النشطة؟
   *
   * ضروري لأن RLS تحجب الصفوف **بصمت** بلا خطأ: الطالب المطرود يرى شاشة
   * فارغة لا رسالة. هذه الدالة تحوّل الصمت إلى سبب يمكن عرضه.
   */
  async function sessionOk() {
    if (!Api.isSignedIn()) return true;
    try {
      const r = await Api.rpc('session_status');
      return r?.current !== false;
    } catch (e) {
      // بلا شبكة لا نحكم بالطرد — الطالب يعمل أوفلاين وهذا مشروع
      return e.code === 'offline' ? true : true;
    }
  }

  // ---------------------------------------------------------------------------
  // الدورة الكاملة
  // ---------------------------------------------------------------------------
  let running = false;

  /**
   * دورة مزامنة كاملة. الترتيب مقصود:
   *   ١. فحص الجلسة  — لا فائدة من أي شيء بعده إن كنّا مطرودين
   *   ٢. رفع الطابور — قبل أي سحب، لئلّا يُطمس نشاط لم يُرسل
   *   ٣. سحب المحتوى ثم التقدّم
   */
  async function syncNow({ content = true } = {}) {
    if (running || !Api.isSignedIn()) return null;
    running = true;
    try {
      if (!await sessionOk()) {
        Store.set({ evicted: true });
        return { evicted: true };
      }
      if (Store.get().evicted) Store.set({ evicted: false });

      const push = await pushProgress();
      let pulled = 0, progress = 0;

      if (navigator.onLine) {
        if (content && !DEMO) {
          const c = await pullContent();
          applyStored();
          pulled = Object.keys(c.lessons).length;
        }
        progress = await pullProgress();
      }

      Store.set({ lastSync: new Date().toISOString() });
      return { ...push, pulled, progress };
    } catch (e) {
      console.warn('sync failed', e.code || e.message);
      return null;
    } finally { running = false; }
  }

  /**
   * يمسح المحتوى المزامَن. يُستدعى عند الخروج: المحتوى ملك للحساب الذي سحبه،
   * وإبقاؤه يعني أن الطالب التالي على الجهاز نفسه يرى محتوى سابقه إلى أن
   * تكتمل أول مزامنة له.
   */
  function clearContent() {
    localStorage.removeItem(CONTENT_KEY);
    localStorage.removeItem(IDMAP_KEY);
  }

  return { pullContent, applyStored, pushProgress, pullProgress,
           sessionOk, syncNow, idOf, clearContent, DEMO, CONTENT_KEY };
})();
