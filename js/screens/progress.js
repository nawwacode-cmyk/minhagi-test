/* =============================================================================
   تقدّمي — لوحة تقدّم عابرة للمواد

   تختلف عن تبويب «تقدّمي» داخل شاشة المادة: ذاك يعرض تفصيل مادة واحدة وأنت
   بداخلها، وهذه نقطة دخول مستقلة من الشريط الجانبي تجمع **كل** المواد
   المشترَك بها في مكان واحد — بطاقة لكل مادة، بحسابها الخاص لا رقمًا عامًّا
   واحدًا مكرَّرًا. Store.subjectProgress(id) يحصر كل بُعد (الدروس، الامتحانات)
   بوحدات وامتحانات تلك المادة تحديدًا.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, ring, bar } = UI;

  Screens.progress = () => {
    const s = Store.get();
    const entitledSubjects = (SEED.subjects || []).filter((sub) => sub.entitled);

    // بلا شاشة اكتشاف/كتالوج حاليًا (أُزيلت مع طبقة الكورسات) — بلا اشتراك
    // فعّال نوجّه للدعم مباشرة لا لتصفّح كتالوج غير موجود.
    if (!entitledSubjects.length) {
      return h('div.screen',
        C.appbar({ title: 'تقدّمي', onBack: () => App.back() }),
        h('div.screen__body', { style: 'padding:16px' },
          C.empty({
            title: 'لا مادة مشترَك بها بعد',
            text: 'تواصل مع الدعم لتفعيل مادة على حسابك.',
          })));
    }

    // بطاقة تفصيل مادة واحدة — تُعاد لكل مادة مشترَك بها بحسابها المستقل
    const subjectCard = (subject) => {
      const p = Store.subjectProgress(subject.id);

      return h('div.card.card--pad', { style: 'margin-bottom:14px' },
        h('div.row', { style: 'margin-bottom:14px' },
          h('div.grow', { style: 'font-weight:600;font-size:16px' }, subject.name)),

        h('div', { style: 'display:grid;place-items:center' }, ring(p.percent, 108, 10)),

        // تفصيل المعادلة مقصود إعلانه — مؤشر لا يُفهم كيف يرتفع يفقد قدرته
        // على التحفيز. الأسماء هنا مطابقة لما يراه الطالب من محتوى فعليًا:
        // فيديو لكل درس، وأفضل امتحان لنفس مادة الكورس.
        h('div', { style: 'margin-top:16px;border-top:1px solid var(--brd);padding-top:14px' },
          ...[
            ['الفيديوهات (الدروس)', p.lessonPct, '٧٥٪ من المؤشر'],
            ['أفضل امتحان',         p.bestExam,  '٢٥٪ من المؤشر'],
          ].map(([label, val, w]) => h('div', { style: 'margin-bottom:11px' },
            h('div.row', { style: 'margin-bottom:5px' },
              h('div.grow.small', label),
              h('span.faint', { style: 'font-size:11px' }, w),
              h('span.mono.small', ar(val) + '٪')),
            bar(val, 'bar--thin')))),

        h('div.faint.small', { style: 'margin-top:4px' },
          `${ar(p.lessonsDone)} من ${ar(p.lessonsTotal)} درسًا`),
      );
    };

    return h('div.screen',
      C.appbar({ title: 'تقدّمي', sub: `عبر ${ar(entitledSubjects.length)} مادة`, onBack: () => App.back() }),
      h('div.screen__body', { style: 'padding:16px' },
        h('div.wide', ...entitledSubjects.map(subjectCard)),
      ),
    );
  };
})();
