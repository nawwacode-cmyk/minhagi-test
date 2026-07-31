/* =============================================================================
   الترحيب · تسجيل الدخول
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, svg } = UI;

  const check = () => svg('<path d="m4 12 5 5L20 6"/>', 18);

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

    return h('div.screen.welcome',
      h('div.welcome__art',
        h('img', { src: 'assets/img/hero.svg', alt: 'طالب يدرس ليلًا' }),
        h('div.hero__scrim'),
        h('div.welcome__over.row',
          h('img', { src: 'assets/img/icon-192.png', alt: '', width: 52, height: 52,
                     style: 'border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,.3)' }),
          h('div',
            h('div.hero__logo', 'منهاجي'),
            h('div.hero__tag', 'منهاجك السوري بين يديك')))),

      h('div.welcome__panel',
        h('div.welcome__inner',
          h('div.welcome__pitch',
            'كل مواد منهاجك في تطبيق واحد — دروس، تمارين، وامتحانات وزارية.'),

          h('div.welcome__list',
            ...bullets.map(([t, s]) => h('div.wfeat',
              h('span.wfeat__i', check()),
              h('div',
                h('div.wfeat__t', t),
                h('div.wfeat__s', s))))),

          h('div.welcome__actions',
            h('button.btn.btn--primary.btn--lg.btn--block', { onclick: () => App.go('auth') },
              'دخول بكود التفعيل'),
            h('button.btn.btn--ghost.btn--block', {
              style: 'margin-top:6px',
              onclick: () => { Store.set({ signedIn: true, username: 'زائر' }); App.go('home'); },
            }, 'جرّب التطبيق قبل الاشتراك'),
            h('div.center.faint', { style: 'font-size:12px;margin-top:10px' },
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
    const LEN = 7;
    const boxes = [];
    const errBox = h('div');

    const userInput = h('input.input', {
      type: 'text', autocomplete: 'username', placeholder: 'مثلًا: أحمد التاسع',
      oninput: () => clearError(),
    });

    const field = h('div.codebox',
      h('div.codebox__g', ...[0, 1, 2].map(mk)),
      h('span.codebox__sep', '–'),
      h('div.codebox__g', ...[3, 4, 5, 6].map(mk)),
    );

    function clearError() {
      field.classList.remove('is-err');
      userInput.classList.remove('is-err');
      errBox.replaceChildren();
    }

    function mk(i) {
      const inp = h('input', {
        maxlength: 1, inputmode: 'latin', autocapitalize: 'characters',
        'aria-label': `خانة الكود ${i + 1}`,
        oninput: (e) => {
          e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          e.target.classList.toggle('is-filled', !!e.target.value);
          if (e.target.value && i < LEN - 1) boxes[i + 1].focus();
          clearError();
        },
        onkeydown: (e) => {
          if (e.key === 'Backspace' && !e.target.value && i > 0) boxes[i - 1].focus();
          if (e.key === 'Enter') submit();
        },
        onpaste: (e) => {
          // لصق الكود كاملًا: نُنظّفه ونوزّعه — الشرطات والمسافات مقبولة
          e.preventDefault();
          const txt = (e.clipboardData.getData('text') || '')
            .replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LEN);
          [...txt].forEach((ch, k) => {
            if (!boxes[k]) return;
            boxes[k].value = ch;
            boxes[k].classList.add('is-filled');
          });
          boxes[Math.min(txt.length, LEN - 1)].focus();
          clearError();
        },
      });
      boxes.push(inp);
      return inp;
    }

    function fail(msg, which) {
      if (which === 'user') userInput.classList.add('is-err');
      else field.classList.add('is-err');
      errBox.replaceChildren(h('div.fb.fb--no', { style: 'margin-top:14px' },
        h('div.fb__h', 'تعذّر تسجيل الدخول'),
        h('div.fb__b', msg)));
    }

    function submit() {
      const err = Store.signIn(userInput.value, boxes.map((b) => b.value).join(''));
      if (err) return fail(err, err.includes('اسم المستخدم') ? 'user' : 'code');
      App.go('home');
    }

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

              h('button.btn.btn--primary.btn--lg.btn--block', {
                style: 'margin-top:18px', onclick: submit,
              }, 'دخول'),
            )),

          h('aside.dash__side',
            h('div.callout.callout--info',
              h('div.callout__t', 'أكواد التجربة'),
              h('div.small', { style: 'line-height:2' },
                h('span.mono', 'FR97K3M'), ' ← الصف التاسع', h('br'),
                h('span.mono', 'F12A4XQ'), ' ← البكالوريا', h('br'),
                h('span.mono', 'FR9USED'), ' ← كود مرتبط بجهاز آخر')),

            h('div.card.card--pad',
              h('div.row', { style: 'margin-bottom:8px' },
                h('span', { style: 'color:var(--warn)' }, icon.warn(20)),
                h('div', { style: 'font-weight:700' }, 'جهاز واحد فقط')),
              h('div.muted.small',
                'يفتح الاشتراك على جهاز واحد. لو غيّرت هاتفك أو أعدت ضبطه، '
                + 'الكود يبقى مرتبطًا بالجهاز القديم.'),
              h('div.small', { style: 'margin-top:12px;font-weight:600' },
                'غيّرت جهازك؟'),
              h('div.muted.small', { style: 'margin-top:2px' },
                'تواصل مع الموزّع الذي اشتريت منه البطاقة ليفكّ الارتباط.')),
          ),
        ),
      ),
    );

    setTimeout(() => userInput.focus(), 60);
    return wrap;
  };
})();
