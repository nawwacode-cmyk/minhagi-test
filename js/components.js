/* =============================================================================
   components.js — المكوّنات المشتركة
   ============================================================================= */
window.C = (function () {
  const { h, fr, ar, icon, ring, bar } = UI;

  // --- الترويسة --------------------------------------------------------------
  function appbar({ title, sub, onBack, right }) {
    // زر الرجوع يُخفى بـ CSS على الحاسوب — الشريط الجانبي يقوم بالتنقّل هناك
    return h('header.appbar',
      onBack && h('button.iconbtn.iconbtn--ghost.appbar__back',
        { onclick: onBack, 'aria-label': 'رجوع' }, icon.back(22)),
      h('div.appbar__title', title, sub && h('div.appbar__sub', { text: sub })),
      right,
    );
  }

  /* ---------------------------------------------------------------------------
     ترويسة الشاشات الرئيسية — على نمط المرجع البصري المعتمد:
     سطر تحية صغير باهت، تحته الاسم كبيرًا، ويقابله زرّان دائريان.

     دالّة واحدة تخدم «الرئيسية» و«موادّي»: كانتا نسختين متطابقتين بالنصّ،
     فأي تعديل على إحداهما كان يترك الأخرى خلفه بلا أن يلاحظ أحد.

     التحية **قبل** الأزرار في الترتيب: في RTL يذهب أوّل عنصر إلى اليمين،
     فتقع التحية يمينًا والأزرار يسارًا.

     والاسم بجانب التحية لا تحته: سطران قصيران يأكلان ارتفاعًا في شاشة ضيّقة،
     وسطرٌ واحد بتباينِ وزنٍ ولون يقرأ أسرع. المحاذاة على خطّ الأساس
     (baseline) لا على المنتصف — بحجمين مختلفين يجعل التوسيطُ الأصغرَ يطفو.

     زرّ الإشعارات لا يقود إلى شاشة فارغة: `notices()` تشتقّ ما يستحقّ الانتباه
     من حالة التطبيق نفسها، والنقطة الحمراء لا تظهر إلّا حين يوجد شيء فعلًا —
     شارةٌ دائمة لا يزيلها شيء تفقد معناها بعد يومين.
  --------------------------------------------------------------------------- */
  function homeHeader(kicker, title, sub) {
    const list = notices();
    return h('div.pgreet',
      h('div.hgreet',
        kicker ? h('span.hgreet__k', kicker) : null,
        h('span.hgreet__n', title),
        sub ? h('span.hgreet__s', sub) : null),
      /* الترتيب هنا يقرّر المواضع: الصفحة RTL، فأوّل عنصرٍ في الـDOM هو
         **الأيمن**. الإشعارات أوّلًا (يمينًا) والقائمة ثانيًا (يسارًا).

         وزرّ الإعدادات صار ثلاثة خطوط: الترس يُقرأ «ضبط تقني»، والقائمة
         تحمل الحساب والاشتراك والمظهر والخروج — وهي أشياء يبحث عنها الطالب
         تحت «القائمة» لا تحت «الإعدادات». */
      h('div.hacts',
        h('button.hbtn', { onclick: () => showNotices(list), 'aria-label': 'الإشعارات' },
          icon.bell(19),
          list.length ? h('span.hbtn__dot') : null),
        h('button.hbtn', { onclick: () => Account.openMenu(), 'aria-label': 'القائمة' },
          icon.menu(20))));
  }

  /* ---------------------------------------------------------------------------
     بطاقة «أكمل من حيث توقفت» — أهمّ بطاقة في الشاشة: تختصر قرار «شو أعمل
     الآن» إلى نقرة. لذلك لوحٌ مصمت لا بطاقة سطحية، ومعها **نسبة ما قطعه
     الطالب في الدرس نفسه** لا عنوانه وحده.

     دالّة واحدة تخدم «موادّي» وشاشة المادة: كانتا بطاقتين مختلفتي الشكل لنفس
     المعنى، فيقرأ الطالب فكرةً واحدة بلغتين.
  --------------------------------------------------------------------------- */
  function continueCard({ eyebrow, title, meta, pct, label, onclick }) {
    return h('div.cont',
      h('div.cont__h',
        h('span.cont__ico', icon.play(20)),
        h('div', { style: 'min-width:0' },
          h('div.cont__k', eyebrow),
          h('div.cont__t', title))),
      meta ? h('div.cont__m', meta) : null,
      // الشريط يظهر فقط إن كان هناك تقدّمٌ فعلي — شريطٌ فارغ يقول «صفر» بصريًا
      pct > 0 ? h('div.cont__bar', h('i', { style: `width:${pct}%` })) : null,
      h('button.cont__btn', { onclick }, icon.play(16), label));
  }

  /**
   * ما يستحقّ انتباه الطالب — مشتقٌّ من الحالة القائمة لا من جدول إشعارات.
   * لا نُنشئ منظومة إشعارات لأجل زرّ؛ ونُبقيه صادقًا: إن لم يكن ثمّة شيء
   * فلا نقطة حمراء ولا قائمة مُختلَقة.
   */
  function notices() {
    const s = Store.get();
    const out = [];
    if (s.storageFull) {
      out.push({ ico: icon.warn, t: 'مساحة التخزين ممتلئة',
                 d: 'المحتوى الجديد لا يُحفظ. أفرِغ مساحة ثم أعد فتح التطبيق.' });
    }
    if (s.activated && s.daysLeft > 0 && s.daysLeft <= 14) {
      out.push({ ico: icon.exam, t: `اشتراكك ينتهي بعد ${ar(s.daysLeft)} يومًا`,
                 d: 'جدّده بكود جديد كي لا ينقطع وصولك للدروس.' });
    }
    if (!s.online) {
      out.push({ ico: icon.wifiOff, t: 'تعمل دون إنترنت',
                 d: 'دروسك المحفوظة تعمل، والجديد يصل عند عودة الاتصال.' });
    }
    const queued = Store.pending();
    if (queued > 0 && s.online) {
      out.push({ ico: icon.sync, t: `${ar(queued)} نشاطًا قيد المزامنة`,
                 d: 'تقدّمك محفوظ على جهازك ويُرسل تلقائيًا.' });
    }
    return out;
  }

  /** لوحة الإشعارات — تنزلق من الأسفل وتُغلق بالنقر خارجها. */
  function showNotices(list) {
    const sheet = h('div.sheet',
      h('div.sheet__grab'),
      h('div.sheet__t', 'الإشعارات'),
      list.length
        ? h('div', ...list.map((n) => h('div.notice',
            h('span.notice__i', n.ico(18)),
            h('div', h('b', n.t), h('span', n.d)))))
        : h('div.notice.notice--calm',
            h('span.notice__i', icon.check(18)),
            h('div', h('b', 'لا جديد'), h('span', 'كل شيء على ما يُرام.'))));

    const back = h('div.scrim', { onclick: () => back.remove() }, sheet);
    sheet.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(back);
  }

  /** تحية بحسب ساعة الجهاز — كما في المرجع («Good morning»). */
  function greeting() {
    const hr = new Date().getHours();
    if (hr < 12) return 'صباح الخير،';
    if (hr < 18) return 'مساء الخير،';
    return 'مساء الخير،';
  }

  // --- لافتة حالة الاتصال ------------------------------------------------------
  // وضع الأوفلاين هو الحالة الطبيعية المتوقّعة هنا لا الاستثناء، فاللافتة
  // معلوماتية تطمئن ولا تحذّر.
  function syncBanner() {
    const s = Store.get();
    const queued = Store.pending();

    /* امتلاء المساحة يسبق «بلا إنترنت»: الطالب المتّصل الذي لا يصله محتوى
       جديد يظنّ العطل في الخدمة، والسبب على جهازه. ولا يزول إلّا بفعلٍ منه. */
    if (s.storageFull) {
      return h('div.banner.banner--warn', icon.warn(20),
        h('div', h('b', 'مساحة التخزين ممتلئة'),
          h('span', 'المحتوى الجديد لا يُحفظ. أفرِغ مساحة على جهازك أو '
                  + 'احذف تنزيلات لم تعد تحتاجها، ثم أعد فتح التطبيق.')));
    }
    if (!s.online) {
      return h('div.banner.banner--off', icon.wifiOff(20),
        h('div', h('b', 'تعمل دون إنترنت'),
          h('span', queued
            ? `${ar(queued)} نشاطًا محفوظًا سيُرسل عند عودة الاتصال.`
            : 'كل تقدّمك محفوظ على جهازك.')));
    }
    if (queued > 0) {
      return h('div.banner.banner--sync', icon.sync(20),
        h('div', h('b', `جارٍ مزامنة ${ar(queued)} نشاطًا…`),
          h('span', 'تقدر تتابع الدراسة أثناء ذلك.')));
    }
    return null;
  }

  /* ---------------------------------------------------------------------------
     خطوة على مسار مادة واحدة (`Store.subjectPath`) — نفس مفردات
     done/now/todo الموجودة أصلًا بصفوف الدروس، بشكل عمودي متّصل بدل صفّ
     أفقي داخل أكورديون. بلا قفل: كل خطوة قابلة للضغط بصرف النظر عن حالتها.
  --------------------------------------------------------------------------- */
  function pathNode({ type, title, meta, state, onclick }) {
    const dot = type === 'examCta' ? icon.exam(state === 'now' ? 17 : 14)
      : state === 'done' ? icon.check(15)
      : state === 'now' ? icon.play(14)
      : null;

    return h('div.node.node--' + state + (type === 'examCta' ? '.node--exam' : ''),
      { onclick },
      h('div.node__rail', h('div.node__dot', dot), h('div.node__line')),
      h('div.node__body',
        h('div.node__t', title),
        meta ? h('div.node__m', meta) : null,
        state === 'now' ? h('div.node__go', icon.fwd(13),
          type === 'examCta' ? 'جرّب الامتحان' : 'تابع') : null));
  }

  // --- حالة فارغة --------------------------------------------------------------
  function empty({ img, title, text, action }) {
    return h('div.empty',
      img && h('img', { src: img, alt: '', style: 'opacity:.55;color:var(--txf)' }),
      h('div.empty__t', title),
      h('div.empty__s', text),
      action,
    );
  }

  // ===========================================================================
  // بطاقة السؤال — تدير حالتها بنفسها وتعيد بناء محتواها عند التغيير.
  //
  // ملاحظة تصميمية: كل أنواع الإدخال هنا **أزرار**، لا حقول نصية. لذلك إعادة
  // البناء الكامل آمنة ولا تفقد تركيز مؤشر ولا نصًّا كتبه الطالب — وهو الفخ
  // الأول في هذا النوع من الشاشات.
  // ===========================================================================
  function questionCard(q, {
    index, total, onNext, hideFeedback = false,
    // التخطّي والرجوع اختياريان: لو لم تمرّرهما الشاشة لا يظهر الزرّ ولا يعمل
    // السحب. onState تُبلّغ الشاشة بحالة البطاقة لتعيدها كما هي عند الرجوع.
    onSkip, onPrev, onState, initial,
  }) {
    const card = h('div.card.q');
    let sel = q.type === 'multi' ? [] : null;   // mcq: code · multi: [codes] · blank: [..] · order: [..]
    let checked = false;

    if (q.type === 'blank') sel = q.blanks.map(() => null);
    if (q.type === 'order') sel = [];

    /* الرجوع إلى سؤال مُجاب يعيده بحالته لا فارغًا. بلا هذا يعيد الطالب حلّه
       فتُسجَّل محاولة ثانية لنفس السؤال في نفس الجلسة، فينتفخ عدّاد المحاولات
       على الخادم ويصير مؤشّر الإتقان مبنيًّا على تكرار لا على تعلّم. */
    if (initial) {
      if (initial.sel !== undefined)
        sel = Array.isArray(initial.sel) ? initial.sel.slice() : initial.sel;
      checked = !!initial.checked;
    }
    const publish = () => onState?.({ sel: Array.isArray(sel) ? sel.slice() : sel, checked });

    const isCorrect = () => {
      if (q.type === 'mcq')   return q.options.find((o) => o.correct)?.k === sel;
      if (q.type === 'multi') {
        const right = q.options.filter((o) => o.correct).map((o) => o.k).sort();
        return sel.length === right.length && sel.slice().sort().every((k, i) => k === right[i]);
      }
      if (q.type === 'blank') return sel.every((v, i) => v && q.blanks[i].accept.includes(v));
      if (q.type === 'order') return sel.length === q.answer.length && sel.every((w, i) => w === q.answer[i]);
      return false;
    };

    const ready = () => {
      if (q.type === 'multi') return sel.length > 0;
      if (q.type === 'blank') return sel.every(Boolean);
      if (q.type === 'order') return sel.length === q.answer.length;
      return sel !== null;
    };

    function render() {
      publish();          // كل تغيير في الاختيار يُبلَّغ، فالرجوع يجد آخر حالة
      const right = isCorrect();
      const kids = [];

      // الترويسة والتقدّم
      kids.push(h('div.q__top',
        h('span.badge.badge--acc', 'تمرين'),
        h('span', `${ar(index + 1)} من ${ar(total)}`)));
      kids.push(h('div', { style: 'margin-bottom:14px' }, bar(((index) / total) * 100, 'bar--thin')));

      /* نصّ القراءة يسبق السؤال ويُعاد عرضه مع **كل** سؤال يعتمد عليه.
         في ورقة الفحص يظهر النصّ مرة واحدة أعلى الصفحة لأن الأسئلة كلها
         أمام الطالب، أما هنا فالسؤال يُعرض وحده — فسؤال يقول «حسب النص
         أعلاه» بلا نصّ لا يمكن حلّه أصلًا. لذلك يحمل كل سؤال نصّه معه. */
      if (q.passage) {
        kids.push(h('details.q__passage', { open: index === 0 },
          h('summary', 'النصّ — اضغط للطيّ أو الفتح'),
          UI.rich(q.passage, 'div')));
      }

      kids.push(UI.rich(q.stem, 'div.q__stem'));

      // ---- الأنواع ----
      if (q.type === 'mcq' || q.type === 'multi') {
        for (const o of q.options) {
          const picked = q.type === 'multi' ? sel.includes(o.k) : sel === o.k;
          let cls = '', mark = o.k;
          if (!checked || hideFeedback) { if (picked) cls = 'is-sel'; }
          else if (o.correct)   { cls = 'is-right'; mark = '✓'; }
          else if (picked)      { cls = 'is-wrong'; mark = '✕'; }
          else                  { cls = 'is-muted'; }

          kids.push(h('button.opt' + (cls ? '.' + cls : '') + (checked ? '.is-locked' : ''), {
            onclick: () => {
              if (checked) return;
              if (q.type === 'multi') {
                sel = picked ? sel.filter((k) => k !== o.k) : [...sel, o.k];
              } else sel = o.k;
              render();
            },
          }, h('span.opt__k', mark), UI.rich(o.t, 'span')));
        }

      } else if (q.type === 'blank') {
        const line = h('div.blankline');
        q.parts.forEach((p) => {
          if (typeof p === 'string') { line.appendChild(document.createTextNode(p)); return; }
          const v = sel[p.blank];
          let cls = 'blank';
          if (!v) cls += ' is-empty';
          else if (checked) cls += q.blanks[p.blank].accept.includes(v) ? ' is-right' : ' is-wrong';
          line.appendChild(h('span.' + cls.split(' ').join('.'), { text: v || '···' }));
        });
        kids.push(line);

        if (!checked) {
          // نختار الفراغ الأول غير المملوء تلقائيًا — يقلّل نقرة لكل فراغ
          const target = sel.findIndex((v) => !v);
          const idx = target === -1 ? sel.length - 1 : target;
          const chips = h('div.row', { style: 'flex-wrap:wrap;direction:ltr;gap:8px' });
          q.blanks[idx].choices.forEach((c) => chips.appendChild(
            h('button.chip', { onclick: () => { sel[idx] = c; render(); } }, c)));
          kids.push(h('div',
            h('div.hint', { style: 'text-align:start;margin-bottom:8px' },
              `اختر كلمة الفراغ ${ar(idx + 1)}`),
            chips));
        }

      } else if (q.type === 'order') {
        const slot = h('div.row', {
          style: 'flex-wrap:wrap;gap:8px;direction:ltr;min-height:52px;padding:8px;'
               + 'border:1.5px dashed var(--brd2);border-radius:12px;margin-bottom:12px',
        });
        sel.forEach((w, i) => slot.appendChild(h('button.chip.is-on', {
          onclick: () => { if (checked) return; sel.splice(i, 1); render(); },
        }, w)));
        if (!sel.length) slot.appendChild(h('span.faint.small', { style: 'align-self:center' }, 'اضغط الكلمات بالترتيب'));
        kids.push(slot);

        const pool = h('div.row', { style: 'flex-wrap:wrap;gap:8px;direction:ltr' });
        q.answer.forEach((w) => {
          const used = sel.filter((x) => x === w).length >= q.answer.filter((x) => x === w).length;
          if (used) return;
          pool.appendChild(h('button.chip', {
            onclick: () => { if (checked) return; sel.push(w); render(); },
          }, w));
        });
        if (!checked) kids.push(pool);
      }

      // ---- التغذية الراجعة: تظهر عند الصواب وعند الخطأ معًا ----
      // في وضع الامتحان تُخفى وتُؤجَّل لورقة النتيجة — إظهار الإجابة أثناء
      // الامتحان يُفسد الغرض منه.
      if (checked && !hideFeedback) {
        kids.push(h('div.fb.' + (right ? 'fb--ok' : 'fb--no'),
          h('div.fb__h', right ? '✓ إجابة صحيحة' : '✕ إجابة غير صحيحة'),
          h('div.fb__b', explain(q, right))));
      }

      kids.push(h('button.btn.btn--primary.btn--block', {
        style: 'margin-top:14px',
        disabled: !checked && !ready(),
        onclick: () => {
          if (!checked) {
            checked = true;
            Store.recordAttempt(isCorrect(), q.id,
                                hideFeedback ? 'exam' : 'practice');
            publish();
            // في الامتحان لا توجد مرحلة «مراجعة الشرح»، فننتقل مباشرةً
            if (hideFeedback) { onNext(isCorrect()); return; }
            render();
          } else onNext(isCorrect());
        },
      }, checked && !hideFeedback
           ? (index + 1 === total ? 'إنهاء' : 'السؤال التالي')
           : (hideFeedback ? (index + 1 === total ? 'إنهاء وتسليم' : 'التالي') : 'تحقّق')));

      /* التخطّي: يترك السؤال بلا إجابة ويمضي — لا يُحسب خطأً ولا يُسجَّل
         محاولةً. يظهر قبل التحقّق فقط؛ بعده صار للسؤال جواب والزرّ الأساسي
         هو «السؤال التالي» أصلًا، فزرّ تخطٍّ إلى جانبه معناه ملتبس. */
      if (onSkip && !checked) {
        kids.push(h('button.btn.btn--ghost.btn--block.q__skip',
          { style: 'margin-top:6px', onclick: () => onSkip() },
          index + 1 === total ? 'تخطّي وإنهاء' : 'تخطّي هذا السؤال'));
      }

      // التلميح على السؤال الأول وحده: إيماءة خفيّة تحتاج تعريفًا مرّة، وتكراره
      // على كل سؤال ضجيج يزاحم النصّ الذي جاء الطالب ليقرأه.
      if ((onPrev || onSkip) && index === 0)
        kids.push(h('div.q__swipe-hint', 'أو اسحب البطاقة للتنقّل بين الأسئلة'));

      card.replaceChildren(...kids);
    }

    // السحب يفعل ما تفعله الأزرار نفسها لا أكثر: للأمام يتخطّى إن لم يُجب
    // وينتقل إن أجاب، وللخلف يعود. الشاشة التي لا تمرّر onSkip/onPrev لا سحب فيها.
    UI.swipe(card, {
      onNext: onSkip ? () => (checked ? onNext(isCorrect()) : onSkip()) : null,
      onPrev: onPrev ? () => onPrev() : null,
    });

    /** الشرح يُعرض دائمًا — الطالب الذي خمّن صحيحًا يحتاجه بقدر من أخطأ. */
    function explain(q, right) {
      const box = h('span');
      if (!right && q.type === 'blank') {
        box.appendChild(document.createTextNode('الصواب: '));
        box.appendChild(h('b', fr(q.blanks.map((b) => b.accept[0]).join(' … '))));
        box.appendChild(document.createTextNode(' — '));
      }
      if (!right && q.type === 'order') {
        box.appendChild(document.createTextNode('الصواب: '));
        box.appendChild(h('b', fr(q.answer.join(' '))));
        box.appendChild(document.createTextNode(' — '));
      }
      /* كان `createTextNode` — نصًّا خامًا بلا عزل ولا ماركداون. وهو أسوأ
         موضع في التطبيق لذلك: الشرح هو ما يقرؤه الطالب **بعد أن يخطئ**،
         وفيه أكثر خلطٍ للغتين (المفردة الفرنسية ومعناها والمصدر). كانت
         علامات `**` تظهر حرفيًّا والمفردة تقفز لطرفٍ آخر. */
      box.appendChild(UI.rich(q.why, 'span'));
      return box;
    }

    render();
    return card;
  }

  return { appbar, homeHeader, greeting, continueCard, syncBanner, empty, questionCard, pathNode };
})();
