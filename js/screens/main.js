/* =============================================================================
   الرئيسية · حسابي
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, ring, bar } = UI;

  // --- ٥. الرئيسية -------------------------------------------------------------
  Screens.home = () => {
    const s = Store.get();
    // قبل أول مزامنة ناجحة تكون SEED فارغة تمامًا — لا صف ولا مادة ولا درس.
    // كل قراءة من SEED هنا يجب أن تحتمل ذلك، وإلّا انهارت الشاشة الأولى نفسها
    // على طالب فتح التطبيق أول مرة أو بلا إنترنت.
    const gradeName = SEED.grades.find((g) => g.id === s.grade)?.name || '';

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

    const banner = C.syncBanner();

    return h('div.screen',
      h('header.appbar',
        h('div.avatar', (s.username || '؟')[0]),
        h('div.appbar__title', `مرحبًا، ${s.username || 'زائر'}`,
          h('div.appbar__sub', s.activated ? 'اشتراكك فعّال' : 'وضع التجربة')),
        h('button.iconbtn', { onclick: () => App.go('account'), 'aria-label': 'حسابي' }, icon.user(20)),
      ),

      h('div.screen__body',
        banner ? h('div', { style: 'padding:14px 16px 0' }, banner) : h('span'),

        h('div.dash',
          // --- العمود الرئيسي: المواد ---
          h('div.dash__main',
            h('div.section-label', { style: 'padding:0 0 2px' }, 'موادّي'),

            entitledSubjects.length
              ? h('div.stack.gap-10', ...entitledSubjects.map((subject) => {
                  const p = Store.subjectProgress(subject.id);
                  return h('div.card.card--tap', { onclick: () => App.go('course', { subject: subject.id }) },
                    subject.cover && h('div.subject__cover', h('img', { src: subject.cover, alt: '' })),
                    h('div.subject',
                      ring(p.percent, 68),
                      h('div.subject__body',
                        h('div.subject__title', subject.name),
                        h('div.subject__meta',
                          `${gradeName} · ${ar(p.lessonsDone)} دروس من ${ar(p.lessonsTotal)}`),
                        s.activated
                          ? h('div.subject__sub', `متبقٍ ${ar(s.daysLeft)} يومًا على اشتراكك`)
                          : h('div', { style: 'margin-top:6px' },
                              h('span.badge.badge--free', 'درس مجاني متاح')))));
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
              h('div.muted.small', { style: 'margin-bottom:4px' }, 'تابع من حيث توقفت'),
              h('div', { style: 'font-weight:700;font-size:17px;margin-bottom:2px' }, next.title),
              h('div.faint.small', { style: 'margin-bottom:14px' },
                `فيديو ${next.video.length} · ${ar(next.exercises.length)} تمارين`),
              h('button.btn.btn--primary.btn--block', {
                onclick: () => App.go('lesson', { id: nextId, subject: nextSubjectId }),
              }, 'أكمل الدرس')),

            h('div.card.card--pad',
              h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'لمحة سريعة'),
              h('div.stat-row',
                h('div.stat',
                  h('div.stat__v', { style: 'color:var(--acc-tx)' }, ar(overallPct) + '٪'),
                  h('div.stat__k', 'تقدّمك')),
                h('div.stat',
                  h('div.stat__v', ar(s.downloaded.length)),
                  h('div.stat__k', 'درس محفوظ'))),
              h('button.btn.btn--ghost.btn--block', {
                style: 'margin-top:10px',
                onclick: () => App.go('progress'),
              }, 'تفاصيل تقدّمك')),

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
              h('div', { style: 'font-weight:700' }, 'اشتراك اللغة الفرنسية'),
              s.activated
                ? h('div', { style: 'color:var(--gold);font-weight:600;font-size:14px;margin-top:4px' },
                    `متبقٍ ${ar(s.daysLeft)} يومًا`)
                : h('div.muted.small', { style: 'margin-top:4px' }, 'غير مفعّل — أنت في وضع التجربة'),
              h('div.faint.small', { style: 'margin-top:4px' },
                s.activated
                  ? `المستخدم: ${s.username} · ${SEED.grades.find((g) => g.id === s.grade).name}`
                  : 'الدروس المجانية فقط متاحة'),
              !s.activated && h('button.btn.btn--primary.btn--sm', {
                style: 'margin-top:12px', onclick: () => App.go('auth'),
              }, 'دخول بكود التفعيل')),

            h('div.card',
              h('div', { style: 'padding:16px 16px 10px;font-weight:700' }, 'التنزيلات'),
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
              h('div', { style: 'padding:16px 16px 8px;font-weight:700' }, 'جلستك الحالية'),
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
                        App.go('welcome');
                      },
                    }, 'تسجيل الخروج'))
                : h('div.muted.small', { style: 'padding:4px 16px 12px' },
                    'أنت في وضع التجربة — لا جلسة مرتبطة.'),
              h('div.hint', { style: 'padding:0 16px 14px' },
                'اشتراكك يعمل على أي جهاز، لكن على جهاز واحد في الوقت نفسه. '
                + 'إن دخلت من جهاز آخر يُغلق هذا تلقائيًا.')),

            h('div.card.card--pad.row',
              h('div.grow',
                h('div', { style: 'font-weight:700' }, 'الوضع الليلي'),
                h('div.faint', { style: 'font-size:12px;margin-top:2px' },
                  'إلزامي في هذا التطبيق، ليس رفاهية')),
              h('button.switch' + (s.theme === 'dark' ? '.is-on' : ''), {
                'aria-label': 'الوضع الليلي',
                onclick: () => { Store.setTheme(s.theme === 'dark' ? 'light' : 'dark'); draw(); },
              }, h('i'))),

            h('div.card.card--pad.row',
              h('div.grow',
                h('div', { style: 'font-weight:700' }, 'محاكاة انقطاع الإنترنت'),
                h('div.faint', { style: 'font-size:12px;margin-top:2px' },
                  'لتجربة سلوك التطبيق دون اتصال')),
              h('button.switch' + (!s.online ? '.is-on' : ''), {
                'aria-label': 'وضع أوفلاين',
                onclick: () => { Store.toggleOnline(); App.drawRail(); draw(); },
              }, h('i'))),

            h('button.btn.btn--ghost.btn--block', {
              style: 'color:var(--err)',
              onclick: () => {
                if (confirm('سيُمسح تقدّمك في هذه التجربة. متابعة؟')) { Store.reset(); App.go('welcome'); }
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
