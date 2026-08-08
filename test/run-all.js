/* =============================================================================
   يشغّل كل مجموعات الفحص ويطبع ملخّصًا واحدًا.
       node test/run-all.js
   لا يتوقّف عند أوّل فشل: معرفة أن ثلاث مجموعات سقطت أنفع من معرفة أن واحدة
   سقطت ثم الانتظار لتشغيلٍ آخر لتظهر البقيّة.
   ============================================================================= */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const HERE = __dirname;
const suites = [
  ['smoke', path.join(HERE, 'smoke.js')],
  ...fs.readdirSync(path.join(HERE, 'suites'))
    .filter((f) => f.endsWith('.js') && f !== 'render-check-lib.js')
    .sort()
    .map((f) => [f.replace(/\.js$/, ''), path.join(HERE, 'suites', f)]),
];

let failed = 0;
for (const [name, file] of suites) {
  process.stdout.write(name.padEnd(22));
  try {
    /* stderr يُلتقط لا يُورَّث: بعض المجموعات تختبر مسارات الفشل عمدًا فتطبع
       أخطاء صحيحة (امتلاء المساحة مثلًا). تركُها تسيل إلى الشاشة يجعل تشغيلًا
       ناجحًا يبدو منهارًا — فيتعوّد المطوّر على تجاهل الأحمر. */
    const out = execFileSync(process.execPath, [file],
      { encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(out.includes('⏭') ? '⏭  تُخطّيت' : '✓');
  } catch (e) {
    failed++;
    console.log('✗');
    const text = (e.stdout || '') + (e.stderr || '');
    text.split('\n').filter((l) => l.startsWith('FAIL') || /Error/.test(l))
      .slice(0, 4).forEach((l) => console.log('     ' + l.trim()));
  }
}

console.log('\n' + (failed ? `${failed} مجموعة فاشلة` : 'كل المجموعات ناجحة'));
process.exit(failed ? 1 : 0);
