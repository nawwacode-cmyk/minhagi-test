/* =============================================================================
   الترحيب · تسجيل الدخول
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, svg } = UI;

  const check = (s = 18) => svg('<path d="m4 12 5 5L20 6"/>', s, { width: 2.6 });

  // ===========================================================================
  // ١. الترحيب
  //
  // على الهاتف: صورة ملء الشاشة والمحتوى فوقها.
  // على اللابتوب: عمودان — الصورة على اليمين وبطاقة الدخول على اليسار، فلا
  // تبقى الصورة ممتدة بلا داعٍ ولا يطفو المحتوى وسط فراغ.
  // ===========================================================================
  Screens.welcome = () => {
    const bullets = [
      ['دروس بالفيديو والنص', 'شرح المنهاج درسًا درسًا، مع تمارين على كل درس.'],
      ['بنك أسئلة وتعلّم حسب الموضوع', 'تدرّب على نقطة ضعفك تحديدًا لا على المنهاج كله.'],
      ['امتحانات تجريبية ودورات وزارية', 'نفس نمط الأسئلة الحقيقي، بتصحيح فوري.'],
      ['يعمل دون إنترنت', 'نزّل الدروس مرة واحدة وادرسها في أي وقت.'],
    ];

    // ترتيب DOM: الصورة أولًا (فوق على الهاتف)، واللوحة ثانيًا.
    // على اللابتوب يقلبهما CSS بـ order فتصير اللوحة يمينًا والصورة يسارًا.
    return h('div.screen.welcome',
      h('div.welcome__art',
        h('img', { src: 'assets/img/welcome.jpg', alt: 'طلاب يدرسون على أجهزتهم' })),

      h('div.welcome__panel',
        h('div.welcome__inner',
          h('div.welcome__brand',
            h('img', { src: 'assets/img/icon-192.png', alt: '' }),
            h('div',
              h('div.welcome__name', 'منهاجي'),
              h('div.welcome__tag', 'منهاجك السوري بين يديك'))),

          h('div.welcome__pitch',
            'كل مواد منهاجك في تطبيق واحد — دروس، تمارين، وامتحانات وزارية.'),

          h('div.welcome__list',
            ...bullets.map(([t, s]) => h('div.wfeat',
              h('span.wfeat__i', check(13)),
              h('div',
                h('div.wfeat__t', t),
                h('div.wfeat__s', s))))),

          h('div.welcome__actions',
            h('button.btn.btn--primary.btn--block', { onclick: () => App.go('auth') },
              'دخول بكود التفعيل'),
            h('button.btn.btn--ghost.btn--block', {
              style: 'margin-top:6px',
              onclick: () => { Store.set({ signedIn: true, username: 'زائر' }); App.go('home'); },
            }, 'جرّب التطبيق قبل الاشتراك'),
            h('div.center.faint', { style: 'font-size:11.5px;margin-top:10px' },
              'الإصدار ١٫٠٫٠')))),
    );
  };

  // ===========================================================================
  // ٢. تسجيل الدخول — اسم مستخدم + كود تفعيل، لا شيء غيرهما
  //
  // لا بريد ولا كلمة مرور: الكود نفسه هو بمثابة كلمة السر، وارتباطه بجهاز
  // واحد هو ما يمنع تداوله. النتيجة المباشرة أنه **لا يوجد استرداد ذاتي**
  // عند فقدان الجهاز، فمسار الدعم يجب أن يكون ظاهرًا في هذه الشاشة نفسها.
  // ===========================================================================
  Screens.auth = () => {
    /** ١١ محرفًا: FR9 + ثمانية. نفس الطول في tools/gen-codes وفي دالة activate. */
    const LEN = 11;
    const errBox = h('div');

    const userInput = h('input.input', {
      type: 'text', autocomplete: 'username', placeholder: 'مثلًا: أحمد التاسع',
      oninput: () => clearError(),
    });

    /**
     * حقل واحد بتنسيق تلقائي بدل خانات منفصلة.
     *
     * الخانات المنفصلة أجمل لكنها لا تتّسع: ١١ خانة تحتاج ٤٦٠ بكسل ولا تدخل
     * في هاتف بعرض ٣٦٠. والحقل الواحد يقبل اللصق والكتابة والحذف بسلوك متوقّع
     * على كل مقاس، ويضيف الشرطات وهو يُكتب.
     */
    const codeInput = h('input.codeline', {
      type: 'text', dir: 'ltr', inputmode: 'latin', autocapitalize: 'characters',
      autocomplete: 'off', spellcheck: 'false',
      placeholder: 'FR9-XXXX-XXXX',
      'aria-label': 'كود التفعيل',
      oninput: (e) => {
        const raw = clean(e.target.value);
        e.target.value = format(raw);
        e.target.classList.toggle('is-full', raw.length === LEN);
        clearError();
      },
      onkeydown: (e) => { if (e.key === 'Enter') submit(); },
    });

    const clean = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LEN);
    const format = (r) =>
      [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11)].filter(Boolean).join('-');

    const field = h('div', codeInput);

    function clearError() {
      codeInput.classList.remove('is-err');
      userInput.classList.remove('is-err');
      errBox.replaceChildren();
    }

    function fail(msg, which) {
      if (which === 'user') userInput.classList.add('is-err');
      else codeInput.classList.add('is-err');
      errBox.replaceChildren(h('div.fb.fb--no', { style: 'margin-top:14px' },
        h('div.fb__h', 'تعذّر تسجيل الدخول'),
        h('div.fb__b', msg)));
    }

    const btn = h('button.btn.btn--primary.btn--lg.btn--block',
      { style: 'margin-top:18px' }, 'دخول');

    async function submit() {
      const username = userInput.value.trim();
      const code = clean(codeInput.value);

      if (username.length < 3) return fail('اسم المستخدم قصير — ٣ أحرف على الأقل.', 'user');
      if (code.length !== LEN) return fail('كود التفعيل غير مكتمل — ١١ حرفًا ورقمًا.', 'code');

      btn.disabled = true;
      btn.textContent = 'جارٍ التحقق…';
      clearError();

      try {
        const res = await Api.activate(
          username, code, await Device.fingerprint(), Device.platform());

        Store.set({
          signedIn: true, activated: true, evicted: false,
          username: res.username || username,
        });
        App.go('home');
        // الدخول الجديد أبطل أي جلسة سابقة — نسحب المحتوى والتقدّم فورًا
        Sync.syncNow().then(() => App.render());

      } catch (e) {
        // الرسائل تأتي بالعربية من الدالة على السيرفر — لا نترجمها هنا
        fail(e.message || 'تعذّر تسجيل الدخول.',
             e.code === 'bad_user' ? 'user' : 'code');
      } finally {
        btn.disabled = false;
        btn.textContent = 'دخول';
      }
    }
    btn.addEventListener('click', submit);

    const wrap = h('div.screen',
      C.appbar({ title: 'تسجيل الدخول', onBack: () => App.back() }),

      h('div.screen__body',
        h('div.dash',
          h('div.dash__main',
            h('div.card.card--pad',
              h('div', { style: 'font-size:19px;font-weight:700;margin-bottom:4px' },
                'ادخل باسمك وكود التفعيل'),
              h('div.muted.small', { style: 'margin-bottom:20px' },
                'لا حاجة لبريد إلكتروني ولا كلمة مرور. الكود وحده يفتح اشتراكك.'),

              h('div.field',
                h('label', { for: 'u' }, 'اسم المستخدم'),
                userInput,
                h('div.hint', 'اسم تعرفه أنت — يظهر داخل التطبيق ويستخدمه الدعم للبحث عن حسابك.')),

              h('div.field', { style: 'margin-bottom:8px' },
                h('label', 'كود التفعيل'),
                field,
                h('div.hint.center', { style: 'margin-top:10px' },
                  'الأحرف الصغيرة والشرطات مقبولة، وتُنظَّف تلقائيًا.')),

              errBox,
              btn,
            )),

          h('aside.dash__side',
            h('div.callout.callout--info',
              h('div.callout__t', 'تحتاج كودًا حقيقيًا'),
              h('div.small',
                'التطبيق موصول بقاعدة بيانات حيّة الآن. الأكواد تُشترى من الموزّع، ',
                'ولا تعمل أكواد التجربة السابقة.')),

            h('div.card.card--pad',
              h('div.row', { style: 'margin-bottom:8px' },
                h('span', { style: 'color:var(--info)' }, icon.warn(20)),
                h('div', { style: 'font-weight:700' }, 'جلسة واحدة في الوقت نفسه')),
              h('div.muted.small',
                'اشتراكك يعمل على أي جهاز — هاتفك أو حاسوبك — لكن على واحد '
                + 'في الوقت نفسه. إن دخلت من جهاز آخر يُغلق السابق تلقائيًا.'),
              h('div.small', { style: 'margin-top:12px;font-weight:600' },
                'غيّرت جهازك أو أعدت تثبيت التطبيق؟'),
              h('div.muted.small', { style: 'margin-top:2px' },
                'ادخل بنفس الاسم والكود — لا شيء يضيع، وتقدّمك ينتقل معك.')),
          ),
        ),
      ),
    );

    setTimeout(() => userInput.focus(), 60);
    return wrap;
  };
})();
