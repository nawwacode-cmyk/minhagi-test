/* =============================================================================
   plan.js — «خطّتي» وجلسة التركيز

   القرار الحاكم في هذه الشاشة: **الطالب لا يُدخل شيئًا.**

   المُخطِّط الذي يملؤه المستخدم أشهرُ ميزةٍ ميّتة في تطبيقات التعليم، وسببه
   بنيويّ لا تصميميّ: العمل فوريّ والقيمة مؤجَّلة. وطالب البكالوريا تحت ضغط
   فلن يجلس ليجدول أربعين درسًا، فتبقى شاشةٌ فارغة تبدو له عطلًا لا دعوة.

   فنعطيه الجواب بدل الورقة البيضاء: نعرف موادّه وعدد دروسها وأيام اشتراكه،
   فنحسب الوتيرة. والاختيار الوحيد المطلوب منه نقرةٌ واحدة (مريح/متوازن/مكثّف)
   لا جدولٌ يملؤه.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, icon, ar } = UI;

  const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
                  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  const WEEK = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

  // ===========================================================================
  // خطّتي
  // ===========================================================================
  Screens.plan = () => {
    const s = Store.get();
    const p = Store.plan();
    const w = Store.week();
    const now = new Date();
    const m = Store.month(now.getFullYear(), now.getMonth());

    const subjectOf = (id) => (SEED.units || []).find((u) => (u.lessons || []).includes(id));

    // --- روزنامة الشهر ---
    const calendar = h('div.card.card--pad',
      h('div.cal__h',
        h('b', `${MONTHS[now.getMonth()]} ${ar(now.getFullYear())}`),
        h('small', `${ar(m.activeCount)} ${m.activeCount === 1 ? 'يوم نشط' : 'يومًا نشطًا'}`)),
      h('div.cal',
        ...WEEK.map((d) => h('span.cal__w', d)),
        ...m.cells.map((c) => {
          if (!c) return h('span');                       // فراغ ما قبل أوّل الشهر
          // «اليوم» يسبق «درستَ فيه»: الطالب يحتاج أن يجد موضعه أوّلًا
          return h('span.cal__d', {
            class: c.today ? 'is-today' : c.active ? 'is-did' : '',
            title: c.minutes ? `${ar(c.minutes)} دقيقة تركيز` : null,
          }, ar(c.d));
        })),
      h('div.cal__lg',
        h('span', h('i.is-did'), 'درستَ فيه'),
        h('span', h('i.is-today'), 'اليوم')));

    // --- هدف اليوم ---
    /* بلا مادة مشترَك بها لا خطّة أصلًا — ولا نعرض بطاقةً فارغة بزرّ يقود
       إلى لا شيء. وبعد إنهاء كل الدروس تتحوّل البطاقة إلى تهنئة لا إلى فراغ. */
    let goal;
    if (!p.total) {
      goal = C.empty({
        title: 'لا خطّة بعد',
        text: 'حين تُفعَّل مادة على حسابك تُحسب لك خطّةٌ يومية تلقائيًّا.',
      });
    } else if (!p.remaining) {
      goal = h('div.goal.goal--done',
        h('div.goal__k', 'أنهيتَ المنهاج'),
        h('div.goal__t', 'كل دروسك مُنجَزة'),
        h('div.goal__s', 'راجع بالتمارين والامتحانات التجريبية لتثبيت ما درست.'));
    } else {
      goal = h('div.goal',
        h('div.goal__k', p.metGoal ? 'أنجزتَ هدف اليوم' : 'هدف اليوم · محسوبٌ لك'),
        h('div.goal__t',
          `${ar(p.perDay)} ${p.perDay === 1 ? 'درس' : p.perDay === 2 ? 'درسان' : 'دروس'}`
          + ` · ${ar(p.todayIds.reduce((n, id) => n + (SEED.lessons[id]?.minutes || 0), 0))} دقيقة`),
        ...p.todayIds.map((id) => {
          const l = SEED.lessons[id];
          if (!l) return null;
          const done = p.doneToday.includes(id);
          const unit = subjectOf(id);
          return h('button.task' + (done ? '.is-done' : ''), {
            onclick: () => App.go('lesson', { id, subject: unit?.subject }),
          },
            h('em', done ? icon.check(11) : null),
            h('span.grow', l.title),
            h('small', `${ar(l.minutes || 0)} د`));
        }).filter(Boolean),
        p.metGoal
          ? h('div.goal__s', 'يمكنك المتابعة — كل درس زيادة يقرّب النهاية.')
          : null);
    }

    // --- الوتيرة والتوقّع ---
    const paceRow = p.total && p.remaining
      ? h('div.pace',
          ...Object.entries(Store.PACE).map(([key, v]) =>
            h('button.pace__c' + (s.pace === key ? '.is-on' : ''), {
              onclick: () => { Store.setPace(key); App.render(); },
            }, v.label)))
      : null;

    /* التوقّع صادقٌ في الاتجاهين. توقّعٌ متفائل كاذب يُفقد الخطّة كلَّها ثقتها
       من أوّل أسبوع، فحين لا تكفي الوتيرة نقول ذلك ونقترح رفعها. */
    let projection = null;
    if (p.projection && p.projection.enough !== null) {
      const j = p.projection;
      projection = j.enough
        ? h('div.proj', icon.check(15),
            h('span', j.margin > 0
              ? `بهذه الوتيرة تُنهي موادّك قبل انتهاء اشتراكك بـ${ar(j.margin)} ${j.margin === 1 ? 'يوم' : 'أيام'}.`
              : 'بهذه الوتيرة تُنهي موادّك يوم انتهاء اشتراكك تمامًا.'))
        : h('div.proj.proj--tight', icon.warn(15),
            h('span', `بهذه الوتيرة تحتاج ${ar(j.needDays)} يومًا، ولا يبقى في اشتراكك`
              + ` غير ${ar(s.daysLeft)}. ارفع الوتيرة أو جدّد اشتراكك.`));
    } else if (p.projection) {
      // لا مدّة اشتراك معروفة: نعرض المدّة المطلوبة بلا حكم لا نملك أساسه
      projection = h('div.proj', icon.check(15),
        h('span', `بهذه الوتيرة تحتاج نحو ${ar(p.projection.needDays)} يومًا لإنهاء موادّك.`));
    }

    return h('div.screen',
      C.appbar({ title: 'خطّتي', onBack: () => App.back() }),
      h('div.screen__body', { style: 'padding:14px 16px 20px' },
        h('div.plan',
          h('div.plan__main', goal, paceRow, projection),
          h('div.plan__side', calendar, weekCard(w))),
      ));
  };

  /**
   * الهدف الأسبوعي — **متسامح لا عقابيّ**.
   *
   * السلسلة التي تنكسر (streak) تعاقب على الحياة لا على الكسل: طالبٌ درس ستّة
   * أيام بجدٍّ ثم غاب يومًا لظرف يخسر كل شيء ويرى صفرًا، والأثر المعروف أنه
   * يترك التطبيق بعد أوّل انكسار. القياس على الأسبوع كلّه يبقى قابلًا
   * للتحقيق ولو غاب يومان — وهو يقيس الشيء نفسه بلا العقوبة.
   */
  function weekCard(w) {
    return h('div.card.card--pad',
      h('div.cal__h',
        h('b', `${ar(w.hit)} من ${ar(w.goal)} أيام`),
        w.met ? h('small.is-met', 'تحقّق هدفك') : h('small', `هدفك ${ar(w.goal)} أيام`)),
      h('div.week',
        ...w.days.map((d) => h('span.week__d'
          + (d.active ? '.is-on' : '') + (d.today ? '.is-now' : ''),
          h('i'), h('small', d.label)))),
      w.minutes
        ? h('div.hint', { style: 'margin-top:10px' },
            `${ar(w.minutes)} دقيقة تركيز هذا الأسبوع`)
        : null);
  }

  // ===========================================================================
  // جلسة التركيز
  //
  // مؤقّت على الجهاز وحده: لا خادم ولا جدول ولا مزامنة. ويُفتح **من داخل
  // الدرس** لا من الشريط السفلي — تبويبٌ مستقلّ يُفتح مرّةً للفضول ثم يُنسى،
  // أمّا زرٌّ في الدرس فيقع في لحظة الحاجة إليه.
  // ===========================================================================
  const FOCUS_MIN = 25;

  Screens.focus = (params) => {
    const lesson = SEED.lessons[params.lesson];
    const unit = (SEED.units || []).find((u) => (u.lessons || []).includes(params.lesson));
    const subjectName = (SEED.subjects || []).find((x) => x.id === params.subject)?.name || '';

    const total = FOCUS_MIN * 60;
    /* النهاية طابعٌ زمني لا عدّاد تنازلي — نفس علّة مؤقّت الامتحان: العدّاد
       يتجمّد إذا جُمّد التبويب أو أُطفئت الشاشة، فيعود الطالب بعد نصف ساعة
       ليجد المؤقّت كما تركه. */
    let endsAt = Date.now() + total * 1000;
    let paused = false;
    let leftWhenPaused = total;
    let timer;

    const wrap = h('div.screen');
    const time = h('b.dial__t', `${ar(FOCUS_MIN)}:٠٠`);
    const sub = h('small.dial__s', `من ${ar(FOCUS_MIN)} دقيقة`);
    const dial = h('div.dial', h('span.dial__in', time, sub));
    const pauseBtn = h('button.btn.btn--secondary', { onclick: togglePause }, 'إيقاف');

    const left = () => (paused ? leftWhenPaused : Math.max(0, Math.round((endsAt - Date.now()) / 1000)));

    function paint() {
      const l = left();
      const mm = String(Math.floor(l / 60)).padStart(2, '0');
      const ss = String(l % 60).padStart(2, '0');
      time.textContent = ar(`${mm}:${ss}`);
      dial.style.setProperty('--p', ((total - l) / total) * 100 + '%');
      if (l === 0) finish();
    }

    function tick() {
      // غادر الطالب الشاشة: العقدة لم تعد في الصفحة — نوقف المؤقّت كي لا
      // يبقى يعمل خلف شاشة أخرى إلى الأبد.
      if (!wrap.isConnected) { clearInterval(timer); return; }
      if (!paused) paint();
    }

    function togglePause() {
      if (paused) { endsAt = Date.now() + leftWhenPaused * 1000; paused = false; }
      else { leftWhenPaused = left(); paused = true; }
      pauseBtn.textContent = paused ? 'متابعة' : 'إيقاف';
      sub.textContent = paused ? 'متوقّفة مؤقّتًا' : `من ${ar(FOCUS_MIN)} دقيقة`;
    }

    /* تُحتسب الدقائق المنقضية لا الجلسة كاملة: طالبٌ أنهى بعد سبع دقائق درس
       سبعًا لا خمسًا وعشرين، ورقمٌ مُضخَّم يُفسد «دقائق التركيز» كمقياس. */
    /* تُحتسب الدقائق المنقضية لا الجلسة كاملة، ثم نعود إلى «خطّتي»
       بـ`replace` لا `go`: الجلسة انتهت فلا معنى للرجوع إليها بزرّ الرجوع —
       ولا لأن يجدها الطالب في سجلّه وهي مؤقّتٌ صفريّ. */
    function finish() {
      clearInterval(timer);
      Store.recordFocus((total - left()) / 60);
      App.go('plan', {}, true);
    }

    wrap.append(
      C.appbar({ title: 'جلسة تركيز', onBack: () => finish() }),
      h('div.screen__body.focus',
        dial,
        lesson
          ? h('div.card.card--pad.focus__l',
              h('b', lesson.title),
              h('small', [subjectName, unit?.title].filter(Boolean).join(' · ')))
          : null,
        h('div.row', { style: 'gap:9px;margin-top:16px' },
          pauseBtn,
          h('button.btn.btn--primary', { onclick: () => finish() }, 'إنهاء الجلسة')),
        h('div.hint', { style: 'margin-top:16px' }, todayLine())),
    );

    paint();
    timer = setInterval(tick, 1000);
    return wrap;
  };

  function todayLine() {
    const s = Store.get();
    const mins = s.focusMin[Store.dayKey()] || 0;
    return mins ? `${ar(mins)} دقيقة تركيز اليوم` : 'أوّل جلسة لك اليوم';
  }
})();
