/* =============================================================================
   شاشة الإيقاف المؤقّت

   تظهر حين نرفع `app_config.halted` من اللوحة — لحظة واحدة تبرّرها: عطلٌ
   فادح وصل الطلاب فعلًا.

   لماذا شاشة كاملة لا لافتة؟ لأن البديل أسوأ: طالبٌ أمام تطبيق مكسور بلا
   تفسير يستنتج أن اشتراكه ضاع أو أن المنصّة انتهت. وService Worker يخدم
   النسخة المخزَّنة، فحتى النشر المصحَّح لا يصله إلّا عند الفتحة التالية —
   أي أنك بلا هذه الشاشة لا تملك وسيلة تخاطبه بها إطلاقًا.

   ونطمئنه على شيئين تحديدًا: اشتراكه وتقدّمه. هما ما سيقلق عليهما، وهما
   بالفعل سليمان — الإيقاف لا يلمس RLS ولا البيانات.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, ar, icon } = UI;

  Screens.halted = () => {
    const s = Store.get();
    const notice = s.appConfig?.notice;

    return h('div.screen',
      h('div.screen__body',
        h('div.dash',
          h('div.dash__main',
            h('div.card.card--pad', { style: 'text-align:center;padding:32px 24px' },

              h('div', {
                style: 'width:64px;height:64px;margin:0 auto 18px;border-radius:999px;'
                     + 'display:grid;place-items:center;background:var(--warn-soft);color:var(--warn)',
              }, icon.warn(30)),

              h('div', { style: 'font-size:20px;font-weight:600;margin-bottom:8px' },
                'التطبيق تحت الصيانة'),

              // رسالة اللوحة إن وُجدت — هي الأدقّ لأنها تصف العطل الجاري.
              // وإلّا نصٌّ عامّ صادق لا يعد بوقت لا نعرفه.
              h('div.muted', { style: 'line-height:1.8;max-width:40ch;margin:0 auto 6px' },
                notice || 'نُصلح عطلًا طارئًا الآن. أعد فتح التطبيق بعد قليل.'),

              h('div.faint.small', { style: 'margin-bottom:22px' },
                'اشتراكك وتقدّمك محفوظان بالكامل — لم يضِع منهما شيء.'),

              h('button.btn.btn--primary.btn--lg.btn--block', {
                // إعادة التحميل لا استئناف: الإيقاف يُرفع من الخادم، ولا
                // نعرف أنه رُفع إلّا بمزامنة جديدة.
                onclick: () => location.reload(),
              }, 'أعد المحاولة'),

              Store.pending() > 0 && h('div.callout.callout--info',
                { style: 'margin-top:18px;text-align:start' },
                h('div.callout__t', `${ar(Store.pending())} نشاطًا بانتظار الرفع`),
                'سيُرسل تلقائيًا بمجرّد عودة التطبيق.'),
            ),
          ),
        ),
      ),
    );
  };
})();
