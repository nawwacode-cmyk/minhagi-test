/* =============================================================================
   صفحة الكورس التعريفية — ما يراه الطالب **قبل** أن يشترك

   تُفتح بالضغط على أي بطاقة في الكتالوج، مشترَكًا كان الكورس أو لا. هذا مقصود:
   كورس لا يمكن الدخول إليه ورؤية ما فيه هو كورس لا يُشترى. الطالب يحتاج أن
   يشاهد الفيديو التقديمي ويقرأ ماذا يتضمّن ويرى فهرس الوحدات قبل أن يدفع.

   الفرق عن شاشة `course`: تلك بيئة الدراسة نفسها (دروس، تمارين، امتحانات،
   تقدّم) ولا تُفتح إلا لمن يملك صلاحية. وهذه صفحة تعريف مفتوحة للجميع.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, ar, icon } = UI;

  /**
   * إحصاءات الكورس المعروضة في «ماذا يتضمّن».
   *
   * لكورس غير مشترَك لا تصل وحداته عبر RLS أصلًا، فتكون الأرقام أصفارًا —
   * وعرض «٠ درسًا» أسوأ من عدم العرض: يوحي بكورس فارغ لا بكورس مقفل. لذلك
   * نعيد null في تلك الحالة ونكتفي بقائمة `includes` النصّية.
   */
  function stats(course) {
    const units = (SEED.units || []).filter((u) => u.course === course.id);
    if (!units.length) return null;

    const lessonIds = units.flatMap((u) => u.lessons || []);
    const exams = (SEED.exams || []).filter(
      (e) => e.subject === course.subject && e.grade === course.grade);
    const questions = new Set();
    lessonIds.forEach((id) => (SEED.lessons[id]?.exercises || []).forEach((q) => questions.add(q)));

    return {
      units: units.length,
      lessons: lessonIds.length,
      questions: questions.size,
      mock: exams.filter((e) => e.kind === 'mock').length,
      ministry: exams.filter((e) => e.kind === 'ministry').length,
      unit: exams.filter((e) => e.kind === 'unit').length,
    };
  }

  const statTile = (v, k) =>
    h('div.stat', h('div.stat__v', ar(v)), h('div.stat__k', k));

  Screens.courseAbout = ({ id }) => {
    const course = (SEED.courses || []).find((c) => c.id === id);

    if (!course) {
      return h('div.screen',
        C.appbar({ title: 'الكورس', onBack: () => App.back() }),
        h('div.screen__body', { style: 'padding:16px' },
          C.empty({ title: 'هذا الكورس لم يعد متاحًا',
                    text: 'ربما حُدِّث الكتالوج. عد إلى قائمة الكورسات.',
                    action: h('button.btn.btn--primary',
                      { onclick: () => App.go('courses') }, 'كل الكورسات') })));
    }

    const subject = SEED.subjects.find((x) => x.id === course.subject) || {};
    const grade   = SEED.grades.find((x) => x.id === course.grade);
    const st      = stats(course);
    const units   = (SEED.units || []).filter((u) => u.course === course.id);

    // الفيديو التقديمي مفتوح للجميع بحكم وظيفته — هو الإعلان نفسه، لا محتوى
    // مدفوعًا. غيابه ليس خطأً: كورس قيد الإعداد قد لا يملك واحدًا بعد.
    const intro = course.intro && h('div.video',
      h('img', { src: course.intro.thumb, alt: '' }),
      h('button.video__play', { 'aria-label': 'تشغيل الفيديو التقديمي' },
        h('span', icon.play(26))),
      h('div.video__len.mono', course.intro.length),
    );

    const cta = course.entitled
      ? h('button.btn.btn--primary.btn--block',
          { onclick: () => App.go('course', { id: course.id }) }, 'ادخل إلى الكورس')
      : C.whatsappBtn(course);

    return h('div.screen',
      C.appbar({
        title: subject.name || course.title,
        sub: [grade?.name, course.teacher].filter(Boolean).join(' · ') || null,
        onBack: () => App.back(),
      }),

      h('div.screen__body',
        h('div.dash',
          // --- العمود الرئيسي: التعريف والمحتوى ---
          h('div.dash__main',
            intro || h('div.course-cover.course-cover--tall',
              subject.cover ? h('img', { src: subject.cover, alt: '' })
                            : h('span.ph', icon.book(44))),

            h('div.card.card--pad', { style: 'margin-top:14px' },
              h('div', { style: 'font-weight:700;font-size:18px;margin-bottom:8px' },
                course.title),
              h('div.muted', { style: 'line-height:1.85' },
                course.about || 'سيُضاف وصف هذا الكورس قريبًا.')),

            st && h('div.card.card--pad', { style: 'margin-top:14px' },
              h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'محتوى الكورس بالأرقام'),
              h('div.stat-row',
                statTile(st.lessons, 'درسًا'),
                statTile(st.questions, 'سؤالًا'),
                statTile(st.mock + st.ministry + st.unit, 'امتحانًا'))),

            units.length
              ? h('div.card', { style: 'margin-top:14px' },
                  h('div', { style: 'padding:16px 16px 10px;font-weight:700' }, 'فهرس الوحدات'),
                  h('div.list-sep', ...units.map((u, i) =>
                    h('div.row', { style: 'padding:12px 16px' },
                      h('div.lesson__n', ar(i + 1)),
                      h('div.grow',
                        h('div.small', u.title),
                        h('div.faint', { style: 'font-size:12px' },
                          `${ar((u.lessons || []).length)} دروس`))))))
              : h('div.hint', { style: 'margin-top:14px' },
                  'فهرس الوحدات يظهر بعد الاشتراك.'),
          ),

          // --- العمود الجانبي: القرار ---
          h('aside.dash__side',
            h('div.card.card--pad',
              h('div.course-card__badges',
                course.entitled
                  ? h('span.badge.badge--free', 'مشترَك')
                  : h('span.badge.badge--soon', 'غير مشترَك')),
              cta,
              !course.entitled && h('div.hint', { style: 'margin-top:12px' },
                'الاشتراك سنوي، ويُفعَّل بكود تشتريه من الموزّع نقدًا. '
                + 'يعمل على أي جهاز، لكن على جهاز واحد في الوقت نفسه.')),

            course.includes?.length && h('div.card.card--pad',
              h('div', { style: 'font-weight:700;margin-bottom:12px' }, 'ماذا يتضمّن'),
              h('div.stack.gap-10', ...course.includes.map((line) =>
                h('div.row', { style: 'align-items:flex-start;gap:9px' },
                  h('span', { style: 'color:var(--acc-tx);flex:none;line-height:1.6' }, '✓'),
                  h('div.small', { style: 'line-height:1.6' }, line))))),

            course.teacher && h('div.card.card--pad.row',
              h('div.avatar', course.teacher[0]),
              h('div.grow',
                h('div', { style: 'font-weight:700' }, course.teacher),
                h('div.faint', { style: 'font-size:12px;margin-top:2px' },
                  `أستاذ ${subject.name || ''}`))),
          ),
        ),

        h('div', { style: 'height:20px' }),
      ),
    );
  };
})();
