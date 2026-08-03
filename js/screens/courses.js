/* =============================================================================
   الكورسات — كتالوج كل ما نقدّمه، مفتوحًا كان أو مقفولًا

   الفرق عن «موادّي»: تلك تعرض ما اشترك فيه الطالب فعلًا، وهذه تعرض كل شيء —
   بما فيه ما لم يشترك فيه بعد — مع طريق واضح لطلبه.

   لا بوابة دفع في هذا التطبيق: الأكواد تُباع نقدًا عبر موزّعين. فزر «اشترك»
   هنا لا ينفّذ عملية شراء، بل يفتح واتساب برسالة جاهزة تحدّد ما يريده الطالب
   بالضبط — أرخص طريق ممكن، ولا يحتاج أي بنية تحتية جديدة.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, ar, icon } = UI;

  /**
   * ⚠️ رقم واتساب الموزّع — ضعه هنا بصيغة دولية بلا علامة + ولا صفر مقدّم.
   * مثال سوريا: 963933000000 (963 + الرقم بلا الصفر الأول).
   * بلا رقم حقيقي، الزر يفتح واتساب بلا مستلم — لازم تُستبدل قبل الاستخدام الفعلي.
   */
  // (نُقلا إلى components.js ليستعملهما هذا الكتالوج وصفحة الكورس التعريفية معًا:
  //  C.whatsappUrl / C.whatsappBtn — ورقم الموزّع معهما.)

  /**
   * بطاقة الكورس — صورة أولًا، ثم عنوان، ثم اسم الأستاذ (بيت من فريقنا أو
   * متعاقَد خارجيًا — الشكل بصري واحد للاثنين، والفرق التجاري خارج الواجهة)،
   * ثم حالة الاشتراك، ثم فعل واحد واضح.
   *
   * البطاقة كلها قابلة للضغط وتفتح صفحة الكورس التعريفية — حتى غير المشترَك
   * فيه. كورس لا يستطيع الطالب الدخول إليه ليرى فيديوه التقديمي وما يتضمّنه
   * هو كورس لا يُشترى.
   */
  function courseCard(course) {
    const subject = SEED.subjects.find((x) => x.id === course.subject);
    const grade = SEED.grades.find((x) => x.id === course.grade);
    const open = () => App.go('courseAbout', { id: course.id });

    // الزر داخل بطاقة قابلة للضغط: نوقف انتشار الحدث لئلّا يُفتح التعريف
    // فوق الفعل الذي قصده الطالب.
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

    return h('div.card.card--tap', { style: 'overflow:hidden', onclick: open },
      h('div.course-cover',
        subject?.cover
          ? h('img', { src: subject.cover, alt: '' })
          : h('span.ph', icon.book(34))),

      h('div.course-card__body',
        h('div.course-card__title', subject?.name || course.title),
        h('div.course-card__meta',
          [grade?.name, course.teacher].filter(Boolean).join(' · ') || ' '),

        h('div.course-card__badges',
          course.entitled
            ? h('span.badge.badge--free', 'مشترَك')
            : h('span.badge.badge--soon', 'غير مشترَك')),

        course.entitled
          ? h('button.btn.btn--primary.btn--block',
              { onclick: stop(() => App.go('course', { id: course.id })) }, 'متابعة')
          : h('button.btn.btn--secondary.btn--block',
              { onclick: stop(open) }, 'تفاصيل الكورس')),
    );
  }

  Screens.courses = () => {
    const courses = SEED.courses || [];

    return h('div.screen',
      C.appbar({ title: 'الكورسات', sub: 'كل ما نقدّمه — مشترَك أو لا', onBack: () => App.back() }),
      h('div.screen__body',
        courses.length
          ? h('div.wide', { style: 'padding:16px' },
              h('div.course-grid', ...courses.map(courseCard)))
          : C.empty({
              title: 'لا كورسات متاحة بعد',
              text: 'راجعنا لاحقًا — نضيف مواد جديدة باستمرار.',
            }),
      ),
    );
  };
})();
