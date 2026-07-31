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

    // --- تبويب التمارين: تعلّم حسب الموضوع --------------------------------------
    function tabPractice() {
      const s = Store.get();

      const card = h('div.card.list-sep', { style: 'overflow:hidden' });
      SEED.topics.forEach((t) => {
        const qs = Object.values(SEED.questions).filter((q) => q.topic === t.id);
        const m = s.mastery[t.id];
        card.appendChild(h('button.rowlink', {
          disabled: !qs.length,
          style: qs.length ? '' : 'opacity:.45',
          onclick: () => qs.length && App.go('practice', { topic: t.id }),
        },
          h('div.rowlink__b',
            h('div', { style: 'font-weight:600' }, t.name,
              t.native && h('span.faint', { style: 'font-weight:400;font-size:12px' }, ' · '),
              t.native && fr(t.native)),
            h('div.rowlink__s', qs.length
              ? `${ar(qs.length)} تمارين${m ? ` · إتقانك ${ar(m.mastery)}٪` : ''}`
              : 'لا تمارين بعد')),
          m && h('span.badge.' + (m.mastery >= 70 ? 'badge--ok' : 'badge--acc'), ar(m.mastery) + '٪'),
          h('span.faint', icon.back(18))));
      });

      const weak = Store.weakestTopic();

      return h('div.dash',
        h('div.dash__main',
          h('div.muted.small', 'اختر موضوعًا لتتدرّب عليه، أو ابدأ جلسة شاملة من بنك الأسئلة.'),
          card),
        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'جلسة شاملة'),
            h('div.muted.small', { style: 'margin-bottom:14px' },
              `كل بنك الأسئلة — ${ar(Object.keys(SEED.questions).length)} سؤالًا من كل المواضيع.`),
            h('button.btn.btn--primary.btn--block', { onclick: () => App.go('practice', {}) },
              'ابدأ الجلسة')),
          weak && weak.mastery < 70 && h('div.callout',
            h('div.callout__t', `نقطة ضعفك: ${weak.name}`),
            h('div.muted.small', { style: 'margin-bottom:10px' }, `إتقانك ${ar(weak.mastery)}٪.`),
            h('button.btn.btn--primary.btn--sm', {
              onclick: () => App.go('practice', { topic: weak.id }),
            }, 'تمارين مخصّصة'))),
      );
    }

    // --- تبويب التقدّم ----------------------------------------------------------
    function tabProgress() {
      const s = Store.get();
      const p = Store.subjectProgress();
      const weak = Store.weakestTopic();

      return h('div.dash',
        h('div.dash__main',
          h('div.card.card--pad',
            h('div', { style: 'display:grid;place-items:center' }, ring(p.percent, 132, 11)),
            h('div.center.muted.small', { style: 'margin-top:10px' }, 'تقدّمك في اللغة الفرنسية'),

            // تفصيل المعادلة — المؤشر الذي لا يُفهم كيف يرتفع يفقد قدرته على التحفيز
            h('div', { style: 'margin-top:18px;border-top:1px solid var(--brd);padding-top:16px' },
              ...[
                ['الدروس المكتملة', p.lessonPct,  '٥٠٪ من المؤشر'],
                ['إتقان المواضيع',  p.masteryAvg, '٣٥٪ من المؤشر'],
                ['أفضل امتحان',     p.bestExam,   '١٥٪ من المؤشر'],
              ].map(([label, val, w]) => h('div', { style: 'margin-bottom:13px' },
                h('div.row', { style: 'margin-bottom:5px' },
                  h('div.grow.small', label),
                  h('span.faint', { style: 'font-size:11px' }, w),
                  h('span.mono.small', ar(val) + '٪')),
                bar(val, 'bar--thin'))))),

          h('div.card.card--pad',
            h('div', { style: 'font-weight:700;margin-bottom:8px' }, 'خريطة إتقان المواضيع'),
            ...SEED.topics.map((t) => C.masteryRow(t, s.mastery[t.id])))),

        h('aside.dash__side',
          h('div.card.card--pad',
            h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'إحصائياتك'),
            h('div.stat-row',
              h('div.stat',
                h('div.stat__v', ar(p.lessonsDone)),
                h('div.stat__k', 'درس مكتمل')),
              h('div.stat',
                h('div.stat__v', ar(Object.values(s.mastery).reduce((a, m) => a + m.total, 0))),
                h('div.stat__k', 'تمرين محلول')),
              h('div.stat',
                h('div.stat__v', { style: 'color:var(--ok)' }, ar(p.bestExam) + '٪'),
                h('div.stat__k', 'أفضل امتحان')))),

          weak && weak.mastery < 70 && h('div.callout',
            h('div.callout__t', `نقطة ضعفك الآن: ${weak.name}`),
            h('div.muted.small', { style: 'margin-bottom:10px' },
              `إتقانك ${ar(weak.mastery)}٪ — تمارين مخصّصة جاهزة.`),
            h('button.btn.btn--primary.btn--sm', {
              onclick: () => App.go('practice', { topic: weak.id }),
            }, 'ابدأ التمارين المقترحة'))),
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
    if (params.lesson)     pool = SEED.lessons[params.lesson].exercises.map((id) => SEED.questions[id]);
    else if (params.topic) pool = Object.values(SEED.questions).filter((q) => q.topic === params.topic);
    else                   pool = Object.values(SEED.questions);
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
          'تحدّثت خريطة إتقانك، وسيظهر أثرها في مؤشر التقدّم فورًا.'),
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
