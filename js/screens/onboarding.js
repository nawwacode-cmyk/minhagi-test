/* =============================================================================
   تسجيل الدخول — الشاشة الأولى للتطبيق

   لا شاشة ترحيب قبلها: كانت تعرض أربع نقاط تسويقية ثم زرًّا يقود إلى هنا،
   أي حاجزًا كاملًا بين الطالب وبين الدخول بكوده. صار نموذج الدخول نفسه هو
   الواجهة الأولى، وانتقلت العلامة إلى رأسه.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, svg } = UI;

  // ===========================================================================
  // تسجيل الدخول — اسم مستخدم + كود تفعيل، لا شيء غيرهما
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

    // هاي الشاشة الجذر — لا زر رجوع، ما في مكان ترجع له.
    const wrap = h('div.screen',
      h('div.screen__body',
        h('div.auth-brand',
          h('img', { src: 'assets/img/icon-192.png', alt: '', width: 44, height: 44 }),
          h('div',
            h('div.auth-brand__name', 'منهاجي'),
            h('div.auth-brand__tag', 'منهاجك السوري بين يديك'))),

        h('div.dash', { style: 'padding-top:0' },
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

              // وضع التجربة: رابط هادئ لا زر بارز — هو مسار ثانوي، والمسار
              // الأساسي هو الدخول بكود مدفوع فوقه.
              h('button.btn.btn--ghost.btn--block', {
                style: 'margin-top:6px',
                onclick: () => { Store.set({ signedIn: true, username: 'زائر' }); App.go('home'); },
              }, 'جرّب التطبيق قبل الاشتراك'),

              h('div.center.faint', { style: 'font-size:11.5px;margin-top:10px' },
                'الإصدار ١٫٠٫٠'),
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
