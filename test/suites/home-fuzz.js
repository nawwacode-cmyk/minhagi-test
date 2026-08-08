// أي شكل بيانات من الخادم يجعل Screens.home ترمي؟ نجرّب الأشكال الواقعية:
// جداول فارغة، حقول null صادقة (bio/photo غائبان)، وأستاذ بلا مواد.
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

const base = JSON.parse(JSON.stringify({
  subjects: window.SEED.subjects, grades: window.SEED.grades,
  units: window.SEED.units, lessons: window.SEED.lessons,
  questions: window.SEED.questions, exams: window.SEED.exams,
}));

const set = (over) => { Object.assign(window.SEED, JSON.parse(JSON.stringify(base)), over); };

const cases = {
  'كل شيء فارغ (طالب جديد قبل أول مزامنة)':
    { subjects: [], grades: [], units: [], lessons: {}, questions: {}, exams: [], teachers: [], banners: [] },
  'محتوى مخزَّن قديم بلا حقلَي banners/teachers أصلًا':
    { teachers: undefined, banners: undefined },
  'أستاذ بلا مواد وبلا صورة وبلا نبذة':
    { teachers: [{ id: 't1', name: 'نوار بشناق', bio: null, photo: null, subjects: [] }] },
  'أستاذ باسم فارغ':
    { teachers: [{ id: 't1', name: '', bio: null, photo: null, subjects: [] }] },
  'أستاذ بمادة غير موجودة في subjects':
    { teachers: [{ id: 't1', name: 'أ', bio: null, photo: null, subjects: ['zz'] }] },
  'بانر بلا عنوان ولا وصف':
    { banners: [{ id: 'b', title: null, sub: null, image: null, target: null }] },
  'بانر بوجهة بلا نوع':
    { banners: [{ id: 'b', title: 'ت', sub: '', image: null, target: { type: null, value: null } }] },
  'بانر بوجهة نصّية لا كائنًا (شكل قديم)':
    { banners: [{ id: 'b', title: 'ت', sub: '', image: null, target: 'subject' }] },
  'subjects غائبة كليًا مع وجود أستاذ بمادة':
    { subjects: undefined, teachers: [{ id: 't1', name: 'أ', bio: null, photo: null, subjects: ['fr'] }] },
  'subjects غائبة كليًا':
    { subjects: undefined },
  'units غائبة':
    { units: undefined },
};

for (const [label, over] of Object.entries(cases)) {
  set(over);
  try { Screens.home(); ok(label, true); }
  catch (e) { ok(label, false, e.constructor.name + ': ' + e.message); }
}

// نفس الشيء لبقيّة الشاشات التي يمكن استئنافها عند الإقلاع
set({});
for (const [name, params] of [['subjects', {}], ['account', {}], ['progress', {}]]) {
  try { Screens[name](params); ok('شاشة ' + name, true); }
  catch (e) { ok('شاشة ' + name, false, e.message); }
}

console.log('\n' + (bad ? bad + ' شكل بيانات يكسر الرسم' : 'لا شكل بيانات يكسر الرسم'));
process.exit(bad ? 1 : 0);
