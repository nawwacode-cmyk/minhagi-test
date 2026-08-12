/* =============================================================================
   الرئيسية (اكتشاف) · موادّي · ملف الأستاذ · حسابي
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, ring, bar, subjectIconEl } = UI;

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

  /**
   * وجهة خبر «آخر الأخبار» عند النقر — بلا هدف مخصَّص يبقى إعلاميًا محضًا لا
   * يُنقر (لا معنى لوجهة افتراضية هنا؛ البانر عاد صفحته الوحيدة الآن بعد أن
   * أُزيل من «الرئيسية»، فلا شاشة أخرى يقود إليها افتراضيًا).
   */
  function bannerGo(b) {
    const t = b.target;
    if (t?.type === 'subject') return () => App.go('course', { subject: t.value });
    if (t?.type === 'teacher') return () => App.go('teacher', { id: t.value });
    if (t?.type === 'url') return () => window.open(t.value, '_blank', 'noopener');
    return null;
  }

  /* ===========================================================================
     كومة بطاقات الأخبار — أحدث عشرة

     الفكرة من مكوّن React يعتمد framer-motion، وأُعيد بناؤها بفانيلا JS
     وانتقالات CSS كما فُعل بسبينر القلم: المشروع بلا خطوة بناء، وإدخال مكتبة
     رسوم لأجل كومةٍ واحدة كلفةٌ يحملها كل طالب في كل فتحة.

     ثلاث بطاقات ظاهرة من عشرة. الموضع `--p` (٠·١·٢) هو كل شيء: CSS يترجمه
     إلى إزاحةٍ ومقياسٍ وشفافية، وJS لا يفعل غير تغيير الرقم — فالحركة كلّها
     على المُركِّب (transform/opacity) ولا تُعيد تخطيط الصفحة.

     ثلاثة قيود تحكمها:
     ١. النقر على الواجهة يفتح خبرها، ولا يُبدّل — التبديل زرٌّ مستقلّ.
        بطاقةٌ تتحرّك تحت الإصبع تجعل الطالب يفتح خبرًا لم يقصده.
     ٢. الدورة تقف عند مغادرة العقدة الصفحة، وعند `prefers-reduced-motion`.
     ٣. بخبرٍ واحد لا دورة ولا زرّ: حركةٌ بلا وجهة ثانية تشويش.
     ========================================================================= */
  const STACK_MS = 5000;
  const STACK_SHOWN = 3;

  function newsStack(posts) {
    if (!posts.length) return null;

    const box = h('div.nstack');
    const wrap = h('div.nstack__w');
    let top = 0;
    let timer = null;
    let busy = false;

    const calm = () => {
      try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch { return false; }
    };

    const cardEl = (p, pos) => {
      const img = p.image && Api.publicUrl(p.image);
      return h('button.scard', {
        style: `--p:${pos}`, 'aria-hidden': pos ? 'true' : null,
        // الخلفية لا تُنقر: هي زخرفةٌ خلف الواجهة لا هدفٌ مستقلّ
        tabIndex: pos ? -1 : 0,
        onclick: () => { if (!pos) App.go('post', { id: p.id }); },
      },
        img ? h('img.scard__i', { src: img, alt: '', loading: 'lazy' })
            : h('span.scard__i.scard__i--blank', icon.news(22)),
        h('span.scard__b',
          h('span.scard__t', p.title),
          h('span.scard__m', [since(p.at), CATS[p.category]].filter(Boolean).join(' · '))));
    };

    function draw() {
      const n = Math.min(STACK_SHOWN, posts.length);
      // الأبعد أوّلًا في الـDOM: الأقرب يعلوه بلا z-index لكل بطاقة
      const nodes = [];
      for (let k = n - 1; k >= 0; k--) nodes.push(cardEl(posts[(top + k) % posts.length], k));
      wrap.replaceChildren(...nodes);
    }

    function advance() {
      if (busy || posts.length < 2) return;
      busy = true;
      /* الواجهة هي **آخر عقدة** لا نتيجةَ بحثٍ في سمة النمط: `draw` تضع
         الأبعد أوّلًا، والبحث بـ`[style*="--p:0"]` يكسره أوّل تغييرٍ في
         التنسيق (مسافة بعد النقطتين مثلًا) بلا أن يُخطئ أحد. */
      const front = wrap.lastElementChild;
      if (!front) { busy = false; return; }

      /* الخروج ثم إعادة الرسم: البطاقة المغادِرة تُصنَّف `is-out` فتنزلق
         وتتلاشى، والبقيّة تتقدّم بتغيّر `--p` وحده. وبعد انتهاء الحركة
         يُعاد البناء — لا ننتظر `transitionend` وحده لأنه لا يُطلق إن كانت
         الحركة معطَّلة، فيتجمّد التبديل إلى الأبد. */
      front.classList.add('is-out');
      [...wrap.children].forEach((el) => {
        if (el === front) return;
        const p = Number(el.style.getPropertyValue('--p')) - 1;
        el.style.setProperty('--p', String(p));
      });

      setTimeout(() => {
        top = (top + 1) % posts.length;
        draw();
        busy = false;
      }, calm() ? 0 : 320);
    }

    function arm() {
      clearInterval(timer);
      if (posts.length < 2 || calm()) return;
      timer = setInterval(() => {
        // غادرت الصفحة: لا شيء ينظّف عند تبديل الشاشة، فبلا هذا يبقى مؤقّتٌ
        // يعمل إلى الأبد لكل زيارةٍ للرئيسية.
        if (!box.isConnected) { clearInterval(timer); return; }
        advance();
      }, STACK_MS);
    }

    draw();
    box.append(wrap);

    if (posts.length > 1) {
      box.append(h('div.nstack__f',
        h('span.nstack__n', `${ar(posts.length)} أخبار`),
        h('button.nstack__b', {
          'aria-label': 'الخبر التالي',
          onclick: () => { advance(); arm(); },   // نقرةٌ يدوية تُعيد ضبط المؤقّت
        }, icon.fwd(16))));
    }

    arm();
    return box;
  }

  // --- ٥. الرئيسية (اكتشاف) -----------------------------------------------------
  // «الرئيسية» واجهة تعريفية منفصلة عن «موادّي» (Screens.subjects أدناه) التي
  // تحمل لوحة الدراسة الفعلية. كل نصّ هنا دائم وصادق — لا عروض مؤقّتة.
  //
  // «خدماتنا» أُزيلت: أربع بطاقات تكرّر ما يبلغه الشريط السفلي أصلًا (المنهاج،
  // الأسئلة، الامتحانات، التقدّم)، فتشغل الصفحة بطريقٍ ثانٍ إلى الوجهة نفسها.

  Screens.home = () => {
    const s = Store.get();
    const teachers = SEED.teachers || [];
    const subjectName = (code) => (SEED.subjects || []).find((x) => x.id === code)?.name || code;
    const subjects = (SEED.subjects || []).filter((x) => x.entitled);
    const posts = SEED.banners || [];

    /* --- الدرس التالي ------------------------------------------------------
       ما حالته `doing` أوّلًا: الطالب تركه في منتصفه فهو أصدق جواب لسؤال
       «وين كنت واقف». وإلّا فأوّل درس لم يُنجَز بترتيب المنهاج. */
    const ordered = subjects
      .flatMap((sub) => (SEED.units || []).filter((u) => u.subject === sub.id))
      .flatMap((u) => (u.lessons || []).map((id) => ({ id, unit: u })));
    const nextEntry = ordered.find((x) => s.lessons[x.id] === 'doing')
      || ordered.find((x) => s.lessons[x.id] !== 'done');
    const nextLesson = nextEntry && SEED.lessons[nextEntry.id];

    // نسبة الإنجاز الكلّية — متوسط المواد المشترَك بها لا مادةً مفترَضة
    const overall = subjects.length
      ? Math.round(subjects.reduce((a, x) => a + Store.subjectProgress(x.id).percent, 0) / subjects.length)
      : 0;
    const bestExam = Math.max(0, ...Object.values(s.exams || {}).map((e) => e.best || 0));

    /* قائمة «موادّي»: صفٌّ لكل مادة، وسهمٌ يفتح صفّ أستاذها تحته — بدل شريط
       حلقات أفقي ما كان يتّسع لصورة الأستاذ أصلًا. حالة «أيّ مادة مفتوحة»
       محلّية للشاشة لا `Store`: عرضٌ مؤقّت لا يستحقّ حفظًا ولا مزامنة.

       الضغط على أي مكان بالصفّ (رأسه أو صفّ الأستاذ المفتوح تحته) يفتح
       المادة — لا صفحة الأستاذ المستقلّة؛ هذه البطاقة اعتمادٌ على الأستاذ لا
       تصفّحًا له. السهم وحده يبدّل الفتح/الطيّ، بمعزلٍ عن ذلك تمامًا. */
    let openSubject = null;
    const subjList = h('div.slist');
    function drawSubjList() {
      subjList.replaceChildren(...subjects.map((sub, i) => {
        const p = Store.subjectProgress(sub.id);
        const t = teachers.find((x) => (x.subjects || []).includes(sub.id));
        const open = openSubject === sub.id;
        const photo = t && Api.publicUrl(t.photo);

        return h('div.srow' + (open ? '.is-open' : ''),
          { onclick: () => App.go('course', { subject: sub.id }) },
          h('div.srow__head',
            h('span.simg.subj--c' + (i % 4), subjectIconEl(sub.id, 22)),
            h('div.srow__b',
              h('b', sub.name),
              h('small', `${ar(p.lessonsDone)} من ${ar(p.lessonsTotal)} درسًا · ${ar(p.percent)}٪`)),
            t ? h('button.srow__chev', {
                  'aria-label': open ? 'إخفاء الأستاذ' : 'عرض الأستاذ',
                  onclick: (e) => { e.stopPropagation(); openSubject = open ? null : sub.id; drawSubjList(); },
                }, icon.chevron(16)) : null),
          open && t ? h('div.steach',
            photo
              ? h('img.steach__av', { src: photo, alt: '', loading: 'lazy' })
              : h('span.steach__av', t.name[0]),
            h('div.steach__b', h('i', 'الأستاذ'), h('b', t.name))) : null);
      }));
    }
    drawSubjList();

    return h('div.screen',
      /* لا ترويسة: التحية والزرّان أوّلُ **محتوى الصفحة** داخل منطقة التمرير،
         فيمضيان معه كأي عنصر. هذا يلغي منطق الإخفاء كلّه — لا قياس ارتفاع
         ولا هامش سالب ولا مستمع تمرير. */
      h('div.screen__body', { style: 'padding:14px 16px 8px' },
        C.homeHeader(C.greeting(), s.username || 'زائر'),

        /* تنبيه الاشتراك **شرطيّ**: تحت أسبوعين فقط. تنبيهٌ دائم يصير أثاثًا
           لا يُقرأ، فحين يقترب الانتهاء فعلًا لا يراه أحد. */
        s.activated && s.daysLeft > 0 && s.daysLeft <= 14
          ? h('button.warnbar', { onclick: () => App.go('account') },
              icon.warn(17),
              h('span.grow', `اشتراكك ينتهي بعد ${ar(s.daysLeft)} يومًا`),
              icon.fwd(15, { width: 2.4 }))
          : null,

        /* أهمّ عنصر في الصفحة: الطالب يفتح التطبيق ومعه سؤال واحد. بلا مادة
           مشترَك بها لا بطاقة — لا نعرض زرًّا يقود إلى لا شيء. */
        nextLesson
          ? h('div', { style: 'margin-top:14px' },
              C.continueCard({
                eyebrow: s.lessons[nextEntry.id] === 'doing' ? 'تابِع من حيث وقفت' : 'ابدأ من هنا',
                title: nextLesson.title,
                meta: `${subjectName(nextEntry.unit.subject)} · ${nextEntry.unit.title}`,
                pct: Store.unitProgress(nextEntry.unit).pct,
                label: s.lessons[nextEntry.id] === 'doing' ? 'تابِع' : 'ابدأ',
                onclick: () => App.go('lesson', { id: nextEntry.id, subject: nextEntry.unit.subject }),
              }))
          : null,

        /* الشريط الثلاثي. أرقامه كلّها محسوبة من التخزين المحلّي، فالصفحة
           تكتمل بلا إنترنت — وهو وعد التطبيق أصلًا. والأصفار تُعرض كما هي:
           طالبٌ جديد يرى صفرًا صادقًا لا رقمًا مُجامِلًا. */
        subjects.length
          ? h('div.trio', { style: 'margin-top:14px' },
              h('button.trio__c', { onclick: () => App.go('progress') },
                h('b', ar(overall) + '٪'), h('small', 'إنجازك')),
              h('button.trio__c', { onclick: () => App.go('progress') },
                h('b.trio--ok', ar(bestExam) + '٪'), h('small', 'أفضل امتحان')),
              h('button.trio__c', { onclick: () => App.go('plan') },
                h('b.trio--gold', ar(s.daysLeft || 0)), h('small', 'يومًا متبقّيًا')))
          : null,

        // موادّي: قائمة عمودية، صورة المادة بدل حلقة تقدّم، وسهم يفتح أستاذها
        subjects.length
          ? h('div',
              h('div.sec-label.sec-label--row', { style: 'margin-top:20px' },
                h('span', 'موادّي'),
                h('button.sec-more', { onclick: () => App.go('subjects') }, 'الكل')),
              subjList)
          : null,

        /* قسم «معلمونا المميزون» انشال — الأستاذ صار ظاهرًا مباشرة تحت
           مادته بقائمة «موادّي» أعلاه (سهم يفتح صفّه)، فتكرار عرضه بشريط
           منفصل هون صار عرضًا لنفس المعنى بشكلين. */

        /* مدخلٌ إلى القسم لا نسخةٌ منه: خبران فقط. عرضُ القائمة كاملةً هنا
           يجعل تبويب «آخر الأخبار» بلا سبب لوجوده. */
        posts.length
          ? h('div',
              h('div.sec-label.sec-label--row', { style: 'margin-top:20px' },
                h('span', 'آخر الأخبار'),
                h('button.sec-more', { onclick: () => App.go('news') }, 'الكل')),
              newsStack(posts.slice(0, 10)))
          : null,

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
    // بطاقة المادة تحمل أستاذها، فالقائمة لازمة هنا كما في «الرئيسية»
    const teachers = SEED.teachers || [];

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
      h('div.screen__body',
        // (اللافتة أُزيلت من هذه الشاشة — انظر التعليق أعلاه)

        /* «موادّي» عنوانُ الصفحة نفسه، فلا تحيةَ هنا: تحيةٌ فوق عنوان تعني
           عنوانين متراكمين في أعلى شاشة ضيّقة. نفس المكوّن، بلا سطر التحية. */
        h('div', { style: 'padding:14px 16px 0' },
          C.homeHeader(null, 'موادّي', s.activated
            ? `اشتراكك فعّال — متبقٍ ${ar(s.daysLeft)} يومًا`
            : 'وضع التجربة')),

        h('div.dash',
          // --- العمود الرئيسي: المواد ---
          // بلا عنوان «موادّي» هنا: الترويسة تحمله أصلًا، وتكراره على الهاتف
          // يأكل سطرًا كاملًا من شاشة ضيّقة بلا أي معلومة جديدة.
          h('div.dash__main',
            /* بطاقات المواد على نمط المرجع البصري: مربّع ملوّن، أيقونة في
               رقعة شفّافة أعلاه، والاسم أسفله.

               اللون بالترتيب لا بالعشوائية: `color_hex` يُجلب من الخادم لكنه
               لا يُخزَّن في شكل SEED، ولونٌ عشوائي يجعل المادة نفسها تتبدّل
               بين فتحة وأخرى فيضيع تعرّف الطالب عليها بلونها.

               وشريط التقدّم يبقى — أُسقطت الحلقة لا المعلومة: «كم أنجزتُ» هو
               سبب دخول الطالب هذه الشاشة، وشريطٌ رفيع أسفل البطاقة يقولها
               بلغة المرجع بلا أن يزاحم الاسم. */
            entitledSubjects.length
              ? h('div.subj-grid', ...entitledSubjects.map((subject, i) => {
                  const p = Store.subjectProgress(subject.id);
                  // أستاذ المادة — من `teachers[].subjects` الذي يبنيه sync
                  const t = teachers.find((x) => (x.subjects || []).includes(subject.id));
                  const photo = t && Api.publicUrl(t.photo);

                  return h('button.subj', {
                    class: 'subj--c' + (i % 4),
                    onclick: () => App.go('course', { subject: subject.id }),
                    'aria-label': subject.name,
                  },
                    h('span.subj__top',
                      h('span.subj__ico', subjectIconEl(subject.id, 20)),
                      /* موضع «علامة الحفظ» في المرجع — شغلناه بالتقدّم بدل
                         أيقونة زخرفية: نفس التوازن البصري، ومعلومةٌ يقصدها
                         الطالب فعلًا. (وقد سبق أن رُفضت علامة الحفظ.) */
                      h('span.subj__pct', ar(p.percent) + '٪')),

                    h('span.subj__name', subject.name),

                    // الأستاذ: صورة دائرية صغيرة واسمه بجانبها — كما في المرجع
                    t ? h('span.subj__teacher',
                          photo
                            ? h('img', { src: photo, alt: '', loading: 'lazy' })
                            : h('span.subj__init', t.name[0]),
                          h('span.subj__tn',
                            h('i', 'الأستاذ'),
                            h('b', t.name)))
                      : h('span.subj__meta',
                          [gradeOfSubject(subject.id),
                           `${ar(p.lessonsTotal)} ${p.lessonsTotal === 1 ? 'درس' : 'درسًا'}`]
                            .filter(Boolean).join(' · ')),

                    // قصّة الحافّة بسهم — بديل «طيّة الكتاب» في المرجع
                    h('span.subj__notch', icon.fwd(13, { width: 2.6 })));
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
            /* الشريط يعرض تقدّم **المادة** لا الدرس، والنصّ يقول ذلك صراحةً:
               المتجر يخزّن حالة الدرس (`doing`/`done`) ولا يخزّن نسبةً داخله،
               فشريطٌ يوحي بموضعك في الدرس رقمٌ مُختلَق. */
            next && C.continueCard({
              eyebrow: 'تابع من حيث توقفت',
              title: next.title,
              meta: `فيديو ${next.video.length} · ${ar(next.exercises.length)} تمارين`
                  + (nextSubjectId ? ` · أنجزت ${ar(Store.subjectProgress(nextSubjectId).percent)}٪ من المادة` : ''),
              pct: nextSubjectId ? Store.subjectProgress(nextSubjectId).percent : 0,
              label: 'أكمل الدرس',
              onclick: () => App.go('lesson', { id: nextId, subject: nextSubjectId }),
            }),

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
      const subject = (SEED.subjects || []).find((sub) => sub.id === code);
      const units = (SEED.units || []).filter((u) => u.subject === code);
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
      ? 'أستاذ ' + ((SEED.subjects || []).find((x) => x.id === t.subjects[0])?.name || '')
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

  /* ---------------------------------------------------------------------------
     آخر الأخبار

     مصدرٌ واحد (`SEED.banners`) لا محتوًى مستقلّ: نشرٌ من اللوحة يظهر في
     الرئيسية والقسم بلا ازدواج عمل. والرئيسية تعرض مقتطفًا من عنصرين، فهذا
     هو المكان الذي تُقرأ فيه الأخبار كاملةً.

     لا محتوى تجريبي: بلا خبرٍ منشور الشاشة فارغة بوضوح — لا نخترع خبرًا لم
     يُنشر لنملأ الفراغ.
  --------------------------------------------------------------------------- */
  const CATS = {
    update:       'تحديثات التطبيق',
    announcement: 'إعلانات',
    news:         'أخبار',
  };

  /** كل مدّة يتبدّل المثبَّت المعروض. أربع ثوانٍ: تكفي لقراءة عنوانٍ قصير
      ولا تجعل الصفحة تتحرّك تحت عين القارئ. */
  const PIN_MS = 4000;

  /** «منذ ٣ ساعات» — التاريخ المطلق لا يقول للطالب أجديدٌ هو أم لا. */
  function since(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';           // تاريخٌ فاسد لا يُرسم «Invalid Date»
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${ar(mins)} ${mins === 1 ? 'دقيقة' : 'دقائق'}`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `منذ ${ar(hrs)} ${hrs === 1 ? 'ساعة' : hrs === 2 ? 'ساعتين' : 'ساعات'}`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `منذ ${ar(days)} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}`;
    // أبعد من أسبوع: التاريخ نفسه أوضح من «منذ ٣٤ يومًا»
    return new Date(iso).toLocaleDateString('ar-SY', { day: 'numeric', month: 'long' });
  }

  Screens.news = () => {
    const all = SEED.banners || [];
    /* شارة «جديد» تُحسب على الجهاز: آخر مرّة فُتح فيها القسم مقابل تاريخ
       النشر. لا عمود خادم لها — «جديد» صفةٌ بالنسبة إلى هذا الطالب لا إلى
       الخبر، فطالبٌ قرأه أمس وآخر لم يفتح التطبيق منذ شهر لا يريان الشيء نفسه. */
    const seenAt = Store.get().newsSeenAt;
    const isNew = (p) => !!p.at && (!seenAt || p.at > seenAt);

    if (!all.length) {
      return h('div.screen',
        C.appbar({ title: 'آخر الأخبار', onBack: () => App.back() }),
        h('div.screen__body', { style: 'padding:16px' },
          C.empty({
            title: 'لا أخبار منشورة بعد',
            text: 'كل جديد يُنشر من لوحة الإدارة يظهر هنا فور اعتماده.',
          })));
    }

    // المثبَّت يتصدّر بصورةٍ كبيرة. أوّلُ مثبَّت فقط: بطاقتان كبيرتان تُلغيان
    // معنى التصدير أصلًا.
    // كلّ المثبَّتات لا أوّلها: تتبادل تلقائيًّا في الشريط أعلى القسم
    const pinned = all.filter((p) => p.pinned);
    let filter = 'all';

    const listBox = h('div.newsfeed');
    const chipsBox = h('div.nchips');

    /* الشرائح تُبنى من التصنيفات **الموجودة فعلًا** لا من القائمة الثابتة:
       شريحةٌ فارغة تُنقر فلا يظهر شيء أسوأ من غياب التصنيف. وتُخفى كلّها إن
       كان الكلّ من تصنيف واحد — لا معنى لمصفاةٍ بخيار واحد. */
    const present = [...new Set(all.map((p) => p.category).filter((c) => CATS[c]))];

    /* المثبَّت يبقى في القائمة أيضًا — لا يختفي منها لأنه صُدِّر.
       كان يُستبعَد، فيبدو للطالب أن الخبر «ذهب» حين يُثبَّت، ويتعذّر إيجاده
       بالتصنيف. التصدير إبرازٌ لا نقل. */
    function drawList() {
      const rows = all.filter((p) => filter === 'all' || p.category === filter);
      listBox.replaceChildren(...(rows.length
        ? rows.map(newsRow)
        : [C.empty({ title: 'لا شيء في هذا التصنيف', text: 'جرّب تصنيفًا آخر.' })]));
    }

    function drawChips() {
      if (present.length < 2) return;
      chipsBox.replaceChildren(
        ...[['all', 'الكل'], ...present.map((c) => [c, CATS[c]])].map(([key, label]) =>
          h('button.nchip', { class: filter === key ? 'is-on' : '',
                             onclick: () => { filter = key; drawChips(); drawList(); } }, label)));
    }

    function newsRow(p) {
      const go = () => App.go('post', { id: p.id });
      const img = p.image && Api.publicUrl(p.image);
      return h('button.item', { onclick: go },
        img ? h('img.item__i', { src: img, alt: '', loading: 'lazy' })
            : h('span.item__i.item__i--blank', icon.news(19)),
        h('div.grow',
          h('b', p.title),
          p.sub ? h('small', p.sub) : null,
          h('div.item__m',
            isNew(p) ? h('span.tag-new', 'جديد') : null,
            h('span', since(p.at) || CATS[p.category] || ''))));
    }

    drawChips();
    drawList();

    // يُعلَّم القسم مقروءًا عند فتحه، فالشارات تختفي في الزيارة التالية لا في
    // هذه — وإلّا اختفت تحت عين الطالب قبل أن يقرأها.
    const newest = all.map((p) => p.at).filter(Boolean).sort().pop();
    if (newest && newest !== seenAt) setTimeout(() => Store.set({ newsSeenAt: newest }), 0);

    const wrap = h('div.screen');
    wrap.append(
      C.appbar({ title: 'آخر الأخبار', onBack: () => App.back() }),
      h('div.screen__body', { style: 'padding:14px 16px 20px' },
        featuredBox(pinned, wrap), chipsBox, listBox));
    return wrap;
  };

  /**
   * شريط المثبَّتات — يتبدّل تلقائيًّا كل بضع ثوانٍ.
   *
   * بمثبَّتٍ واحد لا دورة ولا نقاط: حركةٌ بلا وجهة ثانية تشويش. وبأكثر من
   * واحد تظهر نقاطٌ تُنقر أيضًا — الدورة التلقائية لا تكفي وحدها، فمن رأى
   * خبرًا ومرّ عليه يحتاج طريقة للعودة إليه بلا انتظار دورةٍ كاملة.
   */
  function featuredBox(pinned, screen) {
    if (!pinned.length) return null;

    const box = h('div.feats');
    const dots = h('div.feats__d');
    let i = 0;
    let timer = null;

    const draw = () => {
      const p = pinned[i];
      box.replaceChildren(...[
        h('button.feat', { onclick: () => App.go('post', { id: p.id }) },
          p.image
            ? h('img.feat__i', { src: Api.publicUrl(p.image), alt: '', loading: 'lazy' })
            : h('span.feat__i.feat__i--blank'),
          h('span.feat__tag', 'مثبَّت'),
          h('span.feat__b',
            h('span.feat__t', p.title),
            h('span.feat__s', [since(p.at), CATS[p.category]].filter(Boolean).join(' · ')))),
        pinned.length > 1 ? dots : null,
      ].filter(Boolean));

      if (pinned.length > 1) {
        dots.replaceChildren(...pinned.map((_, n) => h('button.feats__dot', {
          class: n === i ? 'is-on' : '',
          'aria-label': `المثبَّت ${ar(n + 1)}`,
          // نقرةٌ يدوية تُعيد ضبط المؤقّت: قفزةٌ بعد جزء من الثانية تُربك
          onclick: () => { i = n; draw(); arm(); },
        })));
      }
    };

    /* المؤقّت يتوقّف حين تغادر العقدة الصفحة. لا شيء في التطبيق يستدعي
       تنظيفًا عند تبديل الشاشة، فبلا هذا يبقى مؤقّتٌ يعمل إلى الأبد لكل
       زيارةٍ للقسم — نفس علّة مؤقّت الامتحان. */
    function arm() {
      clearInterval(timer);
      if (pinned.length < 2) return;
      timer = setInterval(() => {
        if (!screen.isConnected) { clearInterval(timer); return; }
        i = (i + 1) % pinned.length;
        draw();
      }, PIN_MS);
    }

    draw();
    arm();
    return box;
  }

  /**
   * صفحة الخبر — عنوانٌ وسطرٌ لا يكفيان لخبرٍ يستحقّ النشر.
   * وإن لم يُكتب نصٌّ بعد فالصفحة تعرض ما هو موجود بلا فراغٍ يبدو عطلًا،
   * وتُبقي زرّ الوجهة إن كان للخبر وجهة.
   */
  Screens.post = (params) => {
    const p = (SEED.banners || []).find((x) => x.id === params.id);
    if (!p) return Screens.news();

    const go = bannerGo(p);
    const imgs = (p.images || (p.image ? [p.image] : [])).map(Api.publicUrl).filter(Boolean);

    return h('div.screen',
      C.appbar({ title: CATS[p.category] || 'خبر', onBack: () => App.back() }),
      h('div.screen__body', { style: 'padding:0 0 24px' },
        gallery(imgs),
        h('div', { style: 'padding:16px' },
          h('div.post__m', since(p.at) || ''),
          h('h1.post__t', p.title),
          p.sub ? h('div.post__s', p.sub) : null,
          p.body ? h('div.card.card--pad', { style: 'margin-top:14px' }, UI.prose(p.body)) : null,

          /* المصدر سطرٌ لا زرّ: خبرٌ منقول بلا مصدرٍ ادّعاء، لكنه معلومةٌ
             تُقرأ لا وجهةٌ تُقصد. والرابط زرٌّ صريح يقول أنه يغادر التطبيق —
             رابطٌ يفتح تبويبًا بلا سابق إنذار يبدو للطالب أن التطبيق خرج عن
             سيطرته. */
          p.source ? h('div.post__src', icon.about(15), h('span', `المصدر: ${p.source}`)) : null,
          p.link
            ? h('a.btn.btn--secondary.btn--block', {
                style: 'margin-top:12px', href: p.link,
                target: '_blank', rel: 'noopener noreferrer',
              }, 'فتح الرابط') : null,

          go ? h('button.btn.btn--primary.btn--block', { style: 'margin-top:12px', onclick: go },
                 'اذهب إلى الوجهة') : null)));
  };

  /**
   * معرض صور الخبر.
   *
   * صورةٌ واحدة تُعرض كما هي؛ وأكثر تُعرض شريطًا يُسحب بالإصبع مع نقاط.
   * لا شبكةَ مصغّرات: الخبر يُقرأ لا يُتصفَّح، وشبكةٌ فوق النصّ تدفعه خارج
   * الشاشة قبل أن تُقرأ كلمة.
   */
  function gallery(imgs) {
    if (!imgs.length) return null;
    if (imgs.length === 1) return h('img.post__i', { src: imgs[0], alt: '' });

    const strip = h('div.gal', ...imgs.map((src, n) =>
      h('img.gal__i', { src, alt: '', loading: n ? 'lazy' : null })));
    const dots = h('div.gal__d', ...imgs.map((_, n) =>
      h('i', { class: n === 0 ? 'is-on' : '' })));

    /* النقاط تتبع التمرير لا العكس: السحب هو الحركة الطبيعية هنا، والنقاط
       مؤشّرٌ عليها. `scrollLeft` سالبٌ في RTL على أغلب المتصفّحات، فالقيمة
       المطلقة تجعل الحساب صحيحًا في الاتجاهين. */
    strip.addEventListener('scroll', () => {
      const n = Math.round(Math.abs(strip.scrollLeft) / (strip.clientWidth || 1));
      [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k === n));
    }, { passive: true });

    return h('div', strip, dots);
  }
})();
