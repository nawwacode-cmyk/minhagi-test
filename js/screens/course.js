/* =============================================================================
   الكورس (٣ تبويبات) · الدرس · جلسة التمارين
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, ring, bar, subjectIconEl } = UI;

  /* ---------------------------------------------------------------------------
     الترويسة الثابتة

     الغلاف **لا يتحرّك**: يلتصق في مكانه (`position: sticky` في app.css)
     والمحتوى ينزلق فوقه، فيبدو منكمشًا من تحت ويبقى وجه الأستاذ ظاهرًا حتى
     آخر لحظة.

     ⚠️ لا تُعِد حساب موضعه بجافاسكربت. جُرّب: كان يُحسب من `scrollTop` في كل
     إطار، والمتصفّح يمرّر على خيطٍ منفصل — فبالتمرير السريع تتأخّر جافاسكربت
     وراءه وتبقى الصورة على موضعٍ قديم. لا مستمع تمرير في هذه الشاشة.
  --------------------------------------------------------------------------- */

  // ===========================================================================
  // ٦. شاشة الكورس — الدروس · تمارين · تقدّمي
  // ===========================================================================
  Screens.course = (params) => {
    const wrap = h('div.screen');
    let tab = params.tab || 'lessons';

    // بعد إزالة طبقة الكورسات: هاي الشاشة مادة بعينها لا التطبيق كله — كل
    // تبويب يصفّي بالمادة، وكل تنقّل صادر منها (درس/تمرين/امتحان ورجوعه)
    // يحمل نفس params.subject معه وإلا ضاعت هويّة المادة بمنتصف الرحلة.
    const subjectId = params.subject;
    const subject = SEED.subjects.find((s) => s.id === subjectId);
    const subjectUnits = SEED.units.filter((u) => u.subject === subjectId);
    const subjectLessonIds = subjectUnits.flatMap((u) => u.lessons || []);
    // نوطة المادة وملحقاتها — ملفّاتٌ لا تتبع درسًا بعينه. ما يصل هنا مرّ
    // بسياسة RLS نفسها التي تحرس الوحدات، فلا تصفية صلاحية في هذه الشاشة.
    const subjectDocs = subject?.docs || [];

    const seg = h('div.seg');
    /* شريط التبويبات خارج الورقة عمدًا: `position:sticky` محصورٌ بالكتلة
       الحاوية، فلو بقي داخل `.chero__sheet` لالتصق حتى نهاية الورقة وحدها
       ثم انزلق مع بقيّتها — أي لا يلتصق عمليًّا. كأخٍ مباشرٍ لمنطقة التمرير
       يبقى في الأعلى طوال قائمة الدروس. */
    /* شريط الاسم يسكن داخل نفس الحاوية اللاصقة لا في حاويةٍ ثانية فوقها:
       لاصقان بـ`top:0` يتراكبان.

       وزرّ رجوعٍ فيه: زرّ الغلاف يُغطَّى مع الغلاف، فبلا هذا يفقد الطالب
       مسار الرجوع بمجرّد أن يمرّر. */
    const nameBar = h('div.chero__bar',
      h('button.chero__bb', { onclick: () => App.back(), 'aria-label': 'رجوع' }, icon.back(19)),
      h('span', subject?.name || 'مادتي'));
    const tabs = h('div.chero__tabs', nameBar, seg);
    // خروجه من أعلى منطقة التمرير = لحظة التصاق شريط التبويبات بالضبط
    const sentinel = h('div.chero__sentinel');
    /* ساتر شريط حالة النظام: يظهر مع اسم المادة ويغيب معه، فيبقى الغلاف
       مبلَّغًا تحت الشريط على القمّة ولا يُقصّ شريط التبويبات بعد التمرير. */
    const scrim = h('div.chero__scrim');
    const body = h('div.screen__body');   // كل شيء يمرّ داخلها، الغلاف أوّلًا
    const pane = h('div');                // وحده يتبدّل مع التبويب

    const TABS = [
      ['lessons',  'الدروس'],
      ['practice', 'تمارين'],
      ['exams',    'امتحانات'],
      /* «ملفّات» تبويبٌ رابع لا قسمٌ داخل «الدروس»: النوطة يفتحها الطالب
         مباشرةً بلا أن يمرّ على شجرة الوحدات. وشرطه وجود ملفٍّ فعلًا —
         تبويبٌ يُفتح على فراغ يبدو عطلًا لا ميزةً غير مستعملة. */
      ...(subjectDocs.length ? [['files', 'ملفّات']] : []),
      // «تقدّمي» ليست هنا: هي وجهة ثابتة بشريط التنقّل السفلي، ووجودها في
      // الموضعين يجعل الطالب يرى نفس الشاشة بمسارين ولا يعرف أيّهما «مكانها».
    ];

    // رابطٌ محفوظ بـ?tab=files لمادةٍ حُذفت ملفّاتها يُظهر تبويبًا لا زرَّ له
    if (tab === 'files' && !subjectDocs.length) tab = 'lessons';

    function drawSeg() {
      seg.replaceChildren(...TABS.map(([id, label]) =>
        h('button', {
          'aria-selected': tab === id ? 'true' : 'false',
          onclick: () => { tab = id; drawSeg(); drawBody(); App.drawRail(); },
        }, label)));
    }

    function drawBody() {
      const banner = C.syncBanner();
      pane.replaceChildren(
        banner ? h('div', { style: 'padding:14px 16px 0' }, banner) : h('span'),
        // الافتراضي «الدروس» لا tabProgress: التبويب أُزيل، ورابط قديم محفوظ
        // بـ ?tab=progress كان سيعرض شاشة لا يقابلها زرّ في الشريط.
        tab === 'practice'  ? tabPractice()
        : tab === 'exams'   ? tabExams()
        : tab === 'files'   ? tabFiles()
        : tabLessons(),
      );
      /* بلا إعادة تمرير إلى القمّة: الغلاف صار داخل منطقة التمرير، فالقفز
         إلى الصفر يدفعه في وجه الطالب بعد كل نقرة على تبويب. الشريط لاصقٌ
         في مكانه ويتبدّل ما تحته — والمتصفّح يقصّ التمرير وحده إن قصر
         المحتوى الجديد. */
    }

    // --- تبويب الدروس: مسار الوحدة الحالية + بقية الوحدات مفتوحة دون قفل -------
    // كانت كل الوحدات تُعرض مغلقة بنفس الوزن، وبطاقة «أكمل من هون» جانبية
    // تكرّر نفس المعنى بشكل منفصل. المسار يحلّ محلّها للوحدة الحالية: خطوة
    // واحدة مكبّرة «الآن». وتحته **كل** الوحدات الأخرى بنفس الأكورديون
    // القديم — الطالب يقدر يفتح أي وحدة ويبدأ أي درس فيها ولو ما خلّص
    // الوحدة الحالية؛ لا قفل هنا ولا كان قبلها (`git log` قبل هذا الملف).
    function unitAccordion(u) {
      const s = Store.get();
      const up = Store.unitProgress(u);
      const det = h('details.unit');
      det.appendChild(h('summary.unit__head',
        h('div.grow',
          h('div.unit__title', u.title),
          h('div.row', { style: 'gap:8px' },
            bar(up.pct),
            h('span.faint', { style: 'font-size:11px' }, `${ar(up.done)}/${ar(up.total)}`))),
        h('span.unit__chev', icon.chevron(16))));

      (u.lessons || []).forEach((id, n) => {
        const l = SEED.lessons[id];
        const st = s.lessons[id];
        const state = st === 'done' ? 'done' : st ? 'now' : 'todo';
        det.appendChild(h('div.les.les--' + state,
          { onclick: () => App.go('lesson', { id, subject: subjectId }) },
          h('span.les__s',
            state === 'done' ? icon.check(15)
            : state === 'now' ? icon.play(14)
            : ar(n + 1)),
          h('div.les__b',
            h('div.les__t', l.title),
            h('div.les__m', h('span', `${l.video.length} دقيقة`))),
          h('span.les__go', icon.fwd(17))));
      });
      return det;
    }

    function tabLessons() {
      const s = Store.get();
      const { unit, steps } = Store.subjectPath(subjectId);

      if (!unit) {
        return h('div.dash', h('div.dash__main',
          C.empty({ title: 'لا دروس بعد', text: 'لسا ما وصل محتوى لهذي المادة.' })));
      }

      const allDown = (unit.lessons || []).every((id) => s.downloaded.includes(id));

      const path = h('div.path',
        h('div.pill-lbl', h('span', unit.title)),
        ...steps.map((st) => st.type === 'lesson'
          ? C.pathNode({
              type: 'lesson', state: st.state, title: SEED.lessons[st.id].title,
              meta: `${SEED.lessons[st.id].video.length} دقيقة`,
              onclick: () => App.go('lesson', { id: st.id, subject: subjectId }),
            })
          : C.pathNode({
              type: 'examCta', state: st.state, title: 'امتحان الوحدة',
              meta: 'اختر نموذجًا من تبويب الامتحانات بعد ما تخلّص دروس الوحدة',
              onclick: () => { tab = 'exams'; drawSeg(); drawBody(); },
            })),
        h('div', { style: 'padding-top:12px' },
          h('button.btn.btn--secondary.btn--sm.btn--block', {
            onclick: () => {
              unit.lessons.forEach((id) => {
                const has = Store.get().downloaded.includes(id);
                if (allDown ? has : !has) Store.toggleDownload(id);
              });
              drawBody();
            },
          }, allDown ? null : icon.down(18),
             allDown ? 'حذف تنزيل الوحدة' : 'تنزيل الوحدة للاستخدام دون إنترنت')));

      const otherUnits = subjectUnits.filter((u) => u.id !== unit.id);
      const otherList = otherUnits.length
        ? h('div', { style: 'margin-top:18px' },
            h('div.sec-label', { style: 'margin:0 4px 8px' }, 'بقيّة وحدات المادة'),
            ...otherUnits.map((u) => unitAccordion(u)))
        : null;

      const savedCount = subjectLessonIds.filter((id) => s.downloaded.includes(id)).length;
      const totalLessons = subjectLessonIds.length;

      return h('div.dash',
        h('div.dash__main', path, otherList),
        h('aside.dash__side',
          h('div.card.card--pad',
            h('div.row', { style: 'margin-bottom:8px' },
              h('span', { style: 'color:var(--info)' }, icon.down(20)),
              h('div', { style: 'font-weight:600' }, 'الاستخدام دون إنترنت')),
            h('div.muted.small',
              savedCount
                ? `${ar(savedCount)} من ${ar(totalLessons)} دروس محفوظة على جهازك.`
                : 'لا دروس محفوظة بعد. نزّل الوحدة الحالية بزرّ واحد.'),
            savedCount > 0 && h('div', { style: 'margin-top:10px' },
              bar((savedCount / totalLessons) * 100, 'bar--thin')))),
      );
    }

    // --- تبويب الامتحانات ------------------------------------------------------
    // قسم مستقل: التجريبية والوزارية منفصلتان، لأن الطالب يقصدهما لغرضين
    // مختلفين — التجريبي للتدريب المتكرّر، والوزاري لقياس الجاهزية الحقيقية.
    function tabExams() {
      const s = Store.get();

      const subjectExams = SEED.exams.filter((e) => e.subject === subjectId);

      // كل امتحان كرت مستقلّ بحدوده — لا صفّ متلاصق بخطّ فاصل — وحالته
      // (لم تُجرَّب/نجحت/أعد المحاولة) أيقونة+كلمة+لون مع بعض لا نسبة
      // مئوية بلونها بس (WCAG: لا تُنقل معلومة بلون وحده).
      const group = (kind, title, note) => {
        const items = subjectExams.filter((e) => e.kind === kind);
        if (!items.length) return null;

        const list = h('div');
        items.forEach((e) => {
          const rec = s.exams[e.id];
          const passed = rec && rec.best >= e.pass;
          const statusCls = !rec ? 'st-new' : passed ? 'st-ok' : 'st-warn';
          const statusTxt = !rec ? 'لم تُجرَّب' : (passed ? '✓ ' : '↻ ') + ar(rec.best) + '٪';

          list.appendChild(h('button.excard', { onclick: () => App.go('exam', { id: e.id, subject: subjectId }) },
            h('div.excard__b',
              h('div.excard__t', e.title),
              h('div.excard__m',
                `${ar(e.questions.length)} أسئلة · ${ar(e.minutes)} دقيقة`
                + (rec ? ` · حاولت ${ar(rec.taken)} مرة` : ''))),
            h('span.excard__status.' + statusCls, statusTxt)));
        });

        return h('div', { style: 'margin-bottom:20px' },
          h('div.section-label', { style: 'padding:0 0 10px' }, title),
          list,
          note && h('div.hint', { style: 'margin-top:4px' }, note));
      };

      // s.exams مسطّح بمعرّفات كل امتحانات التطبيق — نحصره بامتحانات هذه
      // المادة فقط، وإلا اختلطت إحصائيات مادة بأخرى فور وجود أكثر من مادة.
      const subjectExamIds = new Set(subjectExams.map((e) => e.id));
      const taken = Object.entries(s.exams)
        .filter(([id]) => subjectExamIds.has(id)).map(([, v]) => v);
      const best = taken.length ? Math.max(...taken.map((x) => x.best)) : 0;
      const attempts = taken.reduce((a, x) => a + x.taken, 0);
      const ready = best >= 70;

      return h('div.dash',
        h('div.dash__main',
          // امتحانات الوحدات أولًا: هي الوحيدة التي يستطيع طالبٌ في منتصف
          // المنهاج خوضها بإنصاف. الشاملة تليها لمن أنهى المنهاج.
          group('unit', 'امتحانات الوحدات',
            'كل امتحان محصور بوحدة واحدة — قاعدتها ومفرداتها ونصّها. '
            + 'خُضه بعد إنهاء دروس الوحدة مباشرةً، ولكل وحدة نموذجان.'),
          group('mock', 'امتحانات تجريبية',
            'من إعدادنا — تغطي المنهاج بأسئلة متنوّعة، وتصلح للتكرار.'),
          group('ministry', 'دورات وزارية',
            'دورات سابقة كما وردت في الامتحان الرسمي — أفضل قياس لجاهزيتك.')),

        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:600;margin-bottom:12px' }, 'سجلّك في الامتحانات'),
            h('div.stat-row',
              h('div.stat',
                h('div.stat__v', { style: `color:${best >= 50 ? 'var(--ok)' : 'var(--txm)'}` },
                  taken.length ? ar(best) + '٪' : '—'),
                h('div.stat__k', 'أفضل نتيجة')),
              h('div.stat',
                h('div.stat__v', ar(attempts)),
                h('div.stat__k', 'محاولة')),
              h('div.stat',
                h('div.stat__v', `${ar(taken.length)}/${ar(subjectExams.length)}`),
                h('div.stat__k', 'امتحان جرّبته')))),

          taken.length === 0
            ? h('div.callout.callout--info',
                h('div.callout__t', 'ابدأ بامتحان تجريبي'),
                'قبل الدورات الوزارية، جرّب النموذج الأول ليكشف لك مواضع ضعفك '
                + 'فتراجعها موجَّهًا بدل أن تراجع المنهاج كله.')
            : ready
              ? h('div.callout.callout--info',
                  h('div.callout__t', 'جاهزيتك جيدة'),
                  `أفضل نتيجة ${ar(best)}٪. حافظ عليها بمراجعة المواضيع دون ٧٠٪ في `
                  + 'تبويب «تقدّمي».')
              : h('div.callout',
                  h('div.callout__t', 'ما زال أمامك عمل'),
                  `أفضل نتيجة ${ar(best)}٪. راجع أضعف المواضيع ثم أعد الامتحان — `
                  + 'التكرار بعد مراجعة موجَّهة أنفع من التكرار وحده.')),
      );
    }

    // --- تبويب التمارين: أربعة أقسام ثابتة، كل قسم يُفتح على فروعه بحسب الوحدة --
    // القسم والفرع يُحدَّدهما المدرّس يدويًا من لوحة الأدمن (questions.section
    // وquestions.unitCode) — سؤال بلا قسم (لم يُصنَّف بعد) لا يظهر هنا إطلاقًا،
    // وإن وصل عبر المزامنة. التسمية نفس رمز الوحدة (u1..u6) تختلف بحسب القسم:
    // u1 تعني «نحتفل معًا» بالمفردات، وتعني «التعبير عن الهدف» بالقواعد —
    // لأن كل وحدة تُدرّس قاعدة نحوية واحدة بعينها (طابق هذا مع js/store.js
    // بلوحة الأدمن عند أي تعديل مستقبلي، فهما نسختان مستقلّتان عمدًا).
    const SECTIONS = [
      ['vocabulaire', 'المفردات',      'كلمات وتعابير كل وحدة، بترجمتها العربية'],
      ['grammaire',   'القواعد',        'كل قواعد المنهاج مجمَّعة في مكان واحد'],
      ['dialogue',    'ترتيب الحوار',   'إعادة ترتيب حوار أو نصّ مبعثر الجمل'],
      ['unite',       'مواضيع الوحدة', 'فهم النصوص والتعبير الكتابي والملحق الأدبي'],
    ];
    const UNIT_THEME = {
      u1: ['الوحدة الأولى: نحتفل معًا', "on fête ensemble"],
      u2: ['الوحدة الثانية: كلّ شخص من أجل الجميع', 'chacun pour tous'],
      u3: ['الوحدة الثالثة: الصالون مكان ثقافي', "le salon un espace culturel"],
      u4: ['الوحدة الرابعة: المرأة في الأدب', 'la femme dans la littérature'],
      u5: ['الوحدة الخامسة: الذكاء الاصطناعي', "l'intelligence artificielle"],
      u6: ['الوحدة السادسة: غزو الفضاء', 'la conquête de l\'espace'],
    };
    const UNIT_GRAMMAR = {
      u1: ['الوحدة الأولى: التعبير عن الهدف', "l'expression de but"],
      u2: ['الوحدة الثانية: التعارض والتضاد', "les conjonctions d'opposition/concession"],
      u3: ['الوحدة الثالثة: الكلام المباشر وغير المباشر', 'le discours direct et indirect'],
      u4: ['الوحدة الرابعة: المقارنة والتفضيل', 'le superlatif'],
      u5: ['الوحدة الخامسة: الصفات والضمائر المبهمة', "les adjectifs et les pronoms indéfinis"],
      u6: ['الوحدة السادسة: ضمائر الملكية وضمائر الإشارة', 'les pronoms possessifs et les pronoms démonstratifs'],
    };
    /** يُعيد عناصر DOM جاهزة (عربي — فرنسي معزول اتجاهيًا)، لا نصًّا خامًا،
     *  لتُمرَّر مباشرة كأبناء h() — منعًا لانقلاب علامات الترقيم الفرنسية. */
    function unitLabel(section, code) {
      if (code === 'annexe') return ['الملحق الأدبي'];
      const entry = (section === 'grammaire' ? UNIT_GRAMMAR : UNIT_THEME)[code];
      if (!entry) return [code];
      const [arText, frText] = entry;
      return [arText, ' — ', fr(frText)];
    }

    function tabPractice() {
      const card = h('div.card', { style: 'overflow:hidden' });

      SECTIONS.forEach(([id, label, desc], i) => {
        const qs = Object.values(SEED.questions)
          .filter((q) => q.subject === subjectId && q.section === id);
        if (!qs.length) {
          card.appendChild(h('div.rowlink', { style: 'opacity:.45' },
            h('div.rowlink__b', h('div', { style: 'font-weight:600' }, label),
              h('div.rowlink__s', 'لا تمارين بعد'))));
          return;
        }

        // فروع القسم: كل وحدة فيها سؤال واحد على الأقل، مرتّبة، زائد فرع
        // «أسئلة عامة» لِما لم يُنسَب بعد لوحدة بذاتها ضمن هذا القسم.
        const byUnit = new Map();
        qs.forEach((q) => {
          const k = q.unitCode || '__general';
          byUnit.set(k, (byUnit.get(k) || 0) + 1);
        });
        const order = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'annexe', '__general'];
        const branches = order.filter((k) => byUnit.has(k));

        const det = h('details.unit', i === 0 ? { open: true } : {});
        det.appendChild(h('summary.unit__head',
          h('div.grow',
            h('div.unit__title', label),
            h('div.faint', { style: 'font-size:12px;margin-top:4px' },
              `${ar(qs.length)} تمارين — ${desc}`)),
          h('span.unit__chev', icon.chevron(20))));

        det.appendChild(h('div.lesson', {
          onclick: () => App.go('practice', { section: id, subject: subjectId }),
        },
          h('div.lesson__ico.lesson__ico--now', icon.book(16)),
          h('div.lesson__body', h('div', { style: 'font-weight:600' }, `كل قسم «${label}»`),
            h('div.lesson__meta', `${ar(qs.length)} سؤالًا من كل الفروع`))));

        branches.forEach((k) => {
          const n = byUnit.get(k);
          const titleParts = k === '__general' ? ['أسئلة عامة'] : unitLabel(id, k);
          det.appendChild(h('div.lesson', {
            onclick: () => App.go('practice',
              { section: id, unit: k === '__general' ? '' : k, subject: subjectId }),
          },
            h('div.lesson__ico.lesson__ico--todo', k === '__general' ? '•' : k.replace('u', '')),
            h('div.lesson__body', h('div', ...titleParts), h('div.lesson__meta', `${ar(n)} تمارين`))));
        });

        card.appendChild(det);
      });

      return h('div.dash',
        h('div.dash__main',
          h('div.muted.small', { style: 'margin-bottom:12px' },
            'اضغط قسمًا لتشوف فروعه بحسب الوحدة، أو ابدأ جلسة شاملة من بنك الأسئلة.'),
          card),
        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:600;margin-bottom:6px' }, 'جلسة شاملة'),
            h('div.muted.small', { style: 'margin-bottom:14px' },
              `كل الأسئلة المصنَّفة — ${ar(Object.values(SEED.questions).filter((q) => q.subject === subjectId && q.section).length)} سؤالًا من الأقسام الأربعة.`),
            h('button.btn.btn--primary.btn--block', {
              onclick: () => App.go('practice', { section: 'any', subject: subjectId }),
            }, 'ابدأ الجلسة'))),
      );
    }


    /* --- تبويب الملفّات: نوطة المادة وملحقاتها ---------------------------------
       نفس مكوّن `Doc.fileList` الذي يعرض ملفّات الدرس حرفيًّا — لا نسخة ثانية:
       أوّل تعديل على أحدهما (الطيّ، ملء الشاشة، التكبير) كان سينسى الأخرى.

       ويحتاج اتصالًا صراحةً: الملفّ خلف رابطٍ موقّع يُطلب عند الفتح، فبلا
       إنترنت تبقى البطاقات تدور بلا نهاية ويظنّ الطالب أن الملفّ معطوب. */
    function tabFiles() {
      const s = Store.get();
      return h('div.dash', h('div.dash__main',
        !s.online
          ? h('div.card.card--pad.doc__off',
              icon.wifiOff(20),
              h('div', h('b', 'ملفّات المادة تحتاج اتصالًا'),
                h('span', 'افتح القسم وأنت متصل لتُحمَّل ملفّاته.')))
          : h('div',
              h('div.sec-label', { style: 'margin:0 4px 8px' },
                `ملفّات المادة (${ar(subjectDocs.length)})`),
              Doc.fileList(subjectDocs))));
    }

    // صفّ هذه المادة من وحداتها هي، لا صفّ الطالب العام: كان الأخير قيمة
    // مثبَّتة ('g9') فكانت شاشة كورس البكالوريا تحمل عنوان «الصف التاسع».
    const unitGrades = [...new Set(subjectUnits.map((u) => u.grade).filter(Boolean))];
    const gradeName = unitGrades.length === 1
      ? (SEED.grades.find((g) => g.id === unitGrades[0])?.name || '')
      : '';

    /* غلاف صورة الأستاذ كاملةً (لا تدرّج مسطّح) + ورقة بيضاء تعلوه — شكلٌ
       مستوحًى من مرجع تصميم خارجي طلبه صاحب المنتج صراحةً (راجع
       design-library بجذر المشروع).

       بلا صورة أستاذ (أو بلا أستاذ مطابق أصلًا): يبقى الغلاف تدرّجًا
       ملوّنًا بأيقونة المادة كبيرة في وسطه — لا غلاف فارغ يبدو عطلًا. */
    function courseHero() {
      const teacher = (SEED.teachers || []).find((t) => (t.subjects || []).includes(subjectId));
      const photo = teacher && Api.publicUrl(teacher.photo);
      const unitCount = subjectUnits.length;
      const pillParts = [gradeName, unitCount ? `${ar(unitCount)} ${unitCount === 1 ? 'وحدة' : 'وحدات'}` : null]
        .filter(Boolean).join(' · ');

      return h('div.chero',
        h('div.chero__band',
          h('button.chero__back', { onclick: () => App.back(), 'aria-label': 'رجوع' }, icon.back(20)),
          photo
            ? h('img.chero__photo', { src: photo, alt: '', loading: 'lazy', style: UI.focusStyle(teacher.photoPos) })
            : h('span.chero__badge', subjectIconEl(subjectId, 34))),
        /* الترتيب نصٌّ صريح من صاحب المنتج مقابل لقطة مرجعية:
           الاسم · عدد الوحدات · «الوصف» عريضًا ثم نصّه نحيفًا · «الأستاذ»
           عريضًا ثم اسمه · والتبويبات **أخيرًا** (خارج الورقة، أدناه).
           بُني مرّةً بالتبويبات فوق الوصف فرُدَّ — لا تُعِد ترتيبها. */
        h('div.chero__sheet',
          h('div.chero__title', subject?.name || 'مادتي'),
          pillParts ? h('span.chero__pill', pillParts) : null,
          ...descBlock(),
          /* الأستاذ نصٌّ عاديّ تحت عنوانه لا بطاقة: البطاقة الرماديّة كانت
             تجعله يبدو عنصرًا قابلًا للنقر وهو ليس كذلك. وبلا صورةٍ مصغّرة
             قبل الاسم — الغلاف فوقه يعرض **نفس** الصورة بعرض الشاشة، فدائرةُ
             ٣٨ بكسل تكرارٌ لا يضيف معلومة (طلبان صريحان). */
          ...(teacher
            ? [h('div.chero__lbl', 'الأستاذ'), h('div.chero__teacher', teacher.name)]
            : [])));
    }

    /* وصف المادة — سطران ثم «المزيد».
       الورقة (`chero__sheet`) ثابتة فوق المحتوى المتمرّر، فكل سطرٍ فيها يُقتطع
       من ارتفاع الدروس في **كل** تبويب. القصّ عند سطرين يبقيها تعريفًا لا
       مقالًا، والتوسيع باختيار الطالب لا مفروضًا عليه. */
    function descBlock() {
      const text = (subject?.desc || '').trim();
      if (!text) return [];      // بلا وصف يغيب العنوان معه — فراغٌ محجوز يبدو عطلًا

      const p = h('p.chero__desc', text);
      const box = h('div.chero__descw', p);
      const more = h('button.chero__more', {
        onclick: () => {
          const open = p.classList.toggle('is-open');
          more.textContent = open ? 'أقلّ' : 'المزيد';
        },
      }, 'المزيد');

      /* الزرّ يُضاف بعد القياس لا قبله: «المزيد» الذي يفتح سطرين على سطرين
         كذبةٌ صغيرة تُفقد الطالب الثقة بالزرّ. والقياس بعد الإدراج في DOM —
         قبله `scrollHeight` صفر — فيُؤجَّل إلى الإطار التالي. */
      const measure = () => {
        if (p.scrollHeight - p.clientHeight > 2 && !more.isConnected) box.appendChild(more);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measure);
      else measure();

      return [h('div.chero__lbl', 'الوصف'), box];
    }

    drawSeg();
    drawBody();
    // الساتر أوّلًا: هامشه السالب يلغي مساحته، فوجوده هنا لا يزيح الغلاف
    body.append(scrim, courseHero(), sentinel, tabs, pane);
    wrap.append(body);

    /* --- إظهار اسم المادة حين تُغطّى الصورة -------------------------------------
       مراقب تقاطعٍ لا حدث تمرير: المراقب يُبلّغ الحالة الصحيحة بعد أي اندفاع
       مهما كانت سرعته، بينما حدث التمرير قد يفوته الإطار الأخير فيبقى الشريط
       على حالةٍ خاطئة حتى التمريرة التالية.

       ولا حدود يدوية ولا فجوة ضدّ الرفرفة: الحارس النقطي في نهاية الورقة،
       فخروجه من الأعلى هو **بعينه** لحظة التصاق شريط التبويبات. */
    if (typeof IntersectionObserver === 'function') {
      /* الحاشية تُقرأ من ارتفاع الساتر لا تُكتب رقمًا: تختلف من جهازٍ لآخر
         (وتساوي صفرًا على الحاسوب). وبدونها يتأخّر اسم المادة بمقدارها، لأن
         شريط التبويبات صار يلتصق أبكر بها. */
      const inset = (typeof getComputedStyle === 'function'
        && parseFloat(getComputedStyle(scrim).height)) || 0;
      new IntersectionObserver(([e]) => {
        const on = !e.isIntersecting;
        nameBar.classList.toggle('is-on', on);
        scrim.classList.toggle('is-on', on);
      }, { root: body, rootMargin: `-${inset}px 0px 0px 0px`, threshold: 0 }).observe(sentinel);
    }

    return wrap;
  };

  // ===========================================================================
  // ٧. شاشة الدرس
  // ===========================================================================
  Screens.lesson = (params) => {
    const l = SEED.lessons[params.id];
    if (!l) return Screens.subjects();
    Store.startLesson(l.id);

    // يُمرَّر لكل تنقّل صادر من هنا (درس شقيق، بدء تمارين) ليبقى الرجوع
    // لشاشة المادة صحيحًا بدل الرئيسية.
    const subjectId = params.subject;
    const s = Store.get();
    const saved = s.downloaded.includes(l.id);
    const unit = SEED.units.find((u) => u.lessons.includes(l.id));

    /* الملصق ثم المشغّل.
       كان الزرّ زخرفةً بلا معالج نقر: `Media.player` مكتوبة بالكامل (توقيع
       الرابط والعلامة المائية وحماية الشاشة) ولم يستدعِها أحد في التطبيق
       إطلاقًا. فكان الطالب يضغط «تشغيل» ولا يقع شيء ولا تظهر رسالة.

       ونستبدل الملصق بالمشغّل عند النقر لا نعرضهما معًا: تحميل الفيديو يبدأ
       عند الطلب لا مع فتح الدرس — الفيديو أثقل ما في التطبيق، وأكثر من يفتح
       درسًا يقرأ نصّه ولا يشاهد. */
    // حاوية محايدة: `Media.player` تُرجع `div.video` بنفسها، ووضعُها داخل
    // `div.video` أخرى يضاعف صندوق النسبة ١٦:٩ فيخرج المشغّل عن مقاسه.
    const video = h('div');

    /* سطح الملصق — ثلاث حالات لا حالتان:
         null  = ما زال يُجلب   ⇒ خلفية داكنة وحدها
         false = تعذّر          ⇒ الرسم النائب
         عنصر  = إطار حقيقي     ⇒ يظهر بتلاشٍ

       الرسم النائب **لا يُعرض أثناء الجلب**: عرضُه ثم استبداله بعد لحظة
       وميضٌ يلفت النظر إلى التبديل نفسه — وهذا ما اشتكى منه الاستعمال.
       الخلفية الداكنة وحدها لا تُقرأ انتظارًا ولا خطأً، والزرّ فوقها ظاهر
       من اللحظة الأولى فلا يبدو الدرس معطَّلًا. */
    let surface = (l.video.id && s.online) ? null : false;
    if (surface === null) {
      Media.posterFor(l.video.id).then((el) => {
        surface = el || false;
        // لا نلمس شيئًا إن كان الطالب قد بدأ المشاهدة بالفعل
        if (!video.querySelector('.vc')) poster();
      }).catch(() => { surface = false; if (!video.querySelector('.vc')) poster(); });
    }

    const poster = (...extra) => video.replaceChildren(
      h('div.video', ...[
        // null أثناء الجلب ⇒ لا شيء (الخلفية الداكنة)، false ⇒ الرسم النائب
        surface === null ? null
          : surface || h('img', { src: l.video.thumb, alt: '' }),
        l.video.id && h('button.video__play',
          { 'aria-label': 'تشغيل الفيديو', onclick: playNow }, h('span', icon.play(26))),
        h('div.video__len.mono', l.video.length),
        // الفيديو أثقل من أن يُنزَّل ضمنيًا: إن لم يكن محفوظًا ولا يوجد اتصال،
        // نقول ذلك صراحةً بدل إظهار مشغّل معطّل بلا سبب.
        (!saved && !s.online) && h('div.video__offline', 'يحتاج اتصالًا'),
        // درسٌ بلا فيديو مربوط: نقولها بدل زرّ لا يفعل شيئًا
        !l.video.id && h('div.video__offline', 'لا فيديو لهذا الدرس بعد'),
        ...extra,
      ].filter(Boolean)));

    async function playNow() {
      video.replaceChildren(h('div.video', h('div.video__offline', 'جارٍ التجهيز…')));
      try {
        const box = await Media.player(l.video.id);
        video.replaceChildren(box);
        // التشغيل التلقائي بعد نقرة المستخدم مسموح — النقرة هي الإذن
        box.querySelector('video')?.play?.().catch(() => {});
      } catch (e) {
        /* الرسالة من الخادم أدقّ ممّا نخمّنه: «هذا الجهاز غير مرتبط بحسابك»
           أو «لا تملك صلاحية» أو انقطاع شبكة — وكلٌّ يحتاج فعلًا مختلفًا من
           الطالب. عرضُ «تعذّر التشغيل» وحده يخفي ما يفيده. */
        poster(h('div.video__offline', e.message || 'تعذّر تشغيل الفيديو'));
        window.Report?.capture('تشغيل الفيديو', e);
      }
    }

    poster();

    // العمود الجانبي على اللابتوب: بقية دروس الوحدة تبقى مرئية أثناء القراءة
    const siblings = h('div.card', { style: 'overflow:hidden' });
    siblings.appendChild(h('div', { style: 'padding:14px 16px 10px;font-weight:600' }, unit.title));
    unit.lessons.forEach((id, n) => {
      const o = SEED.lessons[id];
      const st = s.lessons[id];
      siblings.appendChild(h('div.lesson', {
        style: id === l.id ? 'background:var(--acc-soft)' : '',
        onclick: () => id !== l.id && App.go('lesson', { id, subject: subjectId }, true),
      },
        h('div.lesson__ico.'
          + (st === 'done' ? 'lesson__ico--done' : id === l.id ? 'lesson__ico--now' : 'lesson__ico--todo'),
          st === 'done' ? '✓' : id === l.id ? '▸' : ar(n + 1)),
        h('div.lesson__body',
          h('div', { style: id === l.id ? 'font-weight:600' : '' }, o.title),
          h('div.lesson__meta', `فيديو ${o.video.length}`))));
    });

    const body = h('div.screen__body',
      h('div.dash',
        h('div.dash__main',
          video,
          h('div.row',
            h('div.grow.small.muted', `فيديو ${l.video.length} · قراءة ${ar(l.minutes)} دقيقة`),
            /* تبديل الحفظ يحدّث الزرّ في مكانه لا يعيد بناء الشاشة.
               إعادةُ البناء كانت تُتلف مشاهدةً جارية: الفيديو يُهدم ويُبنى
               من الصفر فيعود إلى أوّله — والطالب لم يطلب إلّا حفظ الدرس. */
            (() => {
              const label = (on) => (on ? ['محفوظ ✓'] : [icon.down(16), 'تنزيل']);
              const btn = h('button.btn.btn--secondary.btn--sm', {}, ...label(saved));
              btn.addEventListener('click', () => {
                Store.toggleDownload(l.id);
                btn.replaceChildren(...label(Store.get().downloaded.includes(l.id)));
              });
              return btn;
            })(),
            /* جلسة التركيز تبدأ من هنا لا من الشريط السفلي: تبويبٌ مستقلّ
               يُفتح مرّةً للفضول ثم يُنسى، أمّا زرٌّ في الدرس فيقع في لحظة
               الحاجة إليه — وهي لحظة فتح الدرس بالضبط. */
            h('button.btn.btn--secondary.btn--sm', {
              onclick: () => App.go('focus', { lesson: l.id, subject: subjectId }),
            }, icon.clock(16), 'تركيز')),

          /* الشرح: نصّ المحرِّر أو ملفّ PDF — **باختيار المحرِّر** لا باستنتاج
             من وجود الملفّ. كلاهما محفوظ دائمًا، والتبديل بينهما لا يُتلف شيئًا.

             و`l.doc` شرطٌ ثانٍ لا زائد: وضعُ `pdf` بلا ملفٍّ مربوط (سهوٌ في
             اللوحة، أو ملفٌّ حُذف) يجب أن يُظهر النصّ لا شاشةً فارغة — الطالب
             لا يدفع ثمن خطأ إدخال. */
          /* ثلاثة أوضاع، والقرار للمحرِّر لا للاستنتاج:
               text → النصّ وحده
               pdf  → الملفّات وحدها
               both → النصّ مفتوحًا **ثم** الملفّات تحته

             والملفّات شرطُها وجودها فعلًا: وضعٌ يطلبها بلا ملفّ (سهوٌ في
             اللوحة أو ملفٌّ حُذف) يسقط إلى النصّ — الطالب لا يدفع ثمن خطأ
             إدخال بشاشةٍ فارغة. */
          (() => {
            const files = l.docs || [];
            const showFiles = (l.mode === 'pdf' || l.mode === 'both') && files.length;
            const showText = !showFiles || l.mode === 'both';

            const filesBlock = !showFiles ? null
              : !s.online
                ? h('div.card.card--pad.doc__off',
                    icon.wifiOff(20),
                    h('div', h('b', 'ملفّات الدرس تحتاج اتصالًا'),
                      h('span', 'افتح الدرس وأنت متصل لتُحمَّل ملفّاته.')))
                : h('div',
                    h('div.sec-label', { style: 'margin:16px 0 8px' },
                      `ملفّات الدرس (${ar(files.length)})`),
                    Doc.fileList(files));

            return h('div',
              showText ? h('div.card', UI.prose(l.body)) : null,
              filesBlock);
          })()),

        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:600;margin-bottom:6px' }, 'تمارين هذا الدرس'),
            h('div.muted.small', { style: 'margin-bottom:14px' },
              `${ar(l.exercises.length)} تمارين تُحدّث إتقانك فورًا.`),
            h('button.btn.btn--primary.btn--block', {
              onclick: () => App.go('practice', { lesson: l.id, subject: subjectId }),
            }, 'ابدأ التمارين'),
            h('button.btn.btn--ghost.btn--block', {
              style: 'margin-top:6px',
              onclick: () => { Store.completeLesson(l.id); App.back(); },
            }, 'أنهيت الدرس')),
          siblings),
      ),
    );

    const banner = C.syncBanner();
    if (banner) body.prepend(h('div', { style: 'padding:14px 16px 0' }, banner));

    return h('div.screen', C.appbar({ title: l.title, onBack: () => App.back() }), body);
  };

  // ===========================================================================
  // ٨. جلسة التمارين
  // ===========================================================================
  Screens.practice = (params) => {
    let pool;
    if (params.lesson) {
      // مُشتقّة من درس بعينه — سؤاله يحمل مادته أصلًا عبر ذلك الدرس، فلا
      // حاجة لتصفية إضافية بالمادة هنا.
      pool = SEED.lessons[params.lesson].exercises.map((id) => SEED.questions[id]);
    } else {
      // كل بقية الأنماط تصفّح بنك الأسئلة مباشرة — لازم حصرها بالمادة، وإلا
      // اختلطت أسئلة مادتين مختلفتين بمجرّد ما يصير عنا أكتر من مادة.
      const bySubject = Object.values(SEED.questions).filter((q) => q.subject === params.subject);
      // 'any' = جلسة شاملة على الأقسام الأربعة المصنَّفة، لا كل بنك الأسئلة —
      // الأسئلة غير المصنَّفة (section فارغ) لم يراجعها المدرّس بعد فتُستبعد.
      if (params.section === 'any') pool = bySubject.filter((q) => q.section);
      // فرع بعينه (وحدة) داخل قسم — من ضغط بند فرعي بالسلايد. params.unit فارغة
      // (لا محذوفة) تعني «فرع الأسئلة العامة»، أي بلا unitCode إطلاقًا.
      else if (params.section && params.unit !== undefined)
        pool = bySubject.filter((q) =>
          q.section === params.section && (params.unit ? q.unitCode === params.unit : !q.unitCode));
      else if (params.section) pool = bySubject.filter((q) => q.section === params.section);
      else                     pool = bySubject;
    }
    pool = pool.filter(Boolean);

    let i = 0;
    /* حالة كل سؤال بمؤشّره: { sel, checked } وما إن كان صوابًا. غيابها = متخطّى.
       نحفظها لأن الرجوع صار ممكنًا، ولو أعدنا بناء البطاقة فارغة لأجاب الطالب
       مرّتين فسُجِّلت محاولتان لسؤال واحد. */
    let state = {};
    const answered = () => Object.values(state).filter((x) => x.checked);
    const skipped = () => pool.map((_, n) => n).filter((n) => !state[n]?.checked);

    const wrap = h('div.screen');
    const body = h('div.screen__body', { style: 'padding:16px' });

    function step() {
      if (i >= pool.length) return finish();
      if (i < 0) i = 0;
      body.replaceChildren(C.questionCard(pool[i], {
        index: i, total: pool.length,
        initial: state[i],
        onState: (st) => { state[i] = { ...state[i], ...st }; },
        onNext: (ok) => { state[i] = { ...state[i], checked: true, correct: ok }; go(after(i + 1)); },
        onSkip: () => go(after(i + 1)),
        onPrev: i > 0 ? () => go(i - 1) : null,
      }));
    }

    const go = (n) => { i = n; step(); body.scrollTop = 0; };

    /* في الجولة الأولى نمضي بالترتيب. أما بعد «حلّ الأسئلة المتخطّاة» فالمضيّ
       يقفز إلى المتخطّى التالي وحده — وإلّا مرّ الطالب ثانيةً على كل سؤال
       أجابه ليصل إلى الذي تركه. */
    let revisiting = false;
    const after = (from) => {
      if (!revisiting) return from;
      const n = skipped().find((k) => k >= from);
      return n === undefined ? pool.length : n;
    };

    function finish() {
      // النسبة تُحسب على ما أجابه الطالب لا على حجم الجلسة: احتساب المتخطّى
      // خطأً يجعل «تخطّيت سؤالًا» و«أخطأت فيه» شيئًا واحدًا، فيتحوّل زرّ التخطّي
      // إلى عقوبة صامتة ويكفّ عن كونه ميزة.
      const done = answered();
      const correct = done.filter((x) => x.correct).length;
      const left = skipped();
      const pct = done.length ? Math.round((correct / done.length) * 100) : 0;
      /* الدرس يكتمل بحلّ تمارينه لا ببلوغ آخرها. قبل التخطّي كان الوصول إلى
         هنا يعني أن الطالب أجاب كل سؤال، فكان الاكتمال صحيحًا ضمنًا؛ ومع
         التخطّي صار ممكنًا بلوغ النهاية بلا إجابة واحدة. بلا هذا الشرط يتحوّل
         «تخطّي» إلى طريق مختصر لإكمال المنهاج كلّه بلا حلّ شيء. */
      if (params.lesson && !left.length) Store.completeLesson(params.lesson);
      body.replaceChildren(h('div.card.card--pad',
        done.length
          ? h('div.score',
              h('div.score__n', { style: `color:${pct >= 50 ? 'var(--ok)' : 'var(--err)'}` }, ar(pct) + '٪'),
              h('div.score__l', `${ar(correct)} صحيحة من ${ar(done.length)} أجبتها`))
          : h('div.score', h('div.score__l', 'تخطّيت كل الأسئلة — لم تُحسب نتيجة')),
        left.length
          ? h('div.muted.small.center', { style: 'margin-top:12px' },
              `${ar(left.length)} ${left.length === 1 ? 'سؤال متخطًّى' : 'أسئلة متخطّاة'} لم تُحسب عليك`
              + (params.lesson ? ' — يكتمل الدرس بحلّها' : ''))
          : h('div.muted.small.center', { style: 'margin-top:14px' },
              'سُجِّلت نتيجتك، وسيظهر أثرها في مؤشر التقدّم فورًا.'),
        left.length
          ? h('button.btn.btn--primary.btn--block', {
              style: 'margin-top:18px',
              onclick: () => { revisiting = true; go(left[0]); },
            }, 'حلّ الأسئلة المتخطّاة')
          : h('button.btn.btn--primary.btn--block', {
              style: 'margin-top:18px',
              // شاشة التقدّم المستقلّة بعد إزالة تبويب «تقدّمي» من داخل المادة
              onclick: () => App.go('progress'),
            }, 'شوف تقدّمك'),
        left.length
          ? h('button.btn.btn--ghost.btn--block',
              { style: 'margin-top:6px', onclick: () => App.go('progress') }, 'شوف تقدّمك')
          : null,
        h('button.btn.btn--ghost.btn--block', {
          style: 'margin-top:6px',
          onclick: () => { i = 0; state = {}; revisiting = false; step(); },
        }, 'أعد الجلسة')));
    }

    step();
    wrap.append(C.appbar({ title: 'تمارين', onBack: () => App.back() }), body);
    return wrap;
  };
})();
