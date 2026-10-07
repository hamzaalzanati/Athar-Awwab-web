// سلوك الواجهة: بحث الترويسة، الكشف عند التمرير، أزرار الكيان (مشاركة/نسخ/QR)، تتبّع مجهول.
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // بحث الترويسة: على الجوال يتحول الزر إلى حقل بحث
  var form = document.querySelector(".hsearch");
  if (form) {
    var input = form.querySelector("input"), header = document.querySelector(".header");
    var set = function (open) {
      form.setAttribute("data-open", open ? "true" : "false");
      if (header) header.setAttribute("data-searching", open ? "true" : "false");
      if (open) input.focus();
    };
    form.querySelector(".hs-open").addEventListener("click", function () { set(true); });
    form.querySelector(".hs-close").addEventListener("click", function () { set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  }

  // كشف الأقسام عند التمرير (يفشل مفتوحًا: بلا JS أو مع تقليل الحركة يظهر كل شيء)
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.setAttribute("data-reveal", "in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("[data-reveal-on-scroll]").forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      el.setAttribute("data-reveal", "out"); io.observe(el);
    });
  }

  // إحصاء مجهول: مسار الصفحة فقط (لا IP ولا كوكيز ولا معرّف زائر)
  function beacon(payload) {
    try {
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track", blob)))
        fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
    } catch (e) { /* لا يكسر الصفحة */ }
  }
  beacon({ path: location.pathname });

  // أزرار صفحة الكيان
  var box = document.querySelector(".eactions");
  if (box) {
    var notice = box.querySelector("[data-notice]");
    var flash = function (msg) { notice.textContent = msg; setTimeout(function () { notice.textContent = ""; }, 2200); };
    var url = location.origin + box.getAttribute("data-path");
    box.querySelector("[data-join-link]").addEventListener("click", function () { beacon({ entity: box.getAttribute("data-entity") }); });
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "copy") {
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { flash("تم نسخ الرابط"); }, function () { flash("تعذّر النسخ"); });
      } else if (act === "share") {
        if (navigator.share) navigator.share({ title: box.getAttribute("data-title"), url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { flash("تم نسخ الرابط"); });
      } else if (act === "qr") {
        var qr = box.querySelector("[data-qr]"), open = qr.hasAttribute("hidden");
        if (open) {
          // الرابط يُرسل لخدمة QR خارجية فقط عندما يطلب الزائر الرمز
          qr.querySelector("img").src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=" + encodeURIComponent(box.getAttribute("data-join"));
          qr.removeAttribute("hidden");
        } else qr.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      }
    });
  }
})();
