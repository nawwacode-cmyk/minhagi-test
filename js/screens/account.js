/* =============================================================================
   account.js — «القائمة»: لوحة واحدة تُعرض بمكانين

   تُفتح من زرّ القائمة في الرئيسية كدرجٍ ينزلق، وتُفتح كشاشةٍ كاملة عبر
   المسار `account` (يقصدها تنبيه الاشتراك مثلًا). والمحتوى **واحد** لا
   نسختان: نسختان تنحرفان عند أوّل تعديل يُنسى في إحداهما، وقد وقع ذلك في
   هذا المستودع أكثر من مرّة.

   ولا صورة حساب: الحساب اسمُ مستخدمٍ وكود، ولا نطلب من الطالب صورةً ولا
   نخزّنها. الأفاتار حرفُ اسمه — وهو ما يميّزه بلا أن يرفع شيئًا.
   ============================================================================= */
window.Screens = window.Screens || {};
window.Account = (function () {
  const { h, ar, icon } = UI;

  const gradeNameOf = (code) =>
    (code && (SEED.grades || []).find((g) => g.id === code)?.name) || '';

  /** صفٌّ قابل للنقر بسهمٍ في طرفه — عمود القائمة. */
  const row = (ico, label, onclick, right) =>
    h(onclick ? 'button.row2' : 'div.row2.row2--static', onclick ? { onclick } : {},
      h('span.row2__i', ico(20)),
      h('span.row2__l', label),
      right || (onclick ? h('span.row2__c', icon.fwd(17)) : null));

  /* مفتاح المظهر: **نفس مفتاح اللوحة** (شمس · مفتاح · قمر) لا مبدَّلٌ خاصّ.
     كان مبدَّلًا مقسومًا بإبهامٍ متدرّج، فبدا ضبابيًّا على الشاشة — تدرّجٌ
     تحت أيقونةٍ بيضاء صغيرة داخل قرصٍ ٢٩ بكسلًا. والمفتاح القائم في التطبيق
     مُجرَّبٌ ومطابقٌ للوحة، فلا سبب لاختراع ثانٍ. */
  function themeToggle(onChange) {
    const dark = Store.get().theme === 'dark';
    const set = (d) => { Store.setTheme(d ? 'dark' : 'light'); onChange(); };
    return h('div.theme-toggle',
      h('span.theme-ic' + (dark ? '' : '.is-on'), { onclick: () => set(false) }, icon.sun(16)),
      h('button.switch' + (dark ? '.is-on' : ''), {
        'aria-label': 'تبديل الوضع الليلي', onclick: () => set(!dark),
      }, h('i')),
      h('span.theme-ic' + (dark ? '.is-on' : ''), { onclick: () => set(true) }, icon.moon(16)));
  }

  /**
   * محتوى «حسابي». `onClose` يُمرَّر من الدرج ليغلق نفسه بعد أي تنقّل —
   * وبدونه يبقى الدرج مفتوحًا فوق الشاشة الجديدة.
   */
  function panel({ onClose } = {}) {
    const box = h('div.acct');
    const close = () => onClose?.();

    function draw() {
      const s = Store.get();
      const dl = s.downloaded.map((id) => SEED.lessons[id]).filter(Boolean);
      const subs = (SEED.subjects || []).filter((x) => x.entitled);
      const name = s.username || 'زائر';

      /* **يُرشَّح قبل التمرير.** `replaceChildren` الأصلية تحوّل `null` إلى
         **عقدة نصّية** فتظهر كلمة "null" في الواجهة — بخلاف `UI.h` التي
         تُسقط الزائف. وقد ظهرت فعلًا أسفل القائمة. */
      const kids = [
        C.syncBanner() || h('span'),

        // --- بطاقة الحساب ---
        h('div.card.acct__top',
          h('div.ava', h('span.ava__i', name.trim()[0] || '؟')),
          h('div.acct__n', name),
          h('div.acct__s', subs.length
            ? subs.map((x) => x.name).join(' · ')
            : (s.activated ? 'اشتراك فعّال' : 'وضع التجربة')),
          h('div.acct__m',
            s.activated && s.daysLeft > 0
              ? h('span.acct__m--gold', icon.clock(13), `متبقٍ ${ar(s.daysLeft)} يومًا`)
              : h('span', icon.clock(13), 'غير مفعّل'),
            gradeNameOf(s.grade) ? h('i.acct__dot') : null,
            gradeNameOf(s.grade) ? h('span', icon.cap(13), gradeNameOf(s.grade)) : null),

          !s.activated
            ? h('button.btn.btn--primary.btn--sm', { style: 'margin-top:14px',
                onclick: () => { close(); App.go('auth'); } }, 'دخول بكود التفعيل')
            : null),

        // --- المظهر والتنزيلات ---
        h('div.card.acct__g',
          row(icon.theme, 'مظهر التطبيق', null, themeToggle(draw)),
          row(icon.wifiOff, 'محاكاة انقطاع الإنترنت', null,
            h('button.switch' + (!s.online ? '.is-on' : ''), {
              'aria-label': 'وضع أوفلاين',
              onclick: () => { Store.toggleOnline(); App.drawRail(); draw(); },
            }, h('i'))),
          /* التنزيلات شاشةٌ مستقلّة لا قائمةٌ تنسدل داخل الدرج: قد تطول إلى
             عشرات الدروس، ولكلٍّ منها زرّ حذف — قائمةٌ كهذه داخل درجٍ ضيّق
             تدفن ما تحتها وتُصعّب الوصول إليه. */
          row(icon.down, 'التنزيلات', () => { close(); App.go('downloads'); },
            h('span.row2__n', ar(dl.length)))),

        /* --- صفحات تعريفية: محتواها لم يُكتب بعد ---
           تُعرض ساكنةً بعلامة «قريبًا» لا كأزرارٍ تُنقر فلا تفعل شيئًا. زرٌّ
           ميّت يقرؤه الطالب عطلًا في التطبيق لا محتوًى ناقصًا. */
        h('div.card.acct__g',
          ...['من نحن', 'تواصل معنا', 'سياسة الخصوصية'].map((t, i) =>
            row([icon.about, icon.chat, icon.shield][i], t, null,
              h('span.row2__soon', 'قريبًا')))),

        // --- الجلسة ---
        h('div.card.acct__g',
          row(icon.phone, 'جلستي الحالية', null,
            h('span.row2__v', s.activated ? Device.label() : 'وضع التجربة')),
          s.activated
            ? row(icon.logout, 'تسجيل الخروج', () => {
                if (!confirm('سيُغلق التطبيق حسابك على هذا الجهاز.\n\n'
                  + 'تستطيع الدخول متى شئت باسمك وكودك. متابعة؟')) return;
                Api.signOut();
                Sync.clearContent();
                Store.set({ signedIn: false, evicted: false });
                close();
                App.go('auth');
              })
            : null,
          h('div.hint', { style: 'padding:0 16px 14px' },
            'اشتراكك يعمل على أي جهاز، لكن على جهاز واحد في الوقت نفسه. '
            + 'إن دخلت من جهاز آخر يُغلق هذا تلقائيًا.')),

        // إعادة الضبط لمن هو في التجربة وحده — لا معنى لها لمشترِكٍ دفع
        !s.activated
          ? h('button.btn.btn--ghost.btn--block', { style: 'color:var(--err);margin-top:14px',
              onclick: () => {
                if (!confirm('سيُمسح تقدّمك في هذه التجربة. متابعة؟')) return;
                Store.reset(); close(); App.go('auth');
              } }, 'إعادة ضبط التجربة')
          : null,
      ];
      box.replaceChildren(...kids.filter(Boolean));
    }

    draw();
    return box;
  }

  /**
   * الدرج المنزلق.
   *
   * زرّ رجوع الهاتف يغلقه — وإلّا خرج الطالب من الشاشة كلّها وهو يظنّ أنه
   * يغلق القائمة. وهو نفس ما فعلناه في عارض الملفّات: أي طبقةٍ تغطّي الشاشة
   * يجب أن تلتقط الرجوع.
   */
  function openMenu() {
    if (document.querySelector('.drawer')) return;      // نقرتان سريعتان ⇒ درجان

    const close = () => {
      layer.classList.remove('is-open');
      removeEventListener('popstate', onPop);
      document.documentElement.style.overflow = prevOverflow;
      setTimeout(() => layer.remove(), 260);            // بعد انتهاء الانزلاق
    };
    const onPop = () => close();

    const layer = h('div.drawer',
      h('div.drawer__scrim', { onclick: close }),
      h('div.drawer__panel',
        h('div.drawer__h',
          h('button.iconbtn.iconbtn--ghost', { onclick: close, 'aria-label': 'إغلاق' },
            icon.close(20)),
          h('span.drawer__t', 'القائمة')),
        h('div.drawer__b', panel({ onClose: close }))));

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(layer);
    // إطارٌ واحد قبل إضافة الصنف: بدونه يقفز الدرج إلى مكانه بلا انزلاق
    requestAnimationFrame(() => layer.classList.add('is-open'));

    try { history.pushState({ drawer: true }, ''); } catch { /* بيئة بلا history */ }
    addEventListener('popstate', onPop);
  }

  // الشاشة الكاملة — نفس اللوحة، بترويسة الشاشات المعتادة
  Screens.account = () => h('div.screen',
    C.appbar({ title: 'القائمة', onBack: () => App.back() }),
    h('div.screen__body', { style: 'padding:14px 16px 24px' }, panel()));

  /* --- التنزيلات: شاشة مستقلّة -------------------------------------------
     كانت قائمةً تنسدل داخل الدرج. وقائمةٌ قد تطول إلى عشرات الدروس، ولكلٍّ
     زرّ حذف، تدفن ما تحتها في درجٍ ضيّق. */
  Screens.downloads = () => {
    const wrap = h('div.screen');
    const body = h('div.screen__body', { style: 'padding:14px 16px 24px' });

    function draw() {
      const dl = Store.get().downloaded.map((id) => SEED.lessons[id]).filter(Boolean);
      body.replaceChildren(...[
        dl.length
          ? h('div.card.acct__g',
              ...dl.map((l) => h('div.row2.row2--static',
                h('span.row2__i', icon.down(20)),
                h('span.row2__l', l.title),
                h('button.btn.btn--ghost.btn--sm', {
                  style: 'color:var(--err)',
                  onclick: () => { Store.toggleDownload(l.id); draw(); },
                }, 'حذف'))))
          : C.empty({
              img: 'assets/img/empty-download.svg',
              title: 'لا توجد دروس منزَّلة',
              text: 'نزّل الدروس التي تريدها مرة واحدة، ثم ادرسها دون إنترنت في أي وقت.',
              action: (() => {
                const first = (SEED.subjects || []).find((x) => x.entitled);
                return first && h('button.btn.btn--primary', {
                  onclick: () => App.go('course', { subject: first.id }),
                }, 'تصفّح الدروس');
              })(),
            }),
      ].filter(Boolean));
    }

    draw();
    wrap.append(C.appbar({ title: 'التنزيلات', onBack: () => App.back() }), body);
    return wrap;
  };

  return { panel, openMenu };
})();
