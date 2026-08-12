/* =============================================================================
   مسار المادة — Store.subjectPath والشاشة التي تعرضه.

   الحساب أهمّ ما يُفحص هنا: أيّ وحدة تُختار «حالية»، وأيّ خطوة تصير «الآن»
   بالضبط (واحدة لا أكثر ولا أقل)، وماذا يحدث عند إنجاز وحدة كاملة أو المنهاج
   كلّه. الرسم يُفحص فحصًا سطحيًا فقط — أنه لا ينهار، لا أنه يبدو صحيحًا.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

function fresh(patch = {}) {
  Store.set({ lessons: {}, doneAt: {}, exams: {}, ...patch });
}

// التجهيزات: مادة 'fr' فيها وحدتان (u1: سلامات + أدوات · u2: être/avoir + النفي)
fresh();

// =============================================================================
// ١) البداية — الوحدة الأولى، خطوة واحدة بس «الآن»
// =============================================================================
{
  const p = Store.subjectPath('fr');
  ok('الوحدة الحالية هي الأولى بلا إنجاز', p.unit.id === 'u1', p.unit.id);
  ok('خطوتان للدروس + خطوة امتحان', p.steps.length === 3, String(p.steps.length));

  const nowSteps = p.steps.filter((s) => s.state === 'now');
  ok('خطوة واحدة بس حالتها now', nowSteps.length === 1, String(nowSteps.length));
  ok('وهي أول درس بالوحدة', nowSteps[0].type === 'lesson' && nowSteps[0].id === 'salutations',
     `${nowSteps[0].type}:${nowSteps[0].id}`);

  ok('الدرس الثاني لسا todo', p.steps[1].state === 'todo', p.steps[1].state);
  ok('وخطوة الامتحان لسا todo (بعد كل الدروس)', p.steps[2].type === 'examCta' && p.steps[2].state === 'todo');
  ok('الوحدة التالية هي الثانية', p.next && p.next.id === 'u2', p.next && p.next.id);
}

// =============================================================================
// ٢) بعد إنجاز أول درس — «الآن» تنتقل للي بعده
// =============================================================================
{
  fresh();
  Store.completeLesson('salutations');
  const p = Store.subjectPath('fr');
  ok('ما زلنا بالوحدة الأولى', p.unit.id === 'u1');
  ok('الدرس الأول صار done', p.steps[0].state === 'done', p.steps[0].state);
  ok('والثاني صار now', p.steps[1].state === 'now', p.steps[1].state);
  ok('وخطوة واحدة بس now', p.steps.filter((s) => s.state === 'now').length === 1);
}

// =============================================================================
// ٣) بعد إنجاز الوحدة كاملة — ننتقل للوحدة التالية
// =============================================================================
{
  fresh();
  Store.completeLesson('salutations');
  Store.completeLesson('articles-definis');
  const p = Store.subjectPath('fr');
  ok('انتقلنا للوحدة الثانية', p.unit.id === 'u2', p.unit.id);
  ok('أول درس بالثانية صار now', p.steps[0].id === 'etre-avoir' && p.steps[0].state === 'now');
  ok('ولا وحدة تالية بعدها (آخر وحدة)', p.next === null);
}

// =============================================================================
// ٤) بعد إنجاز المنهاج كلّه — آخر وحدة، وخطوة الامتحان هي «الآن»
//    لا أول وحدة من جديد: ما تبقّى فعليًا هو امتحان آخر وحدة.
// =============================================================================
{
  fresh();
  (SEED.units || []).filter((u) => u.subject === 'fr')
    .forEach((u) => (u.lessons || []).forEach((id) => Store.completeLesson(id)));
  const p = Store.subjectPath('fr');
  ok('تعرض آخر وحدة لا الأولى', p.unit.id === 'u2', p.unit.id);
  ok('كل دروسها done', p.steps.filter((s) => s.type === 'lesson').every((s) => s.state === 'done'));
  ok('وخطوة الامتحان صارت now', p.steps[p.steps.length - 1].state === 'now');
}

// =============================================================================
// ٥) مادة بلا وحدات — لا انهيار
// =============================================================================
{
  fresh();
  const p = Store.subjectPath('math');
  ok('بلا وحدة حالية', p.unit === null);
  ok('بلا خطوات', p.steps.length === 0);
  ok('وبلا وحدة تالية', p.next === null);
}

// =============================================================================
// ٦) الشاشة نفسها تُبنى بلا استثناء، بالحالتين
// =============================================================================
{
  fresh();
  const html1 = Screens.course({ subject: 'fr', tab: 'lessons' }).outerHTML;
  ok('شاشة المادة (فيها مسار) تُبنى بلا استثناء', html1.includes('class="path"'));
  ok('وفيها عنوان الوحدة الحالية', html1.includes('الوحدة الأولى'));
  ok('وفيها معاينة الوحدة التالية', html1.includes('class="teaser"'));

  const html2 = Screens.course({ subject: 'math', tab: 'lessons' }).outerHTML;
  ok('ومادة بلا محتوى تُبنى بلا استثناء أيضًا', typeof html2 === 'string' && html2.length > 0);
}

console.log('\n' + (bad ? `${bad} فشل` : 'مسار المادة سليم'));
process.exit(bad ? 1 : 0);
