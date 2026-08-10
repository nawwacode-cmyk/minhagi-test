/* =============================================================================
   sync.js — سحب المحتوى ورفع التقدّم

   المبدأ: التطبيق يقرأ **دائمًا** من المخزون المحلي، لا من الشبكة. هذه الطبقة
   تملأ ذلك المخزون في الخلفية وتستنزف طابور التقدّم. لا شاشة تنتظر شبكة.

   ترجمة المعرّفات: السيرفر يعمل بـ UUID والتطبيق يعمل بالرموز (`salutations`،
   `u1`، `q-art-1`). الترجمة تحدث هنا وحدها، فتبقى الشاشات بسيطة ويبقى
   المخزون المحلي مقروءًا عند التنقيح.
   ============================================================================= */
window.Sync = (function () {

  const CONTENT_KEY = 'manhaji.content.v1';   // مفتاح localStorage القديم — للترحيل فقط
  const IDMAP_KEY   = 'manhaji.idmap.v1';     // نفسه
  const VERSION_KEY = 'manhaji.content.ver';  // صغير، يبقى في localStorage
  const B_CONTENT = 'content';                // مفاتيح IndexedDB
  const B_IDMAP   = 'idmap';

  /* خريطة «رمز ← uuid» تُقرأ تزامنيًا في مسار رفع التقدّم (idOf/reverseMap)،
     وIndexedDB غير متزامن. فنُبقيها في الذاكرة ونكتبها إلى القرص فقط.
     القرص للبقاء بين الجلسات؛ الذاكرة هي المصدر أثناء الجلسة. */
  let idMap = {};
  let loaded = false;             // هل قرأنا القرص في هذه الجلسة؟

  /**
   * حفظ المحتوى وخريطة معرّفاته معًا — أو لا حفظ إطلاقًا.
   *
   * علّتان كانتا هنا، وكلتاهما صامتة:
   *
   * ١. `localStorage` له حصّة ~٥ م.ب، ويخزّن UTF-16 — أي بايتان لكل حرف عربي.
   *    مادة واحدة ≈ ٠٫٩ م.ب نصًّا، فتشغل ~١٫٥ م.ب من الحصّة: الجدار عند ثلاث
   *    مواد لا خمس. وتجاوزُها يرمي QuotaExceededError كان يُبتلع في catch
   *    أعلى ويُطبع تحذيرًا في الطرفية — فيتوقّف المحتوى عن التحدّث **إلى
   *    الأبد** بلا أن يلاحظ الطالب أو نعرف نحن السبب.
   *
   * ٢. الكتابتان منفصلتان. نجاح الأولى وفشل الثانية يترك خريطة معرّفات لا
   *    تطابق المحتوى — وهي التي تترجم رموز الدروس إلى UUID عند رفع التقدّم.
   *    أي: تقدّم الطالب يُرسل إلى صفوف خاطئة. الكتابة الجزئية أسوأ من لا كتابة،
   *    فنُرجع الحالة السابقة كما كانت عند أي فشل. الضمان نفسه لازمٌ على
   *    IndexedDB أيضًا: معاملتان منفصلتان لا واحدة ذرّية.
   */
  async function storeContent(content, map) {
    const prevC = await Blob2.get(B_CONTENT);
    const prevM = await Blob2.get(B_IDMAP);
    try {
      await Blob2.set(B_CONTENT, content);
      await Blob2.set(B_IDMAP, map);
      idMap = map;
      if (Store.get().storageFull) Store.set({ storageFull: false });
      return true;
    } catch (e) {
      const restore = async (k, v) => {
        try { if (v === null) await Blob2.del(k); else await Blob2.set(k, v); }
        catch { /* لا شيء نفعله أكثر */ }
      };
      await restore(B_CONTENT, prevC);
      await restore(B_IDMAP, prevM);
      idMap = prevM || {};
      // العلامة تُقرأ في الواجهة: الطالب يرى سببًا مفهومًا بدل محتوى متجمّد
      Store.set({ storageFull: true });
      console.error('تعذّر حفظ المحتوى — مساحة التخزين ممتلئة', e);
      return false;
    }
  }

  /**
   * وضع المعاينة — `index.html?demo=1`.
   *
   * سببه أن المحتوى المزامَن يستبدل SEED كليًا عند كل إقلاع (applyStored)، فما
   * إن يزامن الجهاز مرة واحدة حتى يصير من المستحيل معاينة الواجهة ببيانات
   * seed.js التجريبية — تُعدَّل فلا يظهر أثرها، ويبدو الأمر كأنه عطل في الحفظ
   * أو الكاش. هذا العَلم يقطع ذلك: SEED كما هو في الملف، ولا سحب محتوى إطلاقًا.
   */
  const DEMO = new URLSearchParams(location.search).has('demo');

  /** مصفوفات «عقد الشكل» كما يعلنها seed.js — تُلتقط قبل أن يستبدله applyStored. */
  const SHAPE = Object.keys(window.SEED || {}).filter((k) => Array.isArray(window.SEED[k]));

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
    //
    // «courses» لم تعد مفهومًا يراه الطالب (راجع خطة إزالة طبقة الكورسات) —
    // نجلب subject_id/grade_id الخاصّين بكل وحدة عبر embed مباشر من courses
    // بدل جلب جدول courses نفسه كمجموعة مستقلة. جلب teachers/courses أدناه
    // ضيّق ومقصور على بناء «أستاذ ← أي مواد يقدّمها» لواجهة الاكتشاف فقط —
    // ليس عودة لطبقة الكورسات القديمة.
    const [subjects, grades, units, lessons,
           questions, options, exams, examQuestions, videos,
           teachers, teacherCourses, banners] = await Promise.all([
      Api.from('subjects',  { select: 'id,code,name_ar,name_native,color_hex,sort_order' }),
      Api.from('grades',    { select: 'id,code,name_ar,sort_order' }),
      Api.from('units',     { select: 'id,code,title_ar,course_id,sort_order,courses(subject_id,grade_id)', order: 'sort_order' }),
      Api.from('lessons',   { select: 'id,code,title_ar,body_html,est_minutes,is_free,unit_id,video_id,doc_id,sort_order', order: 'sort_order' }),
      Api.from('questions', { select: 'id,code,type,stem_md,passage_md,answer_key,difficulty,explanation_md,lesson_id,section,unit_code,subject_id' }),
      /* بلا `order` عمدًا — وهو أكبر جدول يُسحب. الترتيب هنا كان زائدًا أصلًا:
         التحويل أدناه يرتّب خيارات كل سؤال بـsort_order بنفسه. وإسقاطه يسمح
         بالترقيم بالمفتاح بدل الإزاحة، وقد قِسنا الفرق: الإزاحة تحت RLS تُقيّم
         السياسة على كل صفّ تتخطّاه ثم ترميه. */
      Api.from('question_options', { select: 'id,question_id,code,text_md,is_correct,sort_order' }),
      Api.from('exams',     { select: 'id,code,title_ar,kind,duration_minutes,pass_percent,subject_id,grade_id,sort_order', order: 'sort_order' }),
      // بلا عمود id — مفتاحها مركّب، فيُثبَّت الترقيم به
      Api.from('exam_questions', { select: 'exam_id,question_id,sort_order,points',
                                   pageKey: 'exam_id,question_id' }),
      Api.from('videos',    { select: 'id,title,quality,duration_s,size_bytes' }).catch(() => []),
      Api.from('teachers',  { select: 'id,code,name,bio,photo_path', order: 'sort_order' }).catch(() => []),
      Api.from('courses',   { select: 'teacher_id,subject_id' }).catch(() => []),
      // البانرات: RLS تحصرها بالمفعَّل ضمن نافذته الزمنية، فما يصل هنا هو
      // بالضبط ما يجوز عرضه — لا تصفية تواريخ في العميل.
      Api.from('banners', {
        select: 'id,title_ar,subtitle_ar,image_path,target_type,target_value,sort_order'
              + ',published_at,category,pinned,body_ar,show_on_home',
        // ترتيب القسم: المثبَّت أوّلًا ثم الأحدث — و`sort_order` يفصل التعادل
        order: 'pinned.desc,published_at.desc,sort_order',
      }).catch(() => []),
    ]);

    // --- خرائط الترجمة ---
    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const subjectByUuid = byId(subjects);
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
        // ضروري لتصفية بنك الأسئلة بالمادة — بلا هذا تختلط أسئلة كل المواد
        // ببعضها بمجرّد ما تصير أكتر من مادة واحدة بالتطبيق.
        subject: subjectByUuid[q.subject_id]?.code || null,
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

    // --- المادة: وحدة الوصول الفعلية الآن (بعد إزالة طبقة الكورسات) -----------
    // RLS على `units` ما زالت تمرّ عبر صلاحية الكورس (has_course_access) خلف
    // الكواليس، لكن الطالب لم يعد يرى «كورس» إطلاقًا — فقط: هل وصلته أي وحدة
    // لهاي المادة؟ إذا نعم فهو مشترَك فيها. courses(subject_id,grade_id) هنا
    // مجرّد embed لقراءة المادة/الصف من الوحدة، لا مفهوم مستقلّ بالواجهة.
    const gradeByUuid = byId(grades);
    const entitledSubjectCodes = new Set(
      units.map((u) => subjectByUuid[u.courses?.subject_id]?.code).filter(Boolean),
    );

    const content = {
      pulledAt: new Date().toISOString(),

      subjects: subjects.map((s) => ({
        id: s.code, name: s.name_ar, native: s.name_native,
        cover: s.code === 'fr' ? 'assets/img/cover-fr.jpg' : null,
        entitled: entitledSubjectCodes.has(s.code),
      })),
      grades: grades.sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({ id: g.code, name: g.name_ar, note: '' })),

      units: units.map((u) => ({
        id: u.code, title: u.title_ar,
        subject: subjectByUuid[u.courses?.subject_id]?.code || null,
        // الصف يأتي من كورس الوحدة. هو المصدر الموثوق لصفّ الطالب: الاشتراك
        // المبنيّ على باقة يحمل grade_id فارغًا (الباقة هي النطاق)، أما ما
        // سمحت به RLS من وحدات فهو ما يملكه الطالب فعلًا.
        grade: gradeByUuid[u.courses?.grade_id]?.code || null,
        lessons: (unitLessons[u.id] || []).sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => l.code),
      })),

      lessons: Object.fromEntries(lessons.map((l) => [l.code, {
        id: l.code, title: l.title_ar, minutes: l.est_minutes, free: l.is_free,
        body: l.body_html || '',
        /* `thumb` يبقى الرسم النائب دائمًا: صورة الفيديو الحقيقية تعيش في
           bucket خاص ولا رابط عامّ لها، فتُطلب موقّعة مع رابط التشغيل عند
           فتح الدرس (media-url). تخزينُ رابطٍ موقّع هنا بلا معنى — يموت بعد
           عشر دقائق بينما المحتوى يُخزَّن لأسابيع. */
        video: l.video_id && V[l.video_id]
          ? { id: l.video_id, title: V[l.video_id].title,
              length: fmtDuration(V[l.video_id].duration_s), thumb: 'assets/img/video-thumb.svg' }
          : { title: l.title_ar, length: '—', thumb: 'assets/img/video-thumb.svg' },
        /* معرّف الشرح فقط — لا الرابط، للسبب نفسه أعلاه: الرابط موقّع ويموت
           بعد عشر دقائق بينما المحتوى يُخزَّن لأسابيع. يُطلب عند فتح الدرس. */
        doc: l.doc_id || null,
        exercises: lessonQuestions[l.code] || [],
      }])),

      questions: mappedQuestions,

      // subject/grade مباشرة: الامتحان الوزاري مشترَك بين كل محتوى نفس المادة
      // والصف. هذا ما يمكّن Store.subjectProgress من حصر أفضل نتيجة امتحان
      // بالمادة تحديدًا بدل خلطها بامتحانات مواد أخرى.
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

      // «أساتذتنا» بشاشة الاكتشاف. RLS على teachers أصلًا تحصر النتيجة
      // بالنشطين (is_active) فلا تصفية إضافية لازمة هنا. bio/photo قد تغيبان
      // بصدق (لا بيانات مُختلَقة) — الواجهة تتعامل مع غيابهما كحالة متوقَّعة.
      /* الحقول الجديدة تُقرأ بقيَم احتياطية: جهازٌ زامن قبل الهجرة يحمل
         بانرات بلا `published_at` ولا `category`، والشاشة تقرأها مباشرةً.
         بلا الاحتياط تُرسم «Invalid Date» أو شريحةٌ بلا اسم على كل جهاز لم
         يزامن بعد — أي على كل الأجهزة لحظة النشر. */
      banners: (banners || []).map((b) => ({
        id: b.id, title: b.title_ar, sub: b.subtitle_ar || '',
        image: b.image_path || null,
        target: b.target_type === 'none' ? null : { type: b.target_type, value: b.target_value },
        at: b.published_at || null,
        category: b.category || 'announcement',
        pinned: !!b.pinned,
        body: b.body_ar || '',
        onHome: b.show_on_home !== false,
      })),

      teachers: (teachers || []).map((t) => ({
        id: t.code, name: t.name, bio: t.bio || null, photo: t.photo_path || null,
        subjects: [...new Set((teacherCourses || [])
          .filter((c) => c.teacher_id === t.id)
          .map((c) => subjectByUuid[c.subject_id]?.code)
          .filter(Boolean))],
      })),
    };

    if (!await storeContent(content, idMap)) return null;
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
  async function applyStored() {
    if (DEMO) return false;
    try {
      /* الترحيل من مفاتيح localStorage القديمة يسبق أي قراءة، ومرّةً واحدة:
         طالبٌ قائم يحمل محتواه هناك، وقراءةُ IndexedDB الفارغة قبل نقله تعني
         أنه يفتح التطبيق على شاشة فارغة ثم ينتظر مزامنة كاملة — أو لا يرى
         شيئًا إن كان بلا إنترنت. */
      await ensureLoaded();
      const c = await Blob2.get(B_CONTENT);
      if (!c) return false;
      if (!c.lessons || !Object.keys(c.lessons).length) return false;
      /* كتلةٌ محفوظة من نسخة أقدم قد تنقصها حقول أضافتها نسخة أحدث. وبما أن
         هذا السطر يستبدل SEED **كاملًا**، تصير الشاشة تقرأ حقلًا غير موجود
         فتنكسر عند أول رسم — أي قبل أن تصل مزامنة تُصلح الكتلة.

         نُكمل الناقص من الهيكل ولا نرفض الكتلة: الرفض يحرم طالبًا بلا إنترنت
         من كل محتواه المخزَّن لمجرّد غياب حقل واحد أضافته نسخة أحدث.

         المرجع هو seed.js نفسه — «عقد الشكل» المعلَن الذي تقرأ عليه الشاشات
         (انظر تعليقه)، فأي مصفوفة تُضاف إليه مستقبلًا تدخل هذا الإكمال تلقائيًا. */
      const filled = { ...window.SEED, ...c };
      for (const k of SHAPE) if (!Array.isArray(filled[k])) filled[k] = [];
      window.SEED = filled;
      return true;
    } catch { return false; }
  }

  /**
   * تحميل خريطة المعرّفات من القرص مرّة واحدة في الجلسة.
   *
   * كانت `idOf` تقرأ localStorage عند كل نداء، فلم يكن للترتيب معنى. ومع
   * IndexedDB صارت تقرأ الذاكرة، فأي مسار يبلغ رفع التقدّم قبل `applyStored`
   * يجد خريطة فارغة — فيُرسل تقدّم الطالب بمعرّفات فارغة ويضيع بصمت.
   * فبدل الاعتماد على ترتيب النداءات، يضمن كل مسار حاجته بنفسه.
   */
  async function ensureLoaded() {
    if (loaded) return;
    await Blob2.migrate([[CONTENT_KEY, B_CONTENT], [IDMAP_KEY, B_IDMAP]]);
    idMap = (await Blob2.get(B_IDMAP)) || {};
    loaded = true;
  }

  const idOf = (kind, code) => idMap[`${kind}:${code}`] || null;

  /** العكس: uuid ← رمز. نبنيه عند الحاجة لأن سحب التقدّم يعود بمعرّفات السيرفر. */
  function reverseMap(kind) {
    const out = {};
    for (const [k, uuid] of Object.entries(idMap)) {
      const [t, code] = k.split(':');
      if (t === kind) out[uuid] = code;
    }
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
    await ensureLoaded();          // idOf يقرأ الذاكرة الآن، فلا بدّ من تحميلها
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
    await ensureLoaded();          // reverseMap يقرأ الذاكرة الآن

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

    // نُرجع عدد ما **تغيّر** فعلًا لا عدد ما جُلب.
    //
    // كان الإرجاع lessons.length + exams.length، أي رقمًا موجبًا في كل مزامنة
    // لأي طالب له تقدّم. و app.js يعيد رسم الشاشة كلها عند أي ناتج موجب،
    // فكانت الشاشة ترتجف دوريًا بلا سبب — ومع animation:fadeIn على .screen
    // تبدو الرجفة تحديثًا كاملًا للتطبيق.
    const changed =
      Object.keys(nextLessons).filter((k) => s.lessons[k] !== nextLessons[k]).length +
      Object.keys(nextExams).filter((k) =>
        (s.exams[k]?.best ?? -1) !== nextExams[k].best ||
        (s.exams[k]?.taken ?? -1) !== nextExams[k].taken).length;

    if (changed) Store.set({ lessons: nextLessons, exams: nextExams });
    return changed;
  }

  /**
   * صفّ الطالب ومدّة اشتراكه — من السيرفر لا من قيَم مثبَّتة.
   *
   * ⚠️ كانا مثبَّتين في store.js: `grade: 'g9'` و `daysLeft: 283`، ولا يُحدَّثان
   * أبدًا. فكان كل طالب يرى «الصف التاسع» مهما كان اشتراكه — حتى وكورس
   * البكالوريا هو الوحيد الموجود — ويرى «متبقٍ ٢٨٣ يومًا» وهو رقم مختلَق
   * عن اشتراك مدفوع. بقيّة من عهد البيانات الوهمية بقيت تُعرض كأنها حقيقة.
   *
   * الصف: من الوحدات التي وصلت فعلًا لا من الاشتراك — الاشتراك المبنيّ على
   * باقة يحمل grade_id فارغًا، فـ my_entitlements تُرجع grade_code فارغة.
   * بأكثر من صف نترك القيمة فارغة بدل ترجيح أحدهما بلا أساس.
   */
  async function pullEntitlements(content) {
    let daysLeft = 0;
    try {
      const rows = await Api.rpc('my_entitlements');
      const list = Array.isArray(rows) ? rows : [];
      daysLeft = list.reduce((a, r) => Math.max(a, r.days_left || 0), 0);
    } catch { /* بلا شبكة نُبقي ما لدينا */ }

    const grades = [...new Set((content?.units || []).map((u) => u.grade).filter(Boolean))];
    const grade = grades.length === 1 ? grades[0] : null;

    const s = Store.get();
    const patch = {};
    if (grade && grade !== s.grade) patch.grade = grade;
    if (daysLeft !== s.daysLeft) patch.daysLeft = daysLeft;
    if (Object.keys(patch).length) Store.set(patch);
    return Object.keys(patch).length;
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

  /* ---------------------------------------------------------------------------
     هل يستحقّ المحتوى سحبًا؟

     كل فتحة للتطبيق كانت تسحب الكتالوج كاملًا — ١٢ استعلامًا ومئات الكيلوبايت —
     ولو لم يتغيّر حرف. المحتوى يتغيّر مرّةً في الأسبوع تقريبًا والطالب يفتح
     التطبيق عدّة مرّات يوميًا، فالغالبية العظمى من ذلك النقل مهدورة.

     نسأل أولًا عن بصمة واحدة (`content_version`, انظر الهجرة 20260807000100).
     إن طابقت المحفوظة **وكان عندنا محتوى فعلًا** تخطّينا السحب كليًا.

     أي شكّ ⇒ نسحب: تعذّر الاتصال بالدالة، أو بصمة فارغة، أو لا محتوى مخزَّنًا.
     الخطأ في اتجاه «سحبٌ زائد» يكلّف نطاقًا؛ وفي الاتجاه الآخر يكلّف محتوًى
     قديمًا عند الطالب لا يعرف أحد أنه قديم.
  --------------------------------------------------------------------------- */
  let pendingVersion = null;

  async function contentStale() {
    pendingVersion = null;
    let ver;
    try { ver = await Api.rpc('content_version'); }
    catch { return true; }
    if (typeof ver !== 'string' || !ver || ver === 'empty') return true;
    pendingVersion = ver;
    // بصمة مطابقة بلا محتوى على القرص = جهاز جديد أو تخزين مُسِح ⇒ نسحب
    if (!await Blob2.get(B_CONTENT)) return true;
    return localStorage.getItem(VERSION_KEY) !== ver;
  }

  function commitVersion() {
    if (!pendingVersion) return;
    try { localStorage.setItem(VERSION_KEY, pendingVersion); } catch { /* غير حرج */ }
    pendingVersion = null;
  }

  /* ---------------------------------------------------------------------------
     إعدادات التشغيل — مفتاح الإيقاف والإعلان العامّ.

     صفٌّ واحد يُقرأ مع كل مزامنة. الغرض منه لحظة واحدة: عطلٌ فادح وصل
     الطلاب. بدونه يبقون أمام تطبيق مكسور بلا تفسير — وService Worker يخدم
     النسخة المخزَّنة، فحتى النشر المصحَّح لا يصلهم إلّا عند الفتحة التالية.

     الفشل هنا **لا يوقف شيئًا**: تعذّر القراءة يعني «لا إيقاف» لا «أوقف».
     الاتجاه مقصود — عطلٌ في جدول الإعدادات يجب ألّا يحجب تطبيقًا سليمًا.
  --------------------------------------------------------------------------- */
  async function pullConfig() {
    try {
      const rows = await Api.from('app_config',
        { select: 'min_version,notice,halted', limit: 1 });
      const c = rows && rows[0];
      if (!c) return;
      Store.set({ appConfig: { halted: !!c.halted, notice: c.notice || null,
                               minVersion: c.min_version || null } });
    } catch { /* لا إيقاف عند الشكّ */ }
  }

  /**
   * دورة مزامنة كاملة. الترتيب مقصود:
   *   ١. فحص الجلسة  — لا فائدة من أي شيء بعده إن كنّا مطرودين
   *   ٢. رفع الطابور — قبل أي سحب، لئلّا يُطمس نشاط لم يُرسل
   *   ٣. سحب المحتوى (إن تغيّر) ثم الاستحقاق ثم التقدّم
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
      let contentChanged = false, progress = 0, entitle = 0;

      // قبل أي سحب: لو كنّا موقوفين فلا معنى لجلب محتوى لن يُعرض
      if (navigator.onLine) await pullConfig();

      if (navigator.onLine) {
        if (content && !DEMO) {
          let c = null;
          if (await contentStale()) {
            /* «هل تغيّر شيء؟» كانت تُجاب بمقارنة النصّ المخزَّن قبل السحب
               وبعده. لم يعد المحتوى نصًّا (صار كائنًا في IndexedDB)، والبصمة
               صارت **مقصورة على نطاق الطالب** — فوصولنا إلى هنا يعني أن شيئًا
               في نطاقه تغيّر فعلًا. هي إشارة أدقّ من السابقة لا أضعف: المقارنة
               النصّية كانت تُعلن تغييرًا لأي فرقٍ في الترتيب أو التنسيق. */
            c = await pullContent();
            contentChanged = !!c;
            if (contentChanged) await applyStored();
            /* البصمة تُسجَّل بعد نجاح الحفظ لا قبله: `pullContent` تُرجع null إن
               امتلأت المساحة، وتسجيلُها حينها يعني تخطّي السحب إلى الأبد
               ومحتوًى متجمّدًا بلا سبب ظاهر. */
            if (c) commitVersion();
          }
          /* الاستحقاق يُسحب دائمًا وإن تخطّينا المحتوى: أيام الاشتراك تنقص
             بمرور الوقت لا بتغيّر المحتوى، ولو ربطناه بالسحب لبقي اشتراكٌ
             منتهٍ يعرض أيامًا متبقّية إلى أن يعدّل أحدٌ درسًا.
             وعند التخطّي نمرّر المحتوى المطبَّق ليبقى اشتقاق الصف صحيحًا. */
          entitle = await pullEntitlements(c || window.SEED);
        }
        progress = await pullProgress();
      }

      Store.set({ lastSync: new Date().toISOString() });
      // `changed` هي ما يقرّر إعادة الرسم في app.js — لا مجرّد «نجحت المزامنة».
      return { ...push, contentChanged, progress,
               changed: contentChanged || progress > 0 || entitle > 0 || (push?.sent > 0) };
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
  async function clearContent() {
    await Blob2.del(B_CONTENT);
    await Blob2.del(B_IDMAP);
    // ومفاتيح localStorage القديمة إن بقيت من نسخة سابقة لم تُرحَّل بعد
    localStorage.removeItem(CONTENT_KEY);
    localStorage.removeItem(IDMAP_KEY);
    localStorage.removeItem(VERSION_KEY);   // وإلّا تخطّى الطالب التالي السحب
    idMap = {};
    loaded = false;
  }

  return { pullContent, applyStored, pushProgress, pullProgress,
           sessionOk, syncNow, idOf, clearContent, DEMO, CONTENT_KEY };
})();
