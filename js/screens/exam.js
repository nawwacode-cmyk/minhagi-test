/* =============================================================================
   الامتحان التجريبي · ورقة النتيجة
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, fr, ar, icon, bar } = UI;

  // ===========================================================================
  // ١٠. الامتحان
  //
  // المؤقّت يعتمد على طابع زمني للنهاية مخزَّن عند البدء، لا على عدّاد تنازلي.
  // الفرق مهم: العدّاد يتوقف إذا جُمّد التبويب أو أُغلقت الشاشة، أما الطابع
  // الزمني فيعطي الوقت الصحيح دائمًا عند العودة.
  // ===========================================================================
  Screens.exam = (params) => {
    const exam = SEED.exams.find((e) => e.id === params.id);
    if (!exam) return Screens.home();

    const qs = exam.questions.map((id) => SEED.questions[id]).filter(Boolean);
    const answers = {};            // index → { correct }
    let current = 0;
    const endsAt = Date.now() + exam.minutes * 60_000;
    let timerId;

    const wrap = h('div.screen');
    const timerEl = h('span.timer');
    const metaEl = h('div.faint', { style: 'font-size:12px' });
    const navBox = h('div.qnav');
    const qBox = h('div');

    function tick() {
      // إن غادر الطالب الشاشة (زر الرجوع في الهاتف مثلًا) فالعقدة لم تعد في
      // الصفحة — نوقف المؤقّت، وإلا استمرّ وسلّم امتحانًا وهو في شاشة أخرى.
      if (!wrap.isConnected) { clearInterval(timerId); return; }

      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      timerEl.textContent = `${mm}:${ss}`;
      timerEl.className = 'timer' + (left <= 60 ? ' is-crit' : left <= 300 ? ' is-warn' : '');
      if (left === 0) { clearInterval(timerId); submit(true); }
    }

    function drawNav() {
      const answered = Object.keys(answers).length;
      metaEl.textContent =
        `${ar(answered)} من ${ar(qs.length)} · ${ar(qs.length - answered)} بلا إجابة`;
      navBox.replaceChildren(...qs.map((_, n) => h('button', {
        class: (answers[n] ? 'is-answered ' : '') + (current === n ? 'is-current' : ''),
        onclick: () => { current = n; drawQ(); },
      }, ar(n + 1))));
    }

    function drawQ() {
      drawNav();
      // في الامتحان لا تظهر التغذية الراجعة أثناء الحل — تُؤجَّل لورقة النتيجة.
      qBox.replaceChildren(C.questionCard(qs[current], {
        index: current, total: qs.length, hideFeedback: true,
        onNext: (ok) => {
          answers[current] = { correct: ok };
          if (current < qs.length - 1) { current++; drawQ(); }
          else { drawNav(); submit(false); }
        },
      }));
      qBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function submit(auto) {
      clearInterval(timerId);
      const got = Object.values(answers).filter((a) => a.correct).length;
      const pct = Math.round((got / qs.length) * 100);
      Store.recordExam(exam.id, pct);
      App.go('result', { id: exam.id, pct, got, total: qs.length, auto }, true);
    }

    wrap.append(
      C.appbar({ title: exam.title, sub: exam.kind === 'ministry' ? 'دورة وزارية' : 'امتحان تجريبي',
                 onBack: () => { clearInterval(timerId); App.back(); } }),
      h('div.screen__body',
        h('div', { style: 'padding:14px 16px 0' },
          h('div.card.card--pad.row',
            timerEl,
            h('div.grow', h('div', { style: 'font-weight:600' }, 'الوقت المتبقي'), metaEl),
            h('button.btn.btn--secondary.btn--sm', { onclick: () => submit(false) }, 'تسليم'))),

        // على الشاشات الواسعة تُصبح شبكة التنقّل عمودًا ثابتًا بجانب السؤال بدل
        // أن تعلوه — فيرى الطالب موضعه من الامتحان وهو يحلّ.
        h('div.exam-grid', { style: 'padding:14px 16px 20px' },
          qBox,
          h('div.exam-side',
            h('div.card.card--pad',
              h('div', { style: 'font-weight:700;margin-bottom:10px' }, 'التنقّل بين الأسئلة'),
              navBox,
              h('div.hint', { style: 'margin-top:10px' }, 'الأزرق: مُجاب · الرمادي: فارغ')))),
      ),
    );

    drawQ();
    tick();
    timerId = setInterval(tick, 1000);
    return wrap;
  };

  // ===========================================================================
  // ١١. ورقة النتيجة
  // ===========================================================================
  Screens.result = (params) => {
    const exam = SEED.exams.find((e) => e.id === params.id);
    const pass = params.pct >= (exam ? exam.pass : 50);

    // تفصيل حسب الموضوع — لا يكفي أن يعرف الطالب أنه رسب، بل أين رسب
    const byTopic = {};
    (exam ? exam.questions : []).forEach((qid) => {
      const q = SEED.questions[qid];
      if (!q) return;
      byTopic[q.topic] = byTopic[q.topic] || { total: 0 };
      byTopic[q.topic].total++;
    });
    const s = Store.get();

    return h('div.screen',
      C.appbar({ title: 'نتيجة الامتحان',
                 onBack: () => App.go('course', { tab: 'exams' }, true) }),
      h('div.screen__body', { style: 'padding:16px' },
        params.auto && h('div.banner.banner--warn', { style: 'margin-bottom:14px' },
          icon.warn(20), h('div', h('b', 'انتهى الوقت'), h('span', 'سُلّم الامتحان تلقائيًا.'))),

        h('div.card.card--pad',
          h('div.score',
            h('div.score__n', { style: `color:${pass ? 'var(--ok)' : 'var(--err)'}` }, ar(params.pct) + '٪'),
            h('div.score__l', `${ar(params.got)} من ${ar(params.total)} إجابة صحيحة`),
            h('div.verdict.' + (pass ? 'verdict--pass' : 'verdict--fail'),
              `${pass ? 'ناجح' : 'لم تجتز'} · حدّ النجاح ${ar(exam ? exam.pass : 50)}٪`)),

          h('div', { style: 'border-top:1px solid var(--brd);margin-top:18px;padding-top:14px' },
            h('div', { style: 'font-weight:700;font-size:14px;margin-bottom:6px' }, 'حسب الموضوع'),
            ...Object.keys(byTopic).map((tid) => {
              const t = SEED.topics.find((x) => x.id === tid);
              return C.masteryRow(t || { name: tid }, s.mastery[tid]);
            }))),

        pass
          ? h('div.card.card--pad.row', { style: 'margin-top:14px;gap:14px' },
              h('span', { style: 'color:var(--gold)' }, icon.trophy(30)),
              h('div.grow.small', 'نتيجة جيدة. راجع المواضيع التي دون ٧٠٪ لترفعها قبل الامتحان الحقيقي.'))
          : h('div.callout', { style: 'margin-top:14px' },
              h('div.callout__t', 'ما الخطوة التالية؟'),
              'راجع الموضوع الأضعف أعلاه ثم أعد الامتحان. أغلب الطلاب يرفعون نتيجتهم '
              + 'أكثر من ٢٠ نقطة بعد مراجعة واحدة مركّزة.'),

        h('div.row', { style: 'margin-top:16px;gap:8px' },
          h('button.btn.btn--primary.grow', {
            onclick: () => App.go('course', { tab: 'practice' }, true),
          }, 'راجع أخطاءك'),
          h('button.btn.btn--secondary.grow', {
            onclick: () => App.go('exam', { id: params.id }, true),
          }, 'أعد المحاولة')),

        h('button.btn.btn--ghost.btn--block', {
          style: 'margin-top:6px',
          onclick: () => App.go('course', { tab: 'exams' }, true),
        }, 'إلى كل الامتحانات'),
      ),
    );
  };
})();
