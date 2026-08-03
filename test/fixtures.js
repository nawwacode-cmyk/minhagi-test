/* =============================================================================
   fixtures.js — محتوى وهمي لاختبارات المنطق فقط

   هذا الملف **ليس** جزءًا من التطبيق ولا يُحمَّل في index.html. كان سابقًا
   js/data/seed.js يُشحن مع التطبيق، فنُقل إلى هنا يوم صار المحتوى الحقيقي
   يأتي كاملًا من Supabase: اختبارات المنطق تحتاج بيانات ثابتة معروفة النتائج،
   لكن الطالب يجب ألّا يرى مادة وهمية أبدًا.
   ============================================================================= */
window.SEED = {

  subjects: [
    { id: 'fr', name: 'اللغة الفرنسية', native: 'Français', cover: 'assets/img/cover-fr.jpg' },
    { id: 'en', name: 'اللغة الإنجليزية', native: 'English' },
    { id: 'math', name: 'الرياضيات', native: null },
    { id: 'physics', name: 'الفيزياء والكيمياء', native: null },
    { id: 'history', name: 'التاريخ', native: null },
  ],

  grades: [
    { id: 'g9',  name: 'الصف التاسع', note: 'شهادة التعليم الأساسي' },
    { id: 'g12', name: 'البكالوريا',  note: 'الفرع الأدبي والعلمي' },
  ],

  /**
   * الكورس — لا المادة — هو وحدة الوصول والاشتراك. `entitled` هنا بيانات
   * تجريبية ثابتة؛ في الوضع الحقيقي يحسبها sync.js من وجود وحدات وصلت فعليًا
   * عبر RLS، لا من علم مخزَّن.
   *
   * تنويعة مقصودة هنا لمعاينة كل تركيبات بطاقة الكتالوج قبل بناء أي شيء
   * حقيقي فوقها: صورة+أستاذ، صورة بلا أستاذ، أستاذ بلا صورة، ولا هذا ولا ذاك،
   * زائد صفّين وعنوان طويل لاختبار التفاف النص. لا تُرفع هذه التنويعة إلى
   * السيرفر — SEED هنا للعرض المحلي فقط، تُستبدل بمحتوى sync.js الحقيقي.
   */
  courses: [
    { id: 'fr-g9-core', title: 'منهاج اللغة الفرنسية — الصف التاسع',
      subject: 'fr', grade: 'g9', teacher: 'أ. سامي', entitled: true,
      about: 'شرح كامل لمنهاج اللغة الفرنسية للصف التاسع، درسًا درسًا، بفيديوهات '
           + 'قصيرة لا تتجاوز العشر دقائق. بعد كل درس تمارين فورية على ما شرحناه '
           + 'للتو، وبنك أسئلة مفتوح تتدرّب عليه متى شئت، وامتحانات تجريبية '
           + 'ووزارية بصيغة ورقة الفحص نفسها.',
      intro: { thumb: 'assets/img/video-thumb.svg', length: '٢:٤٠' },
      includes: ['شرح كل دروس المنهاج بالفيديو', 'بنك أسئلة بعد كل درس',
                 'امتحانات تجريبية بصيغة ورقة الفحص', 'دورات وزارية سابقة محلولة',
                 'تنزيل الدروس والدراسة دون إنترنت'] },

    { id: 'fr-g12-core', title: 'منهاج اللغة الفرنسية — البكالوريا',
      subject: 'fr', grade: 'g12', teacher: 'أ. سامي', entitled: false,
      about: 'المنهاج الكامل للبكالوريا بفرعيها الأدبي والعلمي، مع تركيز خاص على '
           + 'نمط أسئلة الدورات الوزارية الأخيرة وطريقة توزيع العلامات.',
      intro: { thumb: 'assets/img/video-thumb.svg', length: '٣:١٠' },
      includes: ['شرح كل دروس المنهاج بالفيديو', 'بنك أسئلة بعد كل درس',
                 'امتحانات تجريبية بصيغة ورقة الفحص', 'دورات وزارية سابقة محلولة'] },

    { id: 'math-g9-core', title: 'منهاج الرياضيات — الصف التاسع',
      subject: 'math', grade: 'g9', teacher: 'أ. وليد', entitled: false,
      about: 'الجبر والهندسة للصف التاسع بالترتيب نفسه المعتمد في الكتاب، مع حلّ '
           + 'مفصّل لكل تمرين يظهر في الامتحانات.',
      intro: { thumb: 'assets/img/video-thumb.svg', length: '٢:١٥' },
      includes: ['شرح كل دروس المنهاج بالفيديو', 'حلول مفصّلة للتمارين',
                 'امتحانات تجريبية', 'دورات وزارية سابقة محلولة'] },

    { id: 'en-g9-core', title: 'منهاج اللغة الإنجليزية — الصف التاسع',
      subject: 'en', grade: 'g9', teacher: null, entitled: false,
      about: 'قيد الإعداد — يُفتح قريبًا.',
      includes: ['شرح كل دروس المنهاج بالفيديو', 'بنك أسئلة بعد كل درس'] },

    { id: 'physics-g9-core', title: 'منهاج الفيزياء والكيمياء — الصف التاسع (المنهاج المعدَّل)',
      subject: 'physics', grade: 'g9', teacher: null, entitled: false,
      about: 'قيد الإعداد — يُفتح قريبًا.',
      includes: ['شرح كل دروس المنهاج بالفيديو', 'تجارب مصوَّرة', 'بنك أسئلة'] },

    { id: 'history-g12-core', title: 'منهاج التاريخ — البكالوريا',
      subject: 'history', grade: 'g12', teacher: null, entitled: false,
      about: 'قيد الإعداد — يُفتح قريبًا.',
      includes: ['شرح كل دروس المنهاج بالفيديو', 'ملخّصات وخرائط زمنية'] },
  ],

  topics: [
    { id: 'salutations', name: 'التحيات والتعارف', native: 'Salutations' },
    { id: 'articles',    name: 'أدوات التعريف',    native: 'Les articles' },
    { id: 'conjugaison', name: 'تصريف الأفعال',    native: 'La conjugaison' },
    { id: 'syntaxe',     name: 'بناء الجملة',      native: 'La syntaxe' },
    { id: 'expression',  name: 'التعبير الكتابي',  native: 'Expression écrite' },
  ],

  units: [
    {
      id: 'u1', title: 'الوحدة الأولى: التعارف والتحيات', course: 'fr-g9-core',
      lessons: ['salutations', 'articles-definis'],
    },
    {
      id: 'u2', title: 'الوحدة الثانية: الأفعال الأساسية', course: 'fr-g9-core',
      lessons: ['etre-avoir', 'negation'],
    },
  ],

  lessons: {
    'salutations': {
      id: 'salutations', title: 'التحيات والتعارف', minutes: 12, free: true,
      topics: ['salutations'],
      video: { title: 'Les salutations', length: '6:24', thumb: 'assets/img/video-thumb.svg' },
      body: `
        <h3>Les salutations — التحيات</h3>
        <p>في الفرنسية تختلف التحية حسب <b>وقت اليوم</b> وحسب <b>درجة الرسمية</b>.</p>
        <table>
          <tr><th>الفرنسية</th><th>العربية</th><th>متى تُستخدم</th></tr>
          <tr><td><span class="fr"><b>Bonjour</b></span></td><td>صباح الخير / مرحبًا</td><td class="muted">من الصباح حتى المساء</td></tr>
          <tr><td><span class="fr"><b>Bonsoir</b></span></td><td>مساء الخير</td><td class="muted">بعد الغروب</td></tr>
          <tr><td><span class="fr"><b>Salut</b></span></td><td>أهلًا</td><td class="muted">بين الأصدقاء — غير رسمية</td></tr>
          <tr><td><span class="fr"><b>Au revoir</b></span></td><td>إلى اللقاء</td><td class="muted">عند الوداع</td></tr>
          <tr><td><span class="fr"><b>Bonne nuit</b></span></td><td>تصبح على خير</td><td class="muted">عند النوم فقط</td></tr>
        </table>
        <div class="callout">
          <div class="callout__t">⚠ خطأ شائع</div>
          استخدام <span class="fr">Bonne nuit</span> عند مغادرة مكان مساءً.
          الصحيح <span class="fr">Bonsoir</span> أو <span class="fr">Au revoir</span> —
          أما <span class="fr">Bonne nuit</span> فتُقال لمن سيذهب إلى النوم.
        </div>
        <h3>Se présenter — تقديم النفس</h3>
        <table>
          <tr><td><span class="fr">Je m'appelle…</span></td><td>اسمي…</td></tr>
          <tr><td><span class="fr">Comment tu t'appelles ?</span></td><td>ما اسمك؟ (غير رسمي)</td></tr>
          <tr><td><span class="fr">Enchanté / Enchantée</span></td><td>تشرّفنا (مذكّر / مؤنث)</td></tr>
          <tr><td><span class="fr">J'ai quinze ans</span></td><td>عمري خمس عشرة سنة</td></tr>
        </table>
        <h3>Tu ou vous ?</h3>
        <p><span class="fr">tu</span> مع صديق أو زميل من نفس العمر.
           <span class="fr">vous</span> مع الأستاذ أو الغريب أو الأكبر سنًّا.
           استخدام <span class="fr">tu</span> مع أستاذك خطأ اجتماعي، لا مجرد خطأ نحوي.</p>`,
      exercises: ['q-sal-1', 'q-sal-2'],
    },

    'articles-definis': {
      id: 'articles-definis', title: 'أدوات التعريف والتنكير', minutes: 15,
      topics: ['articles'], downloaded: true,
      video: { title: 'Les articles', length: '8:10', thumb: 'assets/img/video-thumb.svg' },
      body: `
        <h3>Les articles définis — أدوات التعريف</h3>
        <p>تُستخدم للحديث عن شيء <b>معروف أو محدَّد</b>، وتقابل «الـ» في العربية.</p>
        <table>
          <tr><th></th><th>مفرد مذكّر</th><th>مفرد مؤنث</th><th>جمع</th></tr>
          <tr><td class="muted">الأداة</td><td><span class="fr"><b>le</b></span></td><td><span class="fr"><b>la</b></span></td><td><span class="fr"><b>les</b></span></td></tr>
          <tr><td class="muted">مثال</td><td><span class="fr">le livre</span></td><td><span class="fr">la maison</span></td><td><span class="fr">les livres</span></td></tr>
        </table>
        <h3>L'élision — الحذف</h3>
        <p>أمام حرف علة أو <span class="fr">h</span> صامتة تصبح <span class="fr">le</span>
           و<span class="fr">la</span> كلتاهما <span class="fr"><b>l'</b></span>:
           <span class="fr">l'école</span> · <span class="fr">l'ami</span> · <span class="fr">l'hôtel</span>.</p>
        <div class="callout">
          <div class="callout__t">نقطة مهمة للطالب العربي</div>
          الجنس في الفرنسية ليس منطقيًا ولا يطابق العربية. لذلك <b>احفظ الأداة مع الكلمة</b>:
          احفظ <span class="fr">la maison</span> لا <span class="fr">maison</span> وحدها.
        </div>
        <table>
          <tr><th>النهاية</th><th>الجنس الغالب</th><th>مثال</th></tr>
          <tr><td><span class="fr">-tion, -sion</span></td><td>مؤنث</td><td><span class="fr">la nation</span></td></tr>
          <tr><td><span class="fr">-té, -ée</span></td><td>مؤنث</td><td><span class="fr">la liberté</span></td></tr>
          <tr><td><span class="fr">-ment</span></td><td>مذكّر</td><td><span class="fr">le monument</span></td></tr>
          <tr><td><span class="fr">-age</span></td><td>مذكّر</td><td><span class="fr">le village</span></td></tr>
        </table>`,
      exercises: ['q-art-1', 'q-art-2', 'q-art-3'],
    },

    'etre-avoir': {
      id: 'etre-avoir', title: 'تصريف être و avoir', minutes: 18,
      topics: ['conjugaison'],
      video: { title: 'Être et avoir au présent', length: '11:02', thumb: 'assets/img/video-thumb.svg' },
      body: `
        <h3>Le verbe <span class="fr">être</span> au présent</h3>
        <table>
          <tr><td><span class="fr">je</span></td><td><span class="fr"><b>suis</b></span></td>
              <td><span class="fr">nous</span></td><td><span class="fr"><b>sommes</b></span></td></tr>
          <tr><td><span class="fr">tu</span></td><td><span class="fr"><b>es</b></span></td>
              <td><span class="fr">vous</span></td><td><span class="fr"><b>êtes</b></span></td></tr>
          <tr><td><span class="fr">il / elle</span></td><td><span class="fr"><b>est</b></span></td>
              <td><span class="fr">ils / elles</span></td><td><span class="fr"><b>sont</b></span></td></tr>
        </table>
        <h3>Le verbe <span class="fr">avoir</span> au présent</h3>
        <table>
          <tr><td><span class="fr">j'</span></td><td><span class="fr"><b>ai</b></span></td>
              <td><span class="fr">nous</span></td><td><span class="fr"><b>avons</b></span></td></tr>
          <tr><td><span class="fr">tu</span></td><td><span class="fr"><b>as</b></span></td>
              <td><span class="fr">vous</span></td><td><span class="fr"><b>avez</b></span></td></tr>
          <tr><td><span class="fr">il / elle</span></td><td><span class="fr"><b>a</b></span></td>
              <td><span class="fr">ils / elles</span></td><td><span class="fr"><b>ont</b></span></td></tr>
        </table>
        <div class="callout">
          <div class="callout__t">⚠ فرق جوهري عن العربية</div>
          العمر يُقال بـ <span class="fr">avoir</span> لا <span class="fr">être</span>:
          <span class="fr">J'<b>ai</b> quinze ans</span> ✅ · <span class="fr">Je suis quinze ans</span> ❌.
          وكذلك <span class="fr">J'ai faim</span> (جائع) و<span class="fr">J'ai soif</span> (عطشان)
          و<span class="fr">J'ai froid</span> (بردان).
        </div>`,
      exercises: ['q-conj-1', 'q-conj-2', 'q-conj-3', 'q-voc-1'],
    },

    'negation': {
      id: 'negation', title: 'النفي وبناء الجملة', minutes: 10,
      topics: ['syntaxe'],
      video: { title: 'La négation', length: '7:45', thumb: 'assets/img/video-thumb.svg' },
      body: `
        <h3>La négation — النفي</h3>
        <p>القاعدة: <span class="fr"><b>ne … pas</b></span> يحيطان بالفعل المصرَّف.</p>
        <table>
          <tr><td><span class="fr">Je suis étudiant.</span></td><td>←</td>
              <td><span class="fr">Je <b>ne</b> suis <b>pas</b> étudiant.</span></td></tr>
          <tr><td><span class="fr">J'ai un frère.</span></td><td>←</td>
              <td><span class="fr">Je <b>n'</b>ai <b>pas de</b> frère.</span></td></tr>
        </table>
        <div class="callout">
          <div class="callout__t">تغييران ينساهما الطلاب</div>
          <span class="fr">ne</span> تصبح <span class="fr">n'</span> أمام حرف علة،
          و<span class="fr">un/une/des</span> تصبح <span class="fr">de</span> بعد النفي.
        </div>`,
      exercises: ['q-syn-1'],
    },
  },

  questions: {
    'q-sal-1': {
      id: 'q-sal-1', type: 'mcq', topic: 'salutations',
      stem: 'تلتقي أستاذك الساعة الثامنة صباحًا. ماذا تقول؟',
      options: [
        { k: 'أ', t: 'Bonjour',    fr: true, correct: true },
        { k: 'ب', t: 'Bonsoir',    fr: true },
        { k: 'ج', t: 'Bonne nuit', fr: true },
        { k: 'د', t: 'Salut',      fr: true },
      ],
      why: 'Bonjour تحية النهار. أما Salut فغير رسمية ولا تُقال للأستاذ، و Bonne nuit تُقال لمن سيذهب للنوم.',
    },
    'q-sal-2': {
      id: 'q-sal-2', type: 'mcq', topic: 'salutations',
      stem: 'أيّهما تستخدم مع أستاذك؟',
      options: [
        { k: 'أ', t: 'tu',   fr: true },
        { k: 'ب', t: 'vous', fr: true, correct: true },
      ],
      why: 'vous للأستاذ والغريب والأكبر سنًّا. استخدام tu معه خطأ اجتماعي لا نحوي فقط.',
    },
    'q-art-1': {
      id: 'q-art-1', type: 'mcq', topic: 'articles',
      stem: 'اختر الأداة الصحيحة: ___ maison est grande.',
      options: [
        { k: 'أ', t: 'le',  fr: true },
        { k: 'ب', t: 'la',  fr: true, correct: true },
        { k: 'ج', t: 'les', fr: true },
        { k: 'د', t: 'un',  fr: true },
      ],
      why: 'كلمة maison مؤنثة مفردة فتأخذ la. تذكّر أن النهاية ‎-son/-sion‎ غالبًا مؤنثة.',
    },
    'q-art-2': {
      id: 'q-art-2', type: 'mcq', topic: 'articles',
      stem: 'اختر الصيغة الصحيحة:',
      options: [
        { k: 'أ', t: 'la école',  fr: true },
        { k: 'ب', t: 'le école',  fr: true },
        { k: 'ج', t: "l'école",   fr: true, correct: true },
        { k: 'د', t: 'les école', fr: true },
      ],
      why: "أمام حرف علة تصبح le و la كلتاهما l' — وهذا ما يسمى الحذف (l'élision).",
    },
    'q-art-3': {
      id: 'q-art-3', type: 'multi', topic: 'articles',
      stem: 'أي من هذه الكلمات مؤنثة؟ (أكثر من إجابة صحيحة)',
      options: [
        { k: 'أ', t: 'la nation',   fr: true, correct: true },
        { k: 'ب', t: 'le village',  fr: true },
        { k: 'ج', t: 'la liberté',  fr: true, correct: true },
        { k: 'د', t: 'le monument', fr: true },
      ],
      why: 'النهايتان ‎-tion‎ و ‎-té‎ مؤنثتان غالبًا، بينما ‎-age‎ و ‎-ment‎ مذكّرتان.',
    },
    'q-conj-1': {
      id: 'q-conj-1', type: 'blank', topic: 'conjugaison',
      stem: 'أكمل بتصريف الفعل être:',
      parts: ['Je ', { blank: 0 }, ' étudiant et tu ', { blank: 1 }, ' professeur.'],
      blanks: [
        { accept: ['suis'], choices: ['suis', 'es', 'est'] },
        { accept: ['es'],   choices: ['es', 'est', 'suis'] },
      ],
      why: 'être في المضارع: je suis / tu es / il est.',
    },
    'q-conj-2': {
      id: 'q-conj-2', type: 'mcq', topic: 'conjugaison',
      stem: 'كيف تقول «عمري خمس عشرة سنة»؟',
      options: [
        { k: 'أ', t: 'Je suis quinze ans',  fr: true },
        { k: 'ب', t: "J'ai quinze ans",     fr: true, correct: true },
        { k: 'ج', t: 'Je suis quinze',      fr: true },
        { k: 'د', t: "J'ai quinze années",  fr: true },
      ],
      why: 'العمر في الفرنسية يُقال بالفعل avoir لا être — حرفيًا «أملك ١٥ سنة». من أكثر الأخطاء شيوعًا عند الطلاب العرب.',
    },
    'q-conj-3': {
      id: 'q-conj-3', type: 'blank', topic: 'conjugaison',
      stem: 'أكمل بتصريف الفعل avoir:',
      parts: ['Nous ', { blank: 0 }, ' deux frères et ils ', { blank: 1 }, ' une sœur.'],
      blanks: [
        { accept: ['avons'], choices: ['avons', 'avez', 'ont'] },
        { accept: ['ont'],   choices: ['ont', 'sont', 'as'] },
      ],
      why: 'avoir: nous avons / ils ont. انتبه: ont ليست sont.',
    },
    'q-syn-1': {
      id: 'q-syn-1', type: 'order', topic: 'syntaxe',
      stem: 'رتّب الكلمات لتكوين جملة منفية صحيحة.',
      answer: ['Je', 'ne', 'suis', 'pas', 'professeur'],
      why: 'قاعدة النفي: ne + الفعل المصرَّف + pas.',
    },
    'q-voc-1': {
      id: 'q-voc-1', type: 'mcq', topic: 'conjugaison',
      stem: 'كيف تقول «أنا جائع» بالفرنسية؟',
      options: [
        { k: 'أ', t: 'Je suis faim', fr: true },
        { k: 'ب', t: "J'ai faim",    fr: true, correct: true },
        { k: 'ج', t: 'Je faim',      fr: true },
      ],
      why: 'الجوع والعطش والبرد والخوف كلها بالفعل avoir في الفرنسية.',
    },
  },

  exams: [
    {
      id: 'mock-1', kind: 'mock', title: 'امتحان تجريبي — النموذج الأول',
      minutes: 45, pass: 50, subject: 'fr', grade: 'g9',
      questions: ['q-sal-1', 'q-art-1', 'q-art-2', 'q-conj-1', 'q-conj-2', 'q-syn-1', 'q-voc-1', 'q-art-3'],
    },
    {
      id: 'min-2024', kind: 'ministry', title: 'الدورة الوزارية ٢٠٢٤',
      minutes: 60, pass: 50, subject: 'fr', grade: 'g9',
      questions: ['q-art-1', 'q-conj-2', 'q-conj-3', 'q-sal-2', 'q-syn-1', 'q-art-3'],
    },
    {
      id: 'min-2023', kind: 'ministry', title: 'الدورة الوزارية ٢٠٢٣',
      minutes: 60, pass: 50, subject: 'fr', grade: 'g9',
      questions: ['q-sal-1', 'q-art-2', 'q-conj-1', 'q-voc-1'],
    },
  ],
};
