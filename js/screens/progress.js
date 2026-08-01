/* =============================================================================
   تقدّمي — لوحة تقدّم عابرة للمواد

   تختلف عن تبويب «تقدّمي» داخل شاشة الكورس: ذاك يعرض تفصيل مادة واحدة وأنت
   بداخلها، وهذه نقطة دخول مستقلة من الشريط الجانبي تجمع **كل** المواد
   المشترَك بها في مكان واحد — بطاقة لكل مادة، لا مادة واحدة مفترَضة.

   ملاحظة صادقة: Store.subjectProgress() يحسب تقدّمًا عامًّا عبر كل
   SEED.lessons/mastery/exams، لا مقصورًا على مادة بعينها. مقبول الآن لأن
   مادة واحدة فقط مشترَك بها فعليًا، فالرقم صحيح بالصدفة السليمة. تخصيص
   الحساب لكل مادة على حدة عمل مؤجَّل عمدًا حتى يصير التعدّد واقعًا حقيقيًا،
   تمامًا كما في home. القادم هنا مبني بالفعل ليكرَّر بلا تعديل يوم يصير.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, ring, bar } = UI;

  Screens.progress = () => {
    const s = Store.get();
    const entitledCourses = (SEED.courses || []).filter((c) => c.entitled);

    if (!entitledCourses.length) {
      return h('div.screen',
        C.appbar({ title: 'تقدّمي', onBack: () => App.back() }),
        h('div.screen__body', { style: 'padding:16px' },
          C.empty({
            title: 'لا مادة مشترَك بها بعد',
            text: 'تصفّح الكورسات وابدأ اشتراكك لتظهر هنا لوحة تقدّمك.',
            action: h('button.btn.btn--primary', { onclick: () => App.go('courses') },
              'تصفّح الكورسات'),
          })));
    }

    const weak = Store.weakestTopic();
    const solved = Object.values(s.mastery).reduce((a, m) => a + m.total, 0);

    return h('div.screen',
      C.appbar({ title: 'تقدّمي', sub: `عبر ${ar(entitledCourses.length)} مادة`, onBack: () => App.back() }),
      h('div.screen__body',
        h('div.dash',
          h('div.dash__main',
            ...entitledCourses.map((course) => {
              const subject = SEED.subjects.find((x) => x.id === course.subject) || {};
              const p = Store.subjectProgress();

              return h('div.card.card--pad', { style: 'margin-bottom:14px' },
                h('div.row', { style: 'margin-bottom:14px' },
                  h('div.grow', { style: 'font-weight:700;font-size:16px' },
                    subject.name || course.title),
                  h('span.faint.small', course.teacher || '')),

                h('div', { style: 'display:grid;place-items:center' }, ring(p.percent, 108, 10)),

                // تفصيل المعادلة — المؤشر الذي لا يُفهم كيف يرتفع يفقد قدرته على التحفيز
                h('div', { style: 'margin-top:16px;border-top:1px solid var(--brd);padding-top:14px' },
                  ...[
                    ['الدروس المكتملة', p.lessonPct,  '٥٠٪ من المؤشر'],
                    ['إتقان المواضيع',  p.masteryAvg, '٣٥٪ من المؤشر'],
                    ['أفضل امتحان',     p.bestExam,   '١٥٪ من المؤشر'],
                  ].map(([label, val, w]) => h('div', { style: 'margin-bottom:11px' },
                    h('div.row', { style: 'margin-bottom:5px' },
                      h('div.grow.small', label),
                      h('span.faint', { style: 'font-size:11px' }, w),
                      h('span.mono.small', ar(val) + '٪')),
                    bar(val, 'bar--thin')))));
            }),

            h('div.card.card--pad',
              h('div', { style: 'font-weight:700;margin-bottom:8px' }, 'خريطة إتقان المواضيع'),
              ...SEED.topics.map((t) => C.masteryRow(t, s.mastery[t.id])))),

          h('aside.dash__side',
            h('div.card.card--pad',
              h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'إحصائياتك الكلّية'),
              h('div.stat-row',
                h('div.stat',
                  h('div.stat__v', ar(entitledCourses.length)),
                  h('div.stat__k', 'مادة مشترَكة')),
                h('div.stat',
                  h('div.stat__v', ar(solved)),
                  h('div.stat__k', 'تمرين محلول')),
                h('div.stat',
                  h('div.stat__v', ar(Math.round(Store.subjectProgress().percent))),
                  h('div.stat__k', 'المؤشر العام')))),

            weak && weak.mastery < 70 && h('div.callout',
              h('div.callout__t', `نقطة ضعفك الآن: ${weak.name}`),
              h('div.muted.small', { style: 'margin-bottom:10px' },
                `إتقانك ${ar(weak.mastery)}٪ — تمارين مخصّصة جاهزة.`),
              h('button.btn.btn--primary.btn--sm', {
                onclick: () => App.go('practice', { topic: weak.id }),
              }, 'ابدأ التمارين المقترحة'))),
        ),
      ),
    );
  };
})();
