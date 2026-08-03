/* =============================================================================
   الكورس (٣ تبويبات) · الدرس · جلسة التمارين
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, ring, bar } = UI;

  // ===========================================================================
  // ٦. شاشة الكورس — الدروس · تمارين · تقدّمي
  // ===========================================================================
  Screens.course = (params) => {
    const wrap = h('div.screen');
    let tab = params.tab || 'lessons';

    const seg = h('div.seg');
    const body = h('div.screen__body');

    const TABS = [
      ['lessons',  'الدروس'],
      ['practice', 'تمارين'],
      ['exams',    'امتحانات'],
      ['progress', 'تقدّمي'],
    ];

    function drawSeg() {
      seg.replaceChildren(...TABS.map(([id, label]) =>
        h('button', {
          'aria-selected': tab === id ? 'true' : 'false',
          onclick: () => { tab = id; drawSeg(); drawBody(); App.drawRail(); },
        }, label)));
    }

    function drawBody() {
      const banner = C.syncBanner();
      body.replaceChildren(
        banner ? h('div', { style: 'padding:14px 16px 0' }, banner) : h('span'),
        tab === 'lessons'    ? tabLessons()
        : tab === 'practice' ? tabPractice()
        : tab === 'exams'    ? tabExams()
        : tabProgress(),
      );
      body.scrollTop = 0;
    }

    // --- تبويب الدروس ---------------------------------------------------------
    function tabLessons() {
      const s = Store.get();

      const list = h('div.card', { style: 'overflow:hidden' });
      SEED.units.forEach((u, i) => {
        const up = Store.unitProgress(u);
        const allDown = u.lessons.every((id) => s.downloaded.includes(id));

        const det = h('details.unit', i === 0 || up.done < up.total ? { open: true } : {});
        det.appendChild(h('summary.unit__head',
          h('div.grow',
            h('div.unit__title', u.title),
            h('div.row', { style: 'margin-top:8px' },
              bar(up.pct),
              h('span.faint', { style: 'font-size:12px' }, `${ar(up.done)}/${ar(up.total)}`))),
          h('span.unit__chev', icon.chevron(20))));

        u.lessons.forEach((id, n) => {
          const l = SEED.lessons[id];
          const st = s.lessons[id];
          det.appendChild(h('div.lesson', { onclick: () => App.go('lesson', { id }) },
            h('div.lesson__ico.'
              + (st === 'done' ? 'lesson__ico--done' : st ? 'lesson__ico--now' : 'lesson__ico--todo'),
              st === 'done' ? '✓' : st ? '▸' : ar(n + 1)),
            h('div.lesson__body',
              h('div', l.title),
              h('div.lesson__meta',
                `فيديو ${l.video.length} · قراءة ${ar(l.minutes)} دقيقة · ${ar(l.exercises.length)} تمارين`)),
            l.free && h('span.badge.badge--free', 'مجاني'),
            s.downloaded.includes(id) && h('span.badge.badge--saved', 'محفوظ')));
        });

        // زر تنزيل على مستوى الوحدة — الفجوة التي كانت غائبة في الموكأپ
        det.appendChild(h('div', { style: 'padding:10px 16px 14px;border-top:1px solid var(--brd)' },
          h('button.btn.btn--secondary.btn--sm.btn--block', {
            onclick: (e) => {
              e.stopPropagation();
              u.lessons.forEach((id) => {
                const has = Store.get().downloaded.includes(id);
                if (allDown ? has : !has) Store.toggleDownload(id);
              });
              drawBody();
            },
          }, allDown ? null : icon.down(18),
             allDown ? 'حذف تنزيل الوحدة' : 'تنزيل الوحدة للاستخدام دون إنترنت')));

        list.appendChild(det);
      });

      const nextId = Object.keys(SEED.lessons).find((id) => s.lessons[id] !== 'done');
      const next = nextId && SEED.lessons[nextId];
      const savedCount = s.downloaded.length;
      const totalLessons = Object.keys(SEED.lessons).length;

      return h('div.dash',
        h('div.dash__main', list),
        h('aside.dash__side',
          next
            ? h('div.card.card--pad',
                h('div.muted.small', { style: 'margin-bottom:4px' }, 'الدرس التالي'),
                h('div', { style: 'font-weight:700;font-size:17px;margin-bottom:2px' }, next.title),
                h('div.faint.small', { style: 'margin-bottom:14px' },
                  `فيديو ${next.video.length} · ${ar(next.exercises.length)} تمارين`),
                h('button.btn.btn--primary.btn--block', {
                  onclick: () => App.go('lesson', { id: nextId }),
                }, 'ابدأ الدرس'))
            : h('div.card.card--pad',
                h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'أنهيت كل الدروس'),
                h('div.muted.small', { style: 'margin-bottom:12px' },
                  'جرّب امتحانًا تجريبيًا لتقيس ما ثبت فعلًا.'),
                h('button.btn.btn--primary.btn--block', {
                  onclick: () => { tab = 'exams'; drawSeg(); drawBody(); },
                }, 'إلى الامتحانات')),

          h('div.card.card--pad',
            h('div.row', { style: 'margin-bottom:8px' },
              h('span', { style: 'color:var(--info)' }, icon.down(20)),
              h('div', { style: 'font-weight:700' }, 'الاستخدام دون إنترنت')),
            h('div.muted.small',
              savedCount
                ? `${ar(savedCount)} من ${ar(totalLessons)} دروس محفوظة على جهازك.`
                : 'لا دروس محفوظة بعد. نزّل وحدة كاملة بزر واحد أسفل كل وحدة.'),
            savedCount > 0 && h('div', { style: 'margin-top:10px' },
              bar((savedCount / totalLessons) * 100, 'bar--thin')))),
      );
    }

    // --- تبويب الامتحانات ------------------------------------------------------
    // قسم مستقل: التجريبية والوزارية منفصلتان، لأن الطالب يقصدهما لغرضين
    // مختلفين — التجريبي للتدريب المتكرّر، والوزاري لقياس الجاهزية الحقيقية.
    function tabExams() {
      const s = Store.get();

      const group = (kind, title, note) => {
        const items = SEED.exams.filter((e) => e.kind === kind);
        if (!items.length) return null;

        const card = h('div.card.list-sep', { style: 'overflow:hidden' });
        items.forEach((e) => {
          const rec = s.exams[e.id];
          const passed = rec && rec.best >= e.pass;
          card.appendChild(h('button.rowlink', { onclick: () => App.go('exam', { id: e.id }) },
            h('div.rowlink__b',
              h('div', { style: 'font-weight:600' }, e.title),
              h('div.rowlink__s',
                `${ar(e.questions.length)} أسئلة · ${ar(e.minutes)} دقيقة`
                + (rec ? ` · حاولت ${ar(rec.taken)} مرة` : ' · لم تجرّبه بعد'))),
            rec && h('span.badge.' + (passed ? 'badge--ok' : 'badge--acc'), ar(rec.best) + '٪'),
            h('span.faint', icon.back(18))));
        });

        return h('div',
          h('div.section-label', { style: 'padding:0 0 8px' }, title),
          card,
          note && h('div.hint', { style: 'margin-top:8px' }, note));
      };

      const taken = Object.values(s.exams);
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
            h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'سجلّك في الامتحانات'),
            h('div.stat-row',
              h('div.stat',
                h('div.stat__v', { style: `color:${best >= 50 ? 'var(--ok)' : 'var(--txm)'}` },
                  taken.length ? ar(best) + '٪' : '—'),
                h('div.stat__k', 'أفضل نتيجة')),
              h('div.stat',
                h('div.stat__v', ar(attempts)),
                h('div.stat__k', 'محاولة')),
              h('div.stat',
                h('div.stat__v', `${ar(taken.length)}/${ar(SEED.exams.length)}`),
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
        const qs = Object.values(SEED.questions).filter((q) => q.section === id);
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
          onclick: () => App.go('practice', { section: id }),
        },
          h('div.lesson__ico.lesson__ico--now', icon.book(16)),
          h('div.lesson__body', h('div', { style: 'font-weight:600' }, `كل قسم «${label}»`),
            h('div.lesson__meta', `${ar(qs.length)} سؤالًا من كل الفروع`))));

        branches.forEach((k) => {
          const n = byUnit.get(k);
          const titleParts = k === '__general' ? ['أسئلة عامة'] : unitLabel(id, k);
          det.appendChild(h('div.lesson', {
            onclick: () => App.go('practice', { section: id, unit: k === '__general' ? '' : k }),
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
            h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'جلسة شاملة'),
            h('div.muted.small', { style: 'margin-bottom:14px' },
              `كل الأسئلة المصنَّفة — ${ar(Object.values(SEED.questions).filter((q) => q.section).length)} سؤالًا من الأقسام الأربعة.`),
            h('button.btn.btn--primary.btn--block', { onclick: () => App.go('practice', { section: 'any' }) },
              'ابدأ الجلسة'))),
      );
    }

    // --- تبويب التقدّم ----------------------------------------------------------
    function tabProgress() {
      const p = Store.subjectProgress();

      return h('div.dash',
        h('div.dash__main',
          h('div.card.card--pad',
            h('div', { style: 'display:grid;place-items:center' }, ring(p.percent, 132, 11)),
            h('div.center.muted.small', { style: 'margin-top:10px' }, 'تقدّمك في اللغة الفرنسية'),

            // تفصيل المعادلة — المؤشر الذي لا يُفهم كيف يرتفع يفقد قدرته على التحفيز
            h('div', { style: 'margin-top:18px;border-top:1px solid var(--brd);padding-top:16px' },
              ...[
                ['الدروس المكتملة', p.lessonPct, '٧٥٪ من المؤشر'],
                ['أفضل امتحان',     p.bestExam,  '٢٥٪ من المؤشر'],
              ].map(([label, val, w]) => h('div', { style: 'margin-bottom:13px' },
                h('div.row', { style: 'margin-bottom:5px' },
                  h('div.grow.small', label),
                  h('span.faint', { style: 'font-size:11px' }, w),
                  h('span.mono.small', ar(val) + '٪')),
                bar(val, 'bar--thin')))))),

        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'إحصائياتك'),
            h('div.stat-row',
              h('div.stat',
                h('div.stat__v', ar(p.lessonsDone)),
                h('div.stat__k', 'درس مكتمل')),
              h('div.stat',
                h('div.stat__v', { style: 'color:var(--ok)' }, ar(p.bestExam) + '٪'),
                h('div.stat__k', 'أفضل امتحان'))))),
      );
    }

    drawSeg();
    drawBody();
    wrap.append(
      C.appbar({ title: 'اللغة الفرنسية', sub: 'الصف التاسع', onBack: () => App.back() }),
      seg, body);
    return wrap;
  };

  // ===========================================================================
  // ٧. شاشة الدرس
  // ===========================================================================
  Screens.lesson = (params) => {
    const l = SEED.lessons[params.id];
    if (!l) return Screens.home();
    Store.startLesson(l.id);

    const s = Store.get();
    const saved = s.downloaded.includes(l.id);
    const unit = SEED.units.find((u) => u.lessons.includes(l.id));

    const video = h('div.video',
      h('img', { src: l.video.thumb, alt: '' }),
      h('button.video__play', { 'aria-label': 'تشغيل الفيديو' }, h('span', icon.play(26))),
      h('div.video__len.mono', l.video.length),
      // الفيديو أثقل من أن يُنزَّل ضمنيًا: إن لم يكن محفوظًا ولا يوجد اتصال،
      // نقول ذلك صراحةً بدل إظهار مشغّل معطّل بلا سبب.
      (!saved && !s.online) && h('div.video__offline', 'يحتاج اتصالًا'),
    );

    // العمود الجانبي على اللابتوب: بقية دروس الوحدة تبقى مرئية أثناء القراءة
    const siblings = h('div.card', { style: 'overflow:hidden' });
    siblings.appendChild(h('div', { style: 'padding:14px 16px 10px;font-weight:700' }, unit.title));
    unit.lessons.forEach((id, n) => {
      const o = SEED.lessons[id];
      const st = s.lessons[id];
      siblings.appendChild(h('div.lesson', {
        style: id === l.id ? 'background:var(--acc-soft)' : '',
        onclick: () => id !== l.id && App.go('lesson', { id }, true),
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
            h('button.btn.btn--secondary.btn--sm', {
              onclick: () => { Store.toggleDownload(l.id); App.go('lesson', { id: l.id }, true); },
            }, saved ? 'محفوظ ✓' : [icon.down(16), 'تنزيل'])),
          h('div.card', h('div.prose', { html: l.body }))),

        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'تمارين هذا الدرس'),
            h('div.muted.small', { style: 'margin-bottom:14px' },
              `${ar(l.exercises.length)} تمارين تُحدّث إتقانك فورًا.`),
            h('button.btn.btn--primary.btn--block', {
              onclick: () => App.go('practice', { lesson: l.id }),
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
    if (params.lesson) pool = SEED.lessons[params.lesson].exercises.map((id) => SEED.questions[id]);
    // 'any' = جلسة شاملة على الأقسام الأربعة المصنَّفة، لا كل بنك الأسئلة —
    // الأسئلة غير المصنَّفة (section فارغ) لم يراجعها المدرّس بعد فتُستبعد.
    else if (params.section === 'any') pool = Object.values(SEED.questions).filter((q) => q.section);
    // فرع بعينه (وحدة) داخل قسم — من ضغط بند فرعي بالسلايد. params.unit فارغة
    // (لا محذوفة) تعني «فرع الأسئلة العامة»، أي بلا unitCode إطلاقًا.
    else if (params.section && params.unit !== undefined)
      pool = Object.values(SEED.questions).filter((q) =>
        q.section === params.section && (params.unit ? q.unitCode === params.unit : !q.unitCode));
    else if (params.section) pool = Object.values(SEED.questions).filter((q) => q.section === params.section);
    else                     pool = Object.values(SEED.questions);
    pool = pool.filter(Boolean);

    let i = 0, correct = 0;
    const wrap = h('div.screen');
    const body = h('div.screen__body', { style: 'padding:16px' });

    function step() {
      if (i >= pool.length) return finish();
      body.replaceChildren(C.questionCard(pool[i], {
        index: i, total: pool.length,
        onNext: (ok) => { if (ok) correct++; i++; step(); body.scrollTop = 0; },
      }));
    }

    function finish() {
      const pct = Math.round((correct / pool.length) * 100);
      if (params.lesson) Store.completeLesson(params.lesson);
      body.replaceChildren(h('div.card.card--pad',
        h('div.score',
          h('div.score__n', { style: `color:${pct >= 50 ? 'var(--ok)' : 'var(--err)'}` }, ar(pct) + '٪'),
          h('div.score__l', `${ar(correct)} صحيحة من ${ar(pool.length)}`)),
        h('div.muted.small.center', { style: 'margin-top:14px' },
          'سُجِّلت نتيجتك، وسيظهر أثرها في مؤشر التقدّم فورًا.'),
        h('button.btn.btn--primary.btn--block', {
          style: 'margin-top:18px',
          onclick: () => App.go('course', { tab: 'progress' }, true),
        }, 'شوف تقدّمك'),
        h('button.btn.btn--ghost.btn--block', {
          style: 'margin-top:6px',
          onclick: () => { i = 0; correct = 0; step(); },
        }, 'أعد الجلسة')));
    }

    step();
    wrap.append(C.appbar({ title: 'تمارين', onBack: () => App.back() }), body);
    return wrap;
  };
})();
