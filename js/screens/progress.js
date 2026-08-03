/* =============================================================================
   تقدّمي — لوحة تقدّم عابرة للمواد

   تختلف عن تبويب «تقدّمي» داخل شاشة الكورس: ذاك يعرض تفصيل مادة واحدة وأنت
   بداخلها، وهذه نقطة دخول مستقلة من الشريط الجانبي تجمع **كل** المواد
   المشترَك بها في مكان واحد — بطاقة لكل مادة، بحسابها الخاص لا رقمًا عامًّا
   واحدًا مكرَّرًا. Store.courseProgress(id) يحصر كل بُعد (الفيديوهات، الأسئلة،
   الامتحانات) بدروس وأسئلة وامتحانات ذلك الكورس تحديدًا.
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

    // بطاقة تفصيل مادة واحدة — تُعاد لكل كورس مشترَك بحسابه المستقل
    const courseCard = (course) => {
      const subject = SEED.subjects.find((x) => x.id === course.subject) || {};
      const p = Store.courseProgress(course.id);

      return h('div.card.card--pad', { style: 'margin-bottom:14px' },
        h('div.row', { style: 'margin-bottom:14px' },
          h('div.grow', { style: 'font-weight:700;font-size:16px' },
            subject.name || course.title),
          h('span.faint.small', course.teacher || '')),

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
      C.appbar({ title: 'تقدّمي', sub: `عبر ${ar(entitledCourses.length)} مادة`, onBack: () => App.back() }),
      h('div.screen__body', { style: 'padding:16px' },
        h('div.wide', ...entitledCourses.map(courseCard)),
      ),
    );
  };
})();
