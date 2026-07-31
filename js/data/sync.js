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
    const [subjects, grades, topics, courses, units, lessons, lessonTopics,
           questions, options, exams, examQuestions, videos] = await Promise.all([
      Api.from('subjects',  { select: 'id,code,name_ar,name_native,color_hex,sort_order' }),
      Api.from('grades',    { select: 'id,code,name_ar,sort_order' }),
      Api.from('topics',    { select: 'id,code,name_ar,name_native,sort_order' }),
      Api.from('courses',   { select: 'id,code,title_ar,subject_id,grade_id' }),
      Api.from('units',     { select: 'id,code,title_ar,course_id,sort_order', order: 'sort_order' }),
      Api.from('lessons',   { select: 'id,code,title_ar,body_html,est_minutes,is_free,unit_id,video_id,sort_order', order: 'sort_order' }),
      Api.from('lesson_topics', { select: 'lesson_id,topic_id' }),
      Api.from('questions', { select: 'id,code,type,stem_md,answer_key,difficulty,explanation_md,topic_id,lesson_id' }),
      Api.from('question_options', { select: 'id,question_id,code,text_md,is_correct,sort_order', order: 'sort_order' }),
      Api.from('exams',     { select: 'id,code,title_ar,kind,duration_minutes,pass_percent,sort_order', order: 'sort_order' }),
      Api.from('exam_questions', { select: 'exam_id,question_id,sort_order,points' }),
      Api.from('videos',    { select: 'id,title,quality,duration_s,size_bytes' }).catch(() => []),
    ]);

    // --- خرائط الترجمة ---
    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const T = byId(topics), L = byId(lessons), Q = byId(questions), V = byId(videos || []);
    const idMap = {};                       // 'lesson:salutations' → uuid
    const put = (kind, code, id) => { idMap[`${kind}:${code}`] = id; };

    lessons.forEach((l) => put('lesson', l.code, l.id));
    questions.forEach((q) => put('question', q.code, q.id));
    exams.forEach((e) => put('exam', e.code, e.id));
    topics.forEach((t) => put('topic', t.code, t.id));

    // --- المواضيع المرتبطة بكل درس ---
    const lessonTopicCodes = {};
    lessonTopics.forEach(({ lesson_id, topic_id }) => {
      const lc = L[lesson_id]?.code, tc = T[topic_id]?.code;
      if (!lc || !tc) return;
      (lessonTopicCodes[lc] = lessonTopicCodes[lc] || []).push(tc);
    });

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
        topic: T[q.topic_id]?.code || null,
        lesson: L[q.lesson_id]?.code || null,
        difficulty: q.difficulty,
        stem: q.stem_md,
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

    const content = {
      pulledAt: new Date().toISOString(),

      subjects: subjects.map((s) => ({
        id: s.code, name: s.name_ar, native: s.name_native,
        cover: s.code === 'fr' ? 'assets/img/cover-fr.jpg' : null, ready: true,
      })),
      grades: grades.sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({ id: g.code, name: g.name_ar, note: '' })),
      topics: topics.sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => ({ id: t.code, name: t.name_ar, native: t.name_native })),

      units: units.map((u) => ({
        id: u.code, title: u.title_ar,
        lessons: (unitLessons[u.id] || []).sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => l.code),
      })),

      lessons: Object.fromEntries(lessons.map((l) => [l.code, {
        id: l.code, title: l.title_ar, minutes: l.est_minutes, free: l.is_free,
        topics: lessonTopicCodes[l.code] || [],
        body: l.body_html || '',
        video: l.video_id && V[l.video_id]
          ? { id: l.video_id, title: V[l.video_id].title,
              length: fmtDuration(V[l.video_id].duration_s), thumb: 'assets/img/video-thumb.svg' }
          : { title: l.title_ar, length: '—', thumb: 'assets/img/video-thumb.svg' },
        exercises: lessonQuestions[l.code] || [],
      }])),

      questions: mappedQuestions,

      exams: exams.map((e) => ({
        id: e.code, kind: e.kind === 'past_paper' ? 'ministry' : e.kind,
        title: e.title_ar, minutes: e.duration_minutes, pass: e.pass_percent,
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
  // الدورة الكاملة
  // ---------------------------------------------------------------------------
  let running = false;

  /** الرفع قبل السحب: لا نريد أن يمحو محتوى جديد تقدّمًا لم يُرسل بعد. */
  async function syncNow({ content = true } = {}) {
    if (running || !Api.isSignedIn()) return null;
    running = true;
    try {
      const push = await pushProgress();
      let pulled = 0;
      if (content && navigator.onLine) {
        const c = await pullContent();
        applyStored();
        pulled = Object.keys(c.lessons).length;
      }
      Store.set({ lastSync: new Date().toISOString() });
      return { ...push, pulled };
    } catch (e) {
      console.warn('sync failed', e.code || e.message);
      return null;
    } finally { running = false; }
  }

  return { pullContent, applyStored, pushProgress, syncNow, idOf, CONTENT_KEY };
})();
