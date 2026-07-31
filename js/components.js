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

  // --- لافتة حالة الاتصال ------------------------------------------------------
  // وضع الأوفلاين هو الحالة الطبيعية المتوقّعة هنا لا الاستثناء، فاللافتة
  // معلوماتية تطمئن ولا تحذّر.
  function syncBanner() {
    const s = Store.get();
    const queued = Store.pending();

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

  // --- صف إتقان موضوع ---------------------------------------------------------
  function masteryRow(topic, m) {
    const v = m ? m.mastery : null;
    const color = v === null ? 'var(--brd2)'
      : v >= 70 ? 'var(--ok)' : v >= 45 ? 'var(--warn)' : 'var(--err)';
    return h('div.mastery',
      h('div.mastery__n', topic.name),
      h('div.mastery__bar', h('i', { style: `width:${v ?? 0}%;background:${color}` })),
      h('div.mastery__p', { text: v === null ? '—' : ar(v) }),
    );
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
  function questionCard(q, { index, total, onNext, hideFeedback = false }) {
    const card = h('div.card.q');
    let sel = q.type === 'multi' ? [] : null;   // mcq: code · multi: [codes] · blank: [..] · order: [..]
    let checked = false;

    if (q.type === 'blank') sel = q.blanks.map(() => null);
    if (q.type === 'order') sel = [];

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
      const right = isCorrect();
      const kids = [];

      // الترويسة والتقدّم
      const topic = SEED.topics.find((t) => t.id === q.topic);
      kids.push(h('div.q__top',
        h('span.badge.badge--acc', topic ? topic.name : 'تمرين'),
        h('span', `${ar(index + 1)} من ${ar(total)}`)));
      kids.push(h('div', { style: 'margin-bottom:14px' }, bar(((index) / total) * 100, 'bar--thin')));

      kids.push(h('div.q__stem', q.stem));

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
          }, h('span.opt__k', mark), o.fr ? fr(o.t) : o.t));
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
            Store.recordAttempt(q.topic, isCorrect(), q.id,
                                hideFeedback ? 'exam' : 'practice');
            // في الامتحان لا توجد مرحلة «مراجعة الشرح»، فننتقل مباشرةً
            if (hideFeedback) { onNext(isCorrect()); return; }
            render();
          } else onNext(isCorrect());
        },
      }, checked && !hideFeedback
           ? (index + 1 === total ? 'إنهاء' : 'السؤال التالي')
           : (hideFeedback ? (index + 1 === total ? 'إنهاء وتسليم' : 'التالي') : 'تحقّق')));

      card.replaceChildren(...kids);
    }

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
      box.appendChild(document.createTextNode(q.why));
      return box;
    }

    render();
    return card;
  }

  return { appbar, syncBanner, masteryRow, empty, questionCard };
})();
