/* =============================================================================
   الرئيسية (اكتشاف) · موادّي · ملف الأستاذ · حسابي
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, ring, bar } = UI;

  /** اسم الصف من رمزه — فارغ إن لم يُعرَف بعد، لا اسم مفترَض. */
  const gradeNameOf = (code) =>
    (code && (SEED.grades || []).find((g) => g.id === code)?.name) || '';

  /**
   * صفّ مادةٍ بعينها، من وحداتها هي.
   *
   * أدقّ من صفّ الطالب العام: قد يشترك بمادتين في صفّين مختلفين، وعرض صفٍّ
   * واحد على كل البطاقات يكذب على إحداها. وهذا بالضبط ما حدث حين كان الصف
   * قيمة مثبَّتة: كورس البكالوريا كان يُعرض «الصف التاسع».
   */
  const gradeOfSubject = (code) => {
    const g = [...new Set((SEED.units || [])
      .filter((u) => u.subject === code).map((u) => u.grade).filter(Boolean))];
    return g.length === 1 ? gradeNameOf(g[0]) : '';
  };

  // --- ٥. الرئيسية (اكتشاف) -----------------------------------------------------
  // «الرئيسية» هنا واجهة تعريفية/ترويجية (بانر، أساتذتنا، خدماتنا) منفصلة عن
  // «موادّي» (Screens.subjects أدناه) التي تحمل لوحة الدراسة الفعلية. كل نصّ
  // هنا دائم وصادق — لا عروض مؤقّتة ولا خدمات غير مطروحة فعليًا بعد.
  // تدرّجات بطاقات الأساتذة بالترتيب — ثابتة بحسب موضع البطاقة لا عشوائية،
  // فلا يتغيّر لون الأستاذ نفسه بين فتحة وأخرى.
  const CARD_TINTS = [
    'linear-gradient(155deg,#453876,#5B4B9E)',
    'linear-gradient(155deg,#8A5A1E,#C98A2E)',
    'linear-gradient(155deg,#3D2F73,#6E5BB8)',
  ];

  Screens.home = () => {
    const s = Store.get();
    const teachers = SEED.teachers || [];
    const firstEntitled = (SEED.subjects || []).find((sub) => sub.entitled);
    const subjectName = (code) => SEED.subjects.find((x) => x.id === code)?.name || code;

    // البانرات المُدارة من اللوحة وحدها. ما يصل هنا مفعَّل وضمن نافذته
    // الزمنية أصلًا (تفرضها RLS)، فلا تصفية تواريخ هنا.
    //
    // بلا بانر مضاف لا يُعرض شيء — ولا شرائح بديلة. الشريحة الافتراضية تشغل
    // أبرز موضع في الشاشة بمحتوى لم يختره أحد، فيراها الطالب إعلانًا قائمًا
    // ويراها المدير مكانًا مشغولًا فلا ينتبه أن لوحته فارغة.
    const slides = SEED.banners || [];

    /** وجهة البانر عند النقر — بلا وجهة يبقى إعلاميًا لا يُنقر. */
    function bannerGo(b) {
      const t = b.target;
      if (!t) return null;
      if (t.type === 'subject') return () => App.go('course', { subject: t.value });
      if (t.type === 'teacher') return () => App.go('teacher', { id: t.value });
      if (t.type === 'url') return () => window.open(t.value, '_blank', 'noopener');
      return null;
    }

    const goPractice = () => firstEntitled
      ? App.go('course', { subject: firstEntitled.id, tab: 'practice' })
      : App.go('subjects');
    const goExams = () => firstEntitled
      ? App.go('course', { subject: firstEntitled.id, tab: 'exams' })
      : App.go('subjects');

    const svc = (ico, title, sub, onclick) =>
      h('button.card.svc-card', { onclick },
        h('div.svc-ico', ico(19)),
        h('b', title), h('span', sub));

    return h('div.screen',
      // الهيدر: الشعار والإعدادات فقط. التحية محتوى الصفحة لا شريط أدوات،
      // فمكانها داخل منطقة التمرير تحته.
      h('header.appbar.appbar--home',
        // بلا شعار: الاسم وحده يكفي كعلامة في الترويسة — والشعار يبقى في
        // شاشة الدخول والشريط الجانبي وأيقونة التطبيق، فلا يضيع التعرّف عليه.
        h('div.hbrand__name', 'منهاجي'),
        h('button.iconbtn', { onclick: () => App.go('account'), 'aria-label': 'حسابي وإعداداتي' },
          icon.settings(17)),
      ),

      h('div.screen__body', { style: 'padding:10px 16px 8px' },
        h('div.hgreet', `مرحبًا، ${s.username || 'زائر'}`),
        // الهامش يفصل التحية عن البانر؛ بلا بانر يليها عنوان قسم بهامشه
        // الخاص، فيصير المجموع فجوة مضاعفة.
        h('div.hgreet__sub', { style: `margin-bottom:${slides.length ? 14 : 2}px` },
          'شوف جديدنا وأساتذتنا'),

        // أكثر من ستّ شرائح لا يراها الطالب أصلًا (دورة تتجاوز الدقيقتين)،
        // ولا إطارات مفتاحية لها — نكتفي بالستّ الأولى بحسب الترتيب.
        // بلا شرائح لا يُبنى العنصر إطلاقًا: div.promo فارغ يحجز ارتفاعه
        // كاملًا فيترك فجوة بيضاء تحت التحية أسوأ من غياب البانر.
        !slides.length ? null :
        h('div.promo' + (slides.length === 1 ? '.promo--single'
                                             : `.promo--n${Math.min(slides.length, 6)}`),
          ...slides.slice(0, 6).map((sl, i) => {
            const onclick = sl.target ? bannerGo(sl) : null;
            const img = sl.image && Api.publicUrl(sl.image);
            const n = Math.min(slides.length, 6);
            return h('div.promo__slide' + (onclick ? '.promo__slide--tap' : ''),
              {
                // إزاحة كل شريحة بنصيبها من الدورة — المدّة 4 ثوانٍ لكل واحدة
                style: n > 1 ? `animation-delay:${-i * 4}s` : '',
                ...(onclick ? { onclick } : {}),
              },
              // الصورة طبقة خلفية تحت تعتيم — بلا التعتيم يصير النص الأبيض
              // غير مقروء فوق صورة فاتحة، وهو ما لا يُكتشف إلا بعد النشر.
              img && h('img.promo__img', { src: img, alt: '', loading: 'lazy' }),
              img && h('span.promo__scrim'),
              sl.tag && h('div.promo__tag', sl.tag),
              h('div.promo__t', sl.title),
              sl.sub && h('div.promo__s', sl.sub));
          })),
        slides.length > 1
          ? h('div.promo-dots', ...slides.slice(0, 6).map(() => h('i')))
          : null,

        // بطاقة الأستاذ = صورة واحدة مصمَّمة كاملةً باللوحة (الاسم والمادة
        // والخبرة مرسومة داخلها). لا نصّ فوقها من التطبيق: أي نصّ نضعه هنا
        // سيصطدم بنصّ الصورة نفسها ويتكرّر.
        //
        // object-fit: contain لا cover — الصورة مصمَّمة بنسبة يختارها المصمّم،
        // والقصّ يقطع اسم الأستاذ أو وجهه. لا قصّ إطلاقًا، ولو بقي هامش.
        teachers.length ? h('div',
          h('div.sec-label', { style: 'margin-top:20px' }, 'معلمونا المميزون'),
          h('div.teacher-scroll',
            ...teachers.map((t) => h('button.tcard', {
              onclick: () => App.go('teacher', { id: t.id }),
              'aria-label': t.name,
            },
              Api.publicUrl(t.photo)
                ? h('img.tcard__img', { src: Api.publicUrl(t.photo), alt: t.name, loading: 'lazy' })
                // بلا صورة بعد: بطاقة نصّية هادئة بدل مستطيل فارغ يبدو عطلًا
                : h('div.tcard__blank',
                    h('span.tcard__init', t.name[0]),
                    h('div.tcard__name', t.name),
                    t.subjects.length
                      ? h('div.tcard__sub', subjectName(t.subjects[0]))
                      : null),
              // سهم الدخول بالزاوية السفلى اليسرى. عنصر زخرفي داخل الزرّ لا
              // زرّ ثانٍ: البطاقة كلها قابلة للنقر أصلًا، وزرٌّ داخل زرّ HTML
              // غير صالح ويكسر التنقّل بلوحة المفاتيح.
              h('span.tcard__go', icon.fwd(19, { width: 2.6 }))))))
          : h('span'),

        h('div.sec-label', { style: 'margin-top:14px' }, 'خدماتنا'),
        h('div.svc-grid',
          svc(icon.book,  'المنهاج الكامل', 'دروس مصوَّرة بالترتيب', () => App.go('subjects')),
          svc(icon.help,  'بنك الأسئلة',    'تمارين حسب القسم',      goPractice),
          svc(icon.exam,  'امتحانات',       'تجريبية ووزارية',       goExams),
          svc(icon.chart, 'تقدّمك',          'مؤشّرك في كل مادة',      () => App.go('progress'))),

        h('div', { style: 'height:20px' }),
      ),
    );
  };

  // --- ٦. موادّي (لوحة الدراسة الشخصية) ------------------------------------------
  Screens.subjects = () => {
    const s = Store.get();
    // قبل أول مزامنة ناجحة تكون SEED فارغة تمامًا — لا صف ولا مادة ولا درس.
    // كل قراءة من SEED هنا يجب أن تحتمل ذلك، وإلّا انهارت الشاشة الأولى نفسها
    // على طالب فتح التطبيق أول مرة أو بلا إنترنت.

    // «موادّي» = المواد المشترَك بها فعليًا (بعد إزالة طبقة الكورسات) لا كل
    // ما في الكتالوج. sync.js يحسب entitled من وجود وحدات وصلت عبر RLS —
    // لا نفترض شيئًا هنا. كل بطاقة تحسب تقدّمها بنفسها عبر
    // Store.subjectProgress(id) — لا رقم عام مكرَّر على كل البطاقات.
    const entitledSubjects = (SEED.subjects || []).filter((sub) => sub.entitled);

    // الدرس التالي محصور بمواد الطالب المشترَك بها — لا كل درس بالتطبيق،
    // وإلا اقترح عليه إكمال درس بمادة ما هو مشترك فيها أصلًا.
    const entitledLessonIds = entitledSubjects
      .flatMap((sub) => SEED.units.filter((u) => u.subject === sub.id))
      .flatMap((u) => u.lessons || []);
    const nextId = entitledLessonIds.find((id) => s.lessons[id] !== 'done') || entitledLessonIds[0];
    const next = nextId && SEED.lessons[nextId];
    const nextSubjectId = nextId && SEED.units.find((u) => (u.lessons || []).includes(nextId))?.subject;

    // «لمحة سريعة» تحتاج رقمًا واحدًا يمثّل الكل — متوسط تقدّم كل المواد
    // المشترَك بها، لا مادة واحدة مفترَضة. بمادة واحدة (الواقع الحالي) يساوي
    // ببساطة تقدّم تلك المادة.
    const overallPct = entitledSubjects.length
      ? Math.round(entitledSubjects.reduce((a, sub) => a + Store.subjectProgress(sub.id).percent, 0)
          / entitledSubjects.length)
      : 0;

    // لا لافتة «تعمل دون إنترنت» هنا: «موادّي» شاشة عمل يومي يفتحها الطالب
    // عشرات المرّات، ولافتة دائمة تعلوها تُقرأ كتحذير متكرّر بلا فعل مطلوب.
    // تبقى في شاشة المادة و«حسابي» حيث تكون ذات صلة فعلًا.

    return h('div.screen',
      h('header.appbar.appbar--home',
        // بلا شعار: الاسم وحده يكفي كعلامة في الترويسة — والشعار يبقى في
        // شاشة الدخول والشريط الجانبي وأيقونة التطبيق، فلا يضيع التعرّف عليه.
        h('div.hbrand__name', 'منهاجي'),
        h('button.iconbtn', { onclick: () => App.go('account'), 'aria-label': 'حسابي وإعداداتي' },
          icon.settings(17)),
      ),

      h('div.screen__body',
        // (اللافتة أُزيلت من هذه الشاشة — انظر التعليق أعلاه)

        // العنوان محتوى الصفحة لا شريط أدوات — لذلك هو هنا لا في الهيدر.
        // حشوة صريحة لأن .screen__body بلا حشوة بهذه الشاشة (‎.dash يملك حشوته).
        h('div', { style: 'padding:14px 16px 0' },
          h('div.hgreet', 'موادّي'),
          h('div.hgreet__sub' + (s.activated ? '.hgreet__sub--gold' : ''), s.activated
            ? `اشتراكك فعّال — متبقٍ ${ar(s.daysLeft)} يومًا`
            : 'وضع التجربة')),

        h('div.dash',
          // --- العمود الرئيسي: المواد ---
          // بلا عنوان «موادّي» هنا: الترويسة تحمله أصلًا، وتكراره على الهاتف
          // يأكل سطرًا كاملًا من شاشة ضيّقة بلا أي معلومة جديدة.
          h('div.dash__main',
            entitledSubjects.length
              ? h('div.stack.gap-14', ...entitledSubjects.map((subject) => {
                  const p = Store.subjectProgress(subject.id);
                  // عدد الدروس المجانية بهاي المادة — هو ما يستحق سطرًا ذهبيًا
                  // على البطاقة. مدّة الاشتراك مذكورة بالترويسة فوق، وتكرارها
                  // هنا كان يجعل البطاقة تعيد ما قرأه الطالب قبل سطرين.
                  const freeCount = SEED.units
                    .filter((u) => u.subject === subject.id)
                    .flatMap((u) => u.lessons || [])
                    .filter((id) => SEED.lessons[id]?.free).length;

                  return h('div.card.card--tap', { onclick: () => App.go('course', { subject: subject.id }) },
                    h('div.subject',
                      ring(p.percent, 56, 6),
                      h('div.subject__body',
                        h('div.subject__title', subject.name),
                        h('div.subject__meta',
                          // بلا فاصل يتيم حين يكون الصف مجهولًا
                          [gradeOfSubject(subject.id), `${ar(p.lessonsDone)} من ${ar(p.lessonsTotal)} درسًا`]
                            .filter(Boolean).join(' · ')),
                        freeCount
                          ? h('div.subject__sub',
                              `${ar(freeCount)} ${freeCount === 1 ? 'درس مجاني متاح' : 'دروس مجانية متاحة'}`)
                          : null)));
                }))
              // بلا شاشة اكتشاف/كتالوج حاليًا (أُزيلت مع طبقة الكورسات) — طالب
              // بلا اشتراك فعّال يُوجَّه للدعم مباشرة لا لتصفّح كتالوج غير موجود.
              : C.empty({
                  title: 'لا اشتراك فعّال بعد',
                  text: 'تواصل مع الدعم لتفعيل مادة على حسابك.',
                }),
          ),

          // --- العمود الجانبي: الفعل التالي والسياق ---
          h('aside.dash__side',
            // «تابع من حيث توقفت» بلا درس تالٍ لا معنى له — تُحذف البطاقة كلها
            // بدل عرض بطاقة فارغة بزرّ يقود إلى لا شيء.
            next && h('div.card.card--pad',
              h('div.next-eyebrow', 'تابع من حيث توقفت'),
              h('div.next-title', next.title),
              h('div.next-meta',
                `فيديو ${next.video.length} · ${ar(next.exercises.length)} تمارين`),
              h('button.btn.btn--primary.btn--block', {
                onclick: () => App.go('lesson', { id: nextId, subject: nextSubjectId }),
              }, 'أكمل الدرس')),

            // «تفاصيل تقدّمك» لم يعد زرًّا هنا: «تقدّمي» صار وجهة ثابتة بشريط
            // التنقّل السفلي، فالزر تكرار لطريق موجود أصلًا على بُعد نقرة.
            h('div.card.card--pad',
              h('div', { style: 'font-weight:600;font-size:13.5px;margin-bottom:6px' }, 'لمحة سريعة'),
              h('div.stat-row',
                h('div.stat',
                  h('div.stat__v', ar(overallPct) + '٪'),
                  h('div.stat__k', 'تقدّمك')),
                h('div.stat',
                  h('div.stat__v', { style: 'color:var(--gold)' }, ar(s.downloaded.length)),
                  h('div.stat__k', 'دروس محفوظة')))),

            !s.activated && h('div.callout',
              h('div.callout__t', 'أنت في وضع التجربة'),
              h('div.muted.small', { style: 'margin-bottom:10px' },
                'الدروس المجانية فقط متاحة. ادخل بكودك لفتح كل المنهاج والامتحانات.'),
              h('button.btn.btn--primary.btn--sm', { onclick: () => App.go('auth') },
                'دخول بكود التفعيل'))),
        ),

        h('div', { style: 'height:20px' }),
      ),
    );
  };

  // --- ملف الأستاذ ---------------------------------------------------------------
  // لا سيرة ذاتية مختلَقة لشخص حقيقي: فقرة النبذة تظهر فقط إن وصلت فعليًا من
  // قاعدة البيانات (t.bio)، وإلا تُحذف كليًا بدل نص افتراضي مكذوب.
  Screens.teacher = (params) => {
    const t = (SEED.teachers || []).find((x) => x.id === params.id);
    const wrap = h('div.screen');

    if (!t) {
      wrap.append(
        C.appbar({ title: 'الأستاذ', onBack: () => App.back() }),
        h('div.screen__body', { style: 'padding:16px' },
          C.empty({ title: 'تعذّر إيجاد هذا الأستاذ' })));
      return wrap;
    }


    const subjectRows = t.subjects.map((code) => {
      const subject = SEED.subjects.find((sub) => sub.id === code);
      const units = SEED.units.filter((u) => u.subject === code);
      const lessons = units.flatMap((u) => u.lessons || []).length;
      return h('button.tsubj', { onclick: () => App.go('course', { subject: code }) },
        h('div.tsubj__ico', subject?.native ? subject.native.slice(0, 2) : (subject?.name || code)[0]),
        h('div.tsubj__b',
          h('b', subject?.name + (gradeOfSubject(code) ? ` — ${gradeOfSubject(code)}` : '')),
          h('span', `${ar(lessons)} درسًا · ${ar(units.length)} وحدات`)),
        h('span.tsubj__chip' + (subject?.entitled ? '.tsubj__chip--on' : ''),
          subject?.entitled ? 'مشترَك' : 'تفاصيل'));
    });

    // سطر تعريفي مشتقّ من المواد التي يقدّمها فعلًا — لا لقب مُختلَق.
    const tag = t.subjects.length
      ? 'أستاذ ' + (SEED.subjects.find((x) => x.id === t.subjects[0])?.name || '')
      : '';

    const photo = Api.publicUrl(t.photo);

    let pane = 'content';
    const tabsEl = h('div.seg');
    const paneEl = h('div');

    wrap.append(
      // زرّ الرجوع وحده يبقى ثابتًا فوق الشاشة. الصورة تمرّ مع المحتوى
      // (كانت خارج .screen__body فتبقى معلّقة والنصّ ينزلق تحتها)، ولو مرّ
      // الزرّ معها لاختفى مسار الرجوع الوحيد بمجرّد تمرير سطرين.
      h('button.iconbtn.teacher-back',
        { onclick: () => App.back(), 'aria-label': 'رجوع' }, icon.back(16)),

      h('div.screen__body', { style: 'padding-top:0' },
        // عمود واحد على كل المقاسات: الصورة ثم النصّ تحتها. الصورة وحدها
        // تُحدّ عرضًا على الشاشات الواسعة (CSS) فلا تبتلع الشاشة.
        // وهي داخل منطقة التمرير ⇒ تمرير طبيعي لا ترويسة مثبّتة.
        photo
          ? h('div.teacher-hero-img', h('img', { src: photo, alt: t.name }))
          : h('div.teacher-cover'),

        h('div.teacher-head' + (photo ? '.teacher-head--flat' : ''),
          photo ? null : h('div.teacher-av', t.name[0]),
          h('div.teacher-name', t.name),
          tag && h('div.teacher-tag', tag),
          // إحصاءات حقيقية محسوبة من المحتوى الواصل فعلًا: لا «سنوات خبرة»
          // ولا «تقييم طلاب» — لا مصدر لهما بقاعدة البيانات، واختلاقهما عن
          // شخص حقيقي كذب صريح لا مجرّد نقص بيانات.
          h('div.teacher-stats',
            h('div', h('b', ar(t.subjects.length)), ` ${t.subjects.length === 1 ? 'مادة' : 'مواد'}`),
            h('div', h('b', ar(t.subjects.reduce((a, c) =>
              a + SEED.units.filter((u) => u.subject === c).flatMap((u) => u.lessons || []).length, 0))),
              ' درسًا'))),

        tabsEl,
        paneEl,
        h('div', { style: 'height:20px' }),
      ),
    );

    // --- قسمان: «ما يقدّمه» أولًا، ثم «السيرة الذاتية» ------------------------
    // ما يبحث عنه الطالب أولًا هو المحتوى لا السيرة، فهو التبويب الافتراضي.
    // بلا سيرة مسجَّلة لا نعرض تبويبًا فارغًا — يبقى القسم الأول وحده بلا شريط.
    function paneContent() {
      return subjectRows.length
        ? h('div', ...subjectRows)
        : h('div', { style: 'padding:0 16px' },
            C.empty({ title: 'لا مواد مرتبطة بهذا الأستاذ بعد' }));
    }
    function paneBio() {
      return h('div.teacher-bio', t.bio);
    }

    function drawPane() {
      paneEl.replaceChildren(pane === 'bio' ? paneBio() : paneContent());
    }
    function drawTabs() {
      if (!t.bio) return;   // لا شريط بتبويب واحد
      tabsEl.replaceChildren(...[
        ['content', 'ما يقدّمه'],
        ['bio', 'السيرة الذاتية'],
      ].map(([id, label]) => h('button', {
        'aria-selected': pane === id ? 'true' : 'false',
        onclick: () => { pane = id; drawTabs(); drawPane(); },
      }, label)));
    }
    drawTabs();
    drawPane();

    return wrap;
  };

  // --- ١٢. حسابي ---------------------------------------------------------------
  Screens.account = () => {
    const wrap = h('div.screen');
    const body = h('div.screen__body');

    function draw() {
      const s = Store.get();
      const dl = s.downloaded.map((id) => SEED.lessons[id]).filter(Boolean);
      const banner = C.syncBanner();

      body.replaceChildren(
        banner ? h('div', { style: 'padding:14px 16px 0' }, banner) : h('span'),

        h('div.dash',
          h('div.dash__main',
            h('div.card.card--pad',
              h('div', { style: 'font-weight:600' }, 'اشتراك اللغة الفرنسية'),
              s.activated
                ? h('div', { style: 'color:var(--gold);font-weight:600;font-size:14px;margin-top:4px' },
                    `متبقٍ ${ar(s.daysLeft)} يومًا`)
                : h('div.muted.small', { style: 'margin-top:4px' }, 'غير مفعّل — أنت في وضع التجربة'),
              // بلا `?.` كان هذا يرمي استثناءً ويُسقط شاشة «حسابي» كليًا حالما
              // يصير الصف فارغًا (وهو الوضع الطبيعي قبل أول مزامنة).
              h('div.faint.small', { style: 'margin-top:4px' },
                s.activated
                  ? `المستخدم: ${s.username}`
                    + (gradeNameOf(s.grade) ? ` · ${gradeNameOf(s.grade)}` : '')
                  : 'الدروس المجانية فقط متاحة'),
              !s.activated && h('button.btn.btn--primary.btn--sm', {
                style: 'margin-top:12px', onclick: () => App.go('auth'),
              }, 'دخول بكود التفعيل')),

            h('div.card',
              h('div', { style: 'padding:16px 16px 10px;font-weight:600' }, 'التنزيلات'),
              dl.length
                ? h('div.list-sep', ...dl.map((l) => h('div.row', { style: 'padding:12px 16px' },
                    h('div.grow',
                      h('div.small', l.title),
                      h('div.faint', { style: 'font-size:12px' },
                        `فيديو ${l.video.length} · نص · تمارين`)),
                    h('button.btn.btn--secondary.btn--sm', {
                      onclick: () => { Store.toggleDownload(l.id); draw(); },
                    }, 'حذف'))))
                : C.empty({
                    img: 'assets/img/empty-download.svg',
                    title: 'لا توجد دروس منزَّلة',
                    text: 'نزّل الدروس التي تريدها مرة واحدة، ثم ادرسها دون إنترنت في أي وقت.',
                    action: (() => {
                      const firstSubject = (SEED.subjects || []).find((sub) => sub.entitled);
                      return firstSubject && h('button.btn.btn--primary', {
                        onclick: () => App.go('course', { subject: firstSubject.id }),
                      }, 'تصفّح الدروس');
                    })(),
                  }))),

          h('aside.dash__side',
            // الحماية صارت بالجلسة الواحدة لا بربط الجهاز: تبديل الجهاز حرّ،
            // والدخول الجديد يُنهي السابق. النصّ هنا يجب أن يقول ذلك بوضوح
            // وإلّا ظنّ الطالب أنه مقيَّد بجهاز واحد إلى الأبد.
            h('div.card',
              h('div', { style: 'padding:16px 16px 8px;font-weight:600' }, 'جلستك الحالية'),
              s.activated
                ? h('div', { style: 'padding:0 16px 12px' },
                    h('div.small', { style: 'font-weight:600' }, Device.label()),
                    h('div.faint', { style: 'font-size:12px;margin-bottom:14px' },
                      s.lastSync ? 'آخر مزامنة قبل قليل' : 'نشطة الآن'),
                    h('button.btn.btn--secondary.btn--sm', {
                      onclick: () => {
                        if (!confirm('سيُغلق التطبيق حسابك على هذا الجهاز.\n\n'
                          + 'تستطيع الدخول متى شئت باسمك وكودك. متابعة؟')) return;
                        Api.signOut();
                        Sync.clearContent();
                        Store.set({ signedIn: false, evicted: false });
                        App.go('auth');
                      },
                    }, 'تسجيل الخروج'))
                : h('div.muted.small', { style: 'padding:4px 16px 12px' },
                    'أنت في وضع التجربة — لا جلسة مرتبطة.'),
              h('div.hint', { style: 'padding:0 16px 14px' },
                'اشتراكك يعمل على أي جهاز، لكن على جهاز واحد في الوقت نفسه. '
                + 'إن دخلت من جهاز آخر يُغلق هذا تلقائيًا.')),

            // تبديل المظهر مكانه هنا لا بترويسة الشاشات: زر بالترويسة يُقرأ
            // كوجهة لا كخيار، وشكله (شمس/قمر) كان يُخلط بزر الإعدادات نفسه.
            h('div.card.card--pad.row',
              h('div.grow',
                h('div', { style: 'font-weight:600' }, 'مظهر التطبيق'),
                h('div.faint', { style: 'font-size:12px;margin-top:2px' },
                  s.theme === 'dark' ? 'الوضع الليلي مفعّل' : 'الوضع النهاري مفعّل')),
              h('div.theme-toggle',
                h('span.theme-ic' + (s.theme !== 'dark' ? '.is-on' : ''), icon.sun(16)),
                h('button.switch' + (s.theme === 'dark' ? '.is-on' : ''), {
                  'aria-label': 'تبديل الوضع الليلي',
                  onclick: () => { Store.setTheme(s.theme === 'dark' ? 'light' : 'dark'); draw(); },
                }, h('i')),
                h('span.theme-ic' + (s.theme === 'dark' ? '.is-on' : ''), icon.moon(16)))),

            h('div.card.card--pad.row',
              h('div.grow',
                h('div', { style: 'font-weight:600' }, 'محاكاة انقطاع الإنترنت'),
                h('div.faint', { style: 'font-size:12px;margin-top:2px' },
                  'لتجربة سلوك التطبيق دون اتصال')),
              h('button.switch' + (!s.online ? '.is-on' : ''), {
                'aria-label': 'وضع أوفلاين',
                onclick: () => { Store.toggleOnline(); App.drawRail(); draw(); },
              }, h('i'))),

            h('button.btn.btn--ghost.btn--block', {
              style: 'color:var(--err)',
              onclick: () => {
                if (confirm('سيُمسح تقدّمك في هذه التجربة. متابعة؟')) { Store.reset(); App.go('auth'); }
              },
            }, 'إعادة ضبط التجربة')),
        ),
      );
    }
    draw();

    wrap.append(C.appbar({ title: 'حسابي', onBack: () => App.back() }), body);
    return wrap;
  };
})();
