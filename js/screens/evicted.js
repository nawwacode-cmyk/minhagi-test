/* =============================================================================
   شاشة الطرد من الجلسة

   لماذا شاشة كاملة لا لافتة؟
   لأن الطالب في هذه الحالة **لا يرى أي محتوى**: سياسات RLS تحجب الصفوف بصمت
   بلا خطأ. فلو تركناه في الشاشة العادية لرأى دروسًا صفرًا وامتحانات صفرًا،
   واستنتج أن التطبيق تعطّل أو أن اشتراكه ضاع.

   الرسالة هنا تشرح السبب بلغته وتعطيه فعلًا واحدًا واضحًا.
   ============================================================================= */
window.Screens = window.Screens || {};

(function () {
  const { h, ar, icon, svg } = UI;

  Screens.evicted = () => {
    const s = Store.get();

    return h('div.screen',
      h('div.screen__body',
        h('div.dash',
          h('div.dash__main',
            h('div.card.card--pad', { style: 'text-align:center;padding:32px 24px' },

              h('div', {
                style: 'width:64px;height:64px;margin:0 auto 18px;border-radius:999px;'
                     + 'display:grid;place-items:center;background:var(--warn-soft);color:var(--warn)',
              }, icon.wifiOff(30)),

              h('div', { style: 'font-size:20px;font-weight:700;margin-bottom:8px' },
                'تم تسجيل خروجك من هذا الجهاز'),

              h('div.muted', { style: 'line-height:1.8;max-width:38ch;margin:0 auto 6px' },
                'دخل أحد إلى حسابك من جهاز آخر. اشتراكك يعمل على جهاز واحد في '
                + 'الوقت نفسه، فيُغلق الجهاز السابق تلقائيًا.'),

              h('div.faint.small', { style: 'margin-bottom:22px' },
                'تقدّمك محفوظ بالكامل ولم يضِع منه شيء.'),

              h('button.btn.btn--primary.btn--lg.btn--block', {
                onclick: () => {
                  // لا نمسح التقدّم المحلي: قد يحمل نشاطًا لم يُرفع بعد،
                  // وسيُرسل فور نجاح الدخول الجديد.
                  Api.signOut();
                  Store.set({ signedIn: false, evicted: false });
                  App.go('auth');
                },
              }, 'سجّل الدخول من جديد'),

              Store.pending() > 0 && h('div.callout.callout--info', { style: 'margin-top:18px;text-align:start' },
                h('div.callout__t', `${ar(Store.pending())} نشاطًا بانتظار الرفع`),
                'سيُرسل تلقائيًا بمجرّد دخولك من جديد.'),
            ),

            h('div.callout', { style: 'margin-top:16px' },
              h('div.callout__t', 'إن لم تكن أنت من دخل'),
              'قد يكون كودك بيد شخص آخر. غيّر كودك بالتواصل مع الموزّع الذي '
              + 'اشتريت منه البطاقة.'),
          ),
        ),
      ),
    );
  };
})();
