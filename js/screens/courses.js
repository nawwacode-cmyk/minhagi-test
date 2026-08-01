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
  const DISTRIBUTOR_WHATSAPP = '000000000000';

  function whatsappUrl(course, subject, grade) {
    const s = Store.get();
    const lines = [
      'مرحبًا 👋',
      `بدي أشترك بمادة: ${subject?.name || course.title}${grade ? ' — ' + grade.name : ''}`,
      s.username ? `اسمي بالتطبيق: ${s.username}` : null,
    ].filter(Boolean);
    return `https://wa.me/${DISTRIBUTOR_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  /**
   * بطاقة الكورس — صورة أولًا، ثم عنوان، ثم اسم الأستاذ (بيت من فريقنا أو
   * متعاقَد خارجيًا — الشكل بصري واحد للاثنين، والفرق التجاري خارج الواجهة)،
   * ثم حالة الاشتراك، ثم فعل واحد واضح.
   */
  function courseCard(course) {
    const subject = SEED.subjects.find((x) => x.id === course.subject);
    const grade = SEED.grades.find((x) => x.id === course.grade);

    return h('div.card', { style: 'overflow:hidden' },
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
          ? h('button.btn.btn--primary.btn--block', { onclick: () => App.go('course') },
              'متابعة')
          : h('a.btn.btn--secondary.btn--block', {
              href: whatsappUrl(course, subject, grade),
              target: '_blank', rel: 'noopener',
              style: 'text-decoration:none;display:flex',
            }, 'اطلب الاشتراك عبر واتساب')),
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
