// تطبيق لوحة التحكم (Telegram Web App). بلا مكتبات. كل نص يُعرض عبر textContent فقط.
(function () {
  "use strict";
  var BUILD = "4";
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); }
  var initData = (tg && tg.initData) || "";

  var ERR = {
    unauthorized: "تعذّر التحقق من هويتك. أعد فتح اللوحة من زر البوت.", forbidden: "ليست لديك صلاحية لهذا الإجراء.",
    invalid_url: "الرابط غير صالح (https:// فقط).", invalid_image_url: "رابط الصورة غير صالح: https:// أو مسار يبدأ بـ /images/",
    invalid_name: "الاسم غير صالح.", invalid_title: "العنوان يجب أن يكون بين 3 و120 حرفًا.", invalid_date: "التاريخ غير صالح.",
    relationship_required: "اختر علاقة الكيان بالمشروع.", duplicate_entity: "هذا الكيان موجود مسبقًا.", invalid_username: "اسم المستخدم غير صالح.",
    invalid_number: "الرقم غير صالح.", empty_session: "لم تُرسل أي رسالة للبوت بعد.", no_session: "لا توجد جلسة معاينة نشطة.",
    nothing_to_update: "لا تغيير للحفظ.", too_many_lines: "القائمة أطول من الحد (200 سطر).", server_error: "خطأ في الخادم. حاول لاحقًا.", invalid_question: "السؤال فارغ أو أطول من 500 حرف.", invalid_role: "دور غير صالح.", cannot_demote_self: "لا يمكنك إنقاص دور نفسك.", cannot_disable_self: "لا يمكنك إيقاف نفسك.", invalid_text: "النص قصير أو طويل جدًا.", invalid_id: "معرّف غير صالح.",
  };
  var REL = { own: "من مشروعنا", contribution: "مساهمة في مشروع", supported: "مشروع مدعوم" };
  var TYPE = { channel: "قناة", bot: "بوت", group: "جروب", sticker_pack: "ملصقات" };
  var STATUS = { pending: "بانتظار المراجعة", active: "منشور", hidden: "مخفي", archived: "مؤرشف", rejected: "مرفوض" };
  var PROJ = { website: "موقع لنا", contributed: "مشروع نساهم فيه", supported: "مشروع مدعوم", help: "ساعد: طلب مساعدة" };
  var OPP = { publishing: "نشر في قناة", bot: "بوت", account: "حساب تواصل", development: "برمجة/تطوير", other: "أخرى" };

  function api(action, extra) {
    return fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-init-data": initData },
      body: JSON.stringify(Object.assign({ action: action }, extra || {})),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || "server_error"); e.code = j.error || "server_error"; throw e; }
        return j;
      });
    });
  }

  // ---- مساعدات DOM (textContent فقط) ----
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  /** استبدال محتوى عنصر. لا نستعمل replaceChildren الأصلية: تحوّل المصفوفات إلى نص. */
  function replace(el, kids) {
    el.textContent = "";
    for (var i = 1; i < arguments.length; i++) add(el, arguments[i]);
  }
  function toast(msg, bad) {
    var t = h("div", { class: "toast" + (bad ? " err" : ""), role: "status" }, msg);
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function fail(e) { toast(ERR[e.code] || "تعذّر تنفيذ العملية.", true); }
  function date(s) { return s ? String(s).slice(0, 10) : ""; }

  // ---- ورقة سفلية ونماذج عامة ----
  var sheetEl = null;
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
  function openSheet(title) {
    closeSheet();
    var body = h("div", { class: "sheet", role: "dialog", "aria-label": title }, h("h3", {}, title));
    sheetEl = h("div", { class: "sheet-backdrop", onclick: function (e) { if (e.target === sheetEl) closeSheet(); } }, body);
    document.body.appendChild(sheetEl);
    return body;
  }
  function chips(options, selected, onPick) {
    var wrap = h("div", { class: "chip-select" });
    Object.keys(options).forEach(function (k) {
      var b = h("button", { type: "button", class: k === selected ? "selected" : "" }, options[k]);
      b.addEventListener("click", function () {
        selected = k; wrap.querySelectorAll("button").forEach(function (x) { x.className = ""; }); b.className = "selected"; onPick(k);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  /** نموذج: fields = [{key,label,type,options,value,hint}] ثم onSubmit(values) */
  function formSheet(title, fields, submitLabel, onSubmit, extra) {
    var s = openSheet(title), vals = {}, inputs = {};
    fields.forEach(function (f) {
      vals[f.key] = f.value == null ? "" : f.value;
      if (f.type === "chips") { s.appendChild(h("label", {}, f.label)); s.appendChild(chips(f.options, vals[f.key], function (v) { vals[f.key] = v; })); return; }
      if (f.type === "toggle") { s.appendChild(h("label", {}, f.label)); s.appendChild(chips({ yes: "نعم", no: "لا" }, vals[f.key] ? "yes" : "no", function (v) { vals[f.key] = v === "yes"; })); return; }
      var input;
      if (f.type === "textarea") input = h("textarea", { class: "search-input", rows: "3" });
      else if (f.type === "select") {
        input = h("select", {}, h("option", { value: "" }, "—"), Object.keys(f.options).map(function (k) { return h("option", { value: k }, f.options[k]); }));
      } else input = h("input", { class: "search-input", type: f.type === "date" ? "date" : "text", dir: f.type === "url" ? "ltr" : null, placeholder: f.hint || "" });
      input.value = f.type === "date" ? date(vals[f.key]) : vals[f.key];
      inputs[f.key] = input;
      s.appendChild(h("label", {}, f.label)); s.appendChild(input);
    });
    var actions = h("div", { class: "sheet-actions", style: "margin-top:18px" });
    var go = h("button", { type: "button", class: "btn-primary" }, submitLabel);
    go.addEventListener("click", function () {
      Object.keys(inputs).forEach(function (k) { vals[k] = inputs[k].value; });
      go.disabled = true;
      onSubmit(vals).then(function () { closeSheet(); }, function (e) { go.disabled = false; fail(e); });
    });
    actions.appendChild(go);
    actions.appendChild(h("button", { type: "button", class: "btn-ghost", onclick: closeSheet }, "إغلاق"));
    s.appendChild(actions);
    if (extra) s.appendChild(extra);
    return s;
  }

  // ---- الهيكل ----
  var TABS = [["overview", "النظرة"], ["pending", "الموافقات"], ["entities", "الكيانات"], ["content", "المحتوى"], ["zanati", "زناتي"], ["more", "المزيد"]];
  var state = { tab: "overview", role: "", cats: null };
  var root = document.getElementById("root"), main;

  function shell() {
    main = h("div", { class: "content" });
    var nav = h("nav", { class: "bottom-nav" }, TABS.map(function (t) {
      return h("button", { type: "button", class: state.tab === t[0] ? "active" : "", onclick: function () { go(t[0]); } }, t[1]);
    }));
    replace(root, h("div", { class: "app-shell" },
      h("header", { class: "header" }, h("img", { src: "/images/logo.png", alt: "", width: "30", height: "30", class: "header-logo" }),
        h("h1", {}, "لوحة أثر أواب"), h("span", { class: "role" }, state.role + " · v" + BUILD)), main, nav));
  }
  function go(tab) { state.tab = tab; shell(); screens[tab](); }
  function loading() { replace(main, h("div", { class: "state-message" }, "جارٍ التحميل…")); }
  function empty(msg) { return h("div", { class: "state-message" }, msg); }
  function categories() {
    if (state.cats) return Promise.resolve(state.cats);
    return api("categories.list").then(function (r) { state.cats = r.items; return r.items; });
  }
  function catOptions(type, cats) {
    var o = {}; cats.filter(function (c) { return c.is_active && c.entity_type === type; }).forEach(function (c) { o[c.id] = c.label_ar; }); return o;
  }

  var screens = {
    overview: function () {
      loading();
      api("overview").then(function (d) {
        state.role = d._role;
        var chip = function (label, st) { return h("span", { class: "health-chip" }, h("span", { class: "dot " + (st === "healthy" ? "ok" : st === "stale" ? "bad" : "") }), label); };
        var sys = d.system, canAck = state.role !== "editor";
        var aiUse = sys.ai.today.length ? sys.ai.today.map(function (x) { return x.level + ": " + x.calls; }).join("، ") : "لا استخدام اليوم";
        main.textContent = "";
        replace(main,
          h("div", { class: "health-row" }, chip("البوت: " + ({ healthy: "يعمل", stale: "متوقف", unknown: "لم يبدأ بعد" }[d.health.bot]), d.health.bot), chip("قاعدة البيانات: سليمة", "healthy")),
          h("div", { class: "stat-grid" }, [[d.pending, "بانتظار الموافقة"], [d.active, "كيان منشور"], [d.unreadMessages, "رسالة غير مقروءة"]].map(function (x) {
            return h("div", { class: "stat-box" }, h("div", { class: "n" }, x[0]), h("div", { class: "l" }, x[1]));
          })),
          h("h3", { class: "section-title" }, "صحة النظام"),
          [["آخر مزامنة ناجحة", sys.lastSyncAt ? new Date(sys.lastSyncAt).toLocaleString("en-GB") : "لم تتم بعد"], ["كيانات مزامنتها متعثرة", sys.failingSyncs], ["مهام بانتظار البوت", sys.queuedJobs],
            ["مفاتيح Gemini المضبوطة", sys.ai.configured + " من 3"], ["استخدام الذكاء الاصطناعي اليوم", aiUse]].map(function (r) {
            return h("div", { class: "mini-row" }, h("span", {}, r[0]), h("span", {}, String(r[1])));
          }),
          h("h3", { class: "section-title" }, "تنبيهات مفتوحة"),
          d.alerts.length ? d.alerts.map(function (a) {
            return h("div", { class: "list-row", style: "cursor:default" }, h("div", { class: "t" }, [a.acknowledged ? h("span", { class: "pill" }, "معلوم") : null, a.title]), a.detail ? h("div", { class: "s" }, a.detail) : null,
              canAck ? h("div", { class: "row-actions" }, h("button", { type: "button", onclick: function () { api("alert.ack", { key: a.key, ack: !a.acknowledged }).then(screens.overview, fail); } }, a.acknowledged ? "إلغاء «معلوم»" : "معلوم، لا تكرّر")) : null);
          }) : empty("لا تنبيهات مفتوحة."),
          h("div", { class: "sheet-actions", style: "margin-top:20px" },
            h("button", { class: "btn-primary", type: "button", onclick: function () { api("sync.request").then(function () { toast("طُلبت المزامنة، سينفذها البوت خلال لحظات."); }, fail); } }, "مزامنة كل الكيانات"),
            h("button", { class: "btn-ghost", type: "button", onclick: function () { analyticsSheet(7); } }, "الإحصاءات")));
      }, function (e) { replace(main, empty(ERR[e.code] || "تعذّر التحميل.")); });
    },

    pending: function () {
      loading();
      Promise.all([api("pending.list"), categories()]).then(function (r) {
        var items = r[0].items, cats = r[1];
        replace(main, h("p", { class: "hint" }, "كيانات اكتشفها البوت عند إضافته مشرفًا. لا تظهر للعامة قبل قبولك."),
          items.length ? items.map(function (e) {
            return h("div", { class: "list-row", onclick: function () { approveSheet(e, cats); } },
              h("div", { class: "t" }, e.name), h("div", { class: "s" }, [TYPE[e.entity_type], e.telegram_username ? " · @" + e.telegram_username : "", " · اكتُشف " + date(e.discovered_at)]));
          }) : empty("لا توجد كيانات بانتظار المراجعة."));
      }, function (e) { replace(main, empty(ERR[e.code] || "تعذّر التحميل.")); });
    },

    entities: function () {
      var filter = { q: "", status: "", type: "" }, offset = 0, cats = [];
      var list = h("div", {}), moreBtn = h("button", { class: "btn-ghost", type: "button", style: "width:100%;margin-top:14px", hidden: true }, "عرض المزيد");
      function row(e) {
        return h("div", { class: "list-row", onclick: function () { editSheet(e, cats); } }, h("div", { class: "t" }, e.name),
          h("div", { class: "s" }, [h("span", { class: "pill" }, TYPE[e.entity_type]), h("span", { class: "pill " + (e.status === "active" ? "ok" : "") }, STATUS[e.status]),
            e.permission_state === "removed" || e.permission_state === "restricted" ? h("span", { class: "pill bad" }, "صلاحية البوت مفقودة") : null,
            !e.category_id && e.status === "active" ? h("span", { class: "pill warn" }, "بلا تصنيف") : null,
            e.subscriber_count != null ? e.subscriber_count.toLocaleString("en-US") : ""]));
      }
      function load(reset) {
        if (reset) { offset = 0; replace(list, empty("جارٍ التحميل…")); }
        Promise.all([api("entities.list", Object.assign({ offset: offset }, filter)), categories()]).then(function (r) {
          cats = r[1];
          if (reset) list.textContent = "";
          if (reset && !r[0].items.length) replace(list, empty("لا نتائج."));
          r[0].items.forEach(function (e) { list.appendChild(row(e)); });
          offset += r[0].items.length; moreBtn.hidden = !r[0].more;
        }, function (e) { replace(list, empty(ERR[e.code] || "تعذّر التحميل.")); });
      }
      moreBtn.addEventListener("click", function () { load(false); });
      var q = h("input", { class: "search-input", type: "search", placeholder: "ابحث بالاسم" });
      var t; q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { filter.q = q.value; load(true); }, 350); });
      replace(main, q,
        chips(Object.assign({ "": "كل الأنواع" }, TYPE), "", function (v) { filter.type = v; load(true); }),
        chips(Object.assign({ "": "كل الحالات" }, STATUS), "", function (v) { filter.status = v; load(true); }),
        h("button", { class: "send-btn", type: "button", onclick: function () { categories().then(createSheet); } }, "إضافة كيان يدويًا (بوت، ملصقات، قناة لا يديرها البوت)"), list, moreBtn);
      load(true);
    },

    content: function () {
      var sub = "projects", box = h("div", {});
      var tabs = h("div", { class: "subtabs" });
      function draw() {
        replace(tabs, [["projects", "مشاريع وساعد"], ["opps", "ساهم"], ["social", "التواصل الاجتماعي"], ["cats", "التصنيفات"]].map(function (t) {
          return h("button", { type: "button", class: sub === t[0] ? "active" : "", onclick: function () { sub = t[0]; draw(); } }, t[1]);
        }));
        replace(box, empty("جارٍ التحميل…"));
        content[sub](box);
      }
      replace(main, tabs, box); draw();
    },

    zanati: function () {
      var input = h("input", { class: "search-input", type: "text", maxlength: "500", placeholder: "مثال: ماذا يحدث الآن؟ أو: كم زيارات الأسبوع؟" });
      var out = h("div", { "aria-live": "polite" });
      var btn = h("button", { class: "send-btn", type: "button" }, "اسأل زناتي");
      function ask() {
        var q = input.value.trim(); if (!q) return;
        btn.disabled = true; replace(out, empty("زناتي يفكّر…"));
        api("zanati.ask", { question: q }).then(function (r) {
          var note = { ai: "صيغت الإجابة بالذكاء الاصطناعي من بيانات حقيقية من قاعدة البيانات فقط.", deterministic: "عرض مباشر للبيانات (لم يُستخدم الذكاء الاصطناعي" + ({ budget: ": بلغت الميزانية اليومية", ai_error: ": تعذّر الاتصال", no_ai: ": لا مفاتيح مضبوطة" }[r.reason] || "") + ").", refused: "سؤال شرعي: لا أصدر أحكامًا.", no_match: "" }[r.mode];
          replace(out, h("div", { class: "list-row answer", style: "cursor:default" }, h("div", { class: "t", style: "font-weight:500" }, r.answer), note ? h("div", { class: "s" }, note) : null));
        }, function (e) { replace(out, empty(ERR[e.code] || "تعذّر الحصول على إجابة.")); }).then(function () { btn.disabled = false; });
      }
      btn.addEventListener("click", ask); input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });
      replace(main, h("h3", { class: "section-title" }, "اسأل زناتي"),
        h("p", { class: "hint" }, "يجيب من بيانات المشروع الحقيقية: الكيانات المعلّقة، صلاحيات البوت، المزامنة، الزيارات، البحث بلا نتائج. لا يصدر فتاوى."), input, btn, out);
    },

    more: function () {
      var item = function (label, fn) { return h("button", { class: "more-item", type: "button", onclick: fn }, label); };
      replace(main,
        item("الإحصاءات (الزيارات والنقرات والبحث)", function () { analyticsSheet(7); }),
        item("بث إعلان لقنوات وجروبات المشروع", broadcastSheet),
        item("المهام والمزامنة", jobsSheet),
        item("رسائل التواصل", contactSheet),
        item("مستخدمو البوت", usersSheet),
        item("المشرفون وصلاحياتهم", adminsSheet),
        item("استيراد قائمة جاهزة (روابط/قنوات/بوتات/مواقع/حسابات)", importSheet),
        item("صورة الواجهة وعدد مستخدمي البوتات", settingsSheet),
        item("سجل التدقيق", function () { listSheet("سجل التدقيق", "audit.list", function (a) { return [a.action, date(a.created_at) + " · " + a.admin_id]; }); }));
    },
  };

  var content = {
    projects: function (box) {
      api("projects.list").then(function (r) {
        replace(box, h("button", { class: "send-btn", type: "button", onclick: function () { projectSheet(null); } }, "إضافة مشروع / طلب مساعدة"),
          r.items.length ? r.items.map(function (p) {
            return h("div", { class: "list-row", onclick: function () { projectSheet(p); } }, h("div", { class: "t" }, p.name),
              h("div", { class: "s" }, [PROJ[p.kind], p.is_active ? " · نشط" : " · متوقف", p.expires_at ? " · ينتهي " + date(p.expires_at) : ""]));
          }) : empty("لا مشاريع بعد."));
      }, function (e) { replace(box, empty(ERR[e.code] || "تعذّر التحميل.")); });
    },
    opps: function (box) {
      api("opportunities.list").then(function (r) {
        replace(box, h("p", { class: "hint" }, "ساهم: دعوات لأشخاص ينفّذون عملًا (نشر في قناة، بوت، حساب...). تظهر في الموقع فقط إن وُجدت فرصة نشطة."),
          h("button", { class: "send-btn", type: "button", onclick: function () { oppSheet(null); } }, "إضافة فرصة مساهمة"),
          r.items.length ? r.items.map(function (o) {
            return h("div", { class: "list-row", onclick: function () { oppSheet(o); } }, h("div", { class: "t" }, o.title),
              h("div", { class: "s" }, [OPP[o.kind], o.is_active ? " · نشطة" : " · متوقفة", o.expires_at ? " · حتى " + date(o.expires_at) : ""]));
          }) : empty("لا فرص بعد."));
      }, function (e) { replace(box, empty(ERR[e.code] || "تعذّر التحميل.")); });
    },
    social: function (box) {
      api("social.list").then(function (r) {
        replace(box, h("button", { class: "send-btn", type: "button", onclick: function () { socialSheet(null); } }, "إضافة حساب"),
          r.items.length ? r.items.map(function (s) {
            return h("div", { class: "list-row", onclick: function () { socialSheet(s); } }, h("div", { class: "t" }, s.label), h("div", { class: "s" }, [s.platform, s.is_active ? " · نشط" : " · متوقف"]));
          }) : empty("لا حسابات بعد. أضف حساباتك الحقيقية فقط."));
      }, function (e) { replace(box, empty(e.code === "forbidden" ? "هذا القسم للأدمن والمالك." : (ERR[e.code] || "تعذّر التحميل."))); });
    },
    cats: function (box) {
      api("categories.list").then(function (r) {
        replace(box, h("p", { class: "hint" }, "ترتيب التصنيفات مستقل عن ترتيب الكيانات."),
          h("button", { class: "send-btn", type: "button", onclick: function () { catSheet(null); } }, "إضافة تصنيف"),
          r.items.map(function (c) {
            return h("div", { class: "list-row", onclick: function () { catSheet(c); } }, h("div", { class: "t" }, c.label_ar), h("div", { class: "s" }, [TYPE[c.entity_type], " · ترتيب " + c.sort_order, c.is_active ? "" : " · متوقف"]));
          }));
      }, function (e) { replace(box, empty(ERR[e.code] || "تعذّر التحميل.")); });
    },
  };

  // ---- الأوراق ----
  function approveSheet(e, cats) {
    var v = { relationship: "", category_id: "", bot_functions: [] };
    var s = openSheet("قبول: " + e.name);
    s.appendChild(h("label", {}, "علاقته بالمشروع (إلزامي)")); s.appendChild(chips(REL, "", function (x) { v.relationship = x; }));
    var co = catOptions(e.entity_type, cats);
    s.appendChild(h("label", {}, "التصنيف")); s.appendChild(Object.keys(co).length ? chips(co, "", function (x) { v.category_id = x; }) : h("p", { class: "hint" }, "لا تصنيفات لهذا النوع؛ أضف من المحتوى ← التصنيفات."));
    var nm = h("input", { class: "search-input", type: "text", value: e.name }), sd = h("input", { class: "search-input", type: "text", placeholder: "وصف قصير (اختياري)" });
    s.appendChild(h("label", {}, "الاسم المعروض")); s.appendChild(nm); s.appendChild(h("label", {}, "وصف قصير")); s.appendChild(sd);
    var act = h("div", { class: "sheet-actions", style: "margin-top:18px" });
    var ok = h("button", { class: "btn-primary", type: "button" }, "قبول ونشر");
    ok.addEventListener("click", function () {
      ok.disabled = true;
      api("entity.approve", { id: e.id, relationship: v.relationship, category_id: v.category_id || null, name: nm.value !== e.name ? nm.value : undefined, short_description: sd.value || undefined })
        .then(function () { toast("تم النشر."); closeSheet(); screens.pending(); }, function (er) { ok.disabled = false; fail(er); });
    });
    act.appendChild(ok);
    act.appendChild(h("button", { class: "btn-ghost", type: "button", onclick: function () {
      api("entity.reject", { id: e.id }).then(function () { toast("تم الرفض."); closeSheet(); screens.pending(); }, fail); } }, "رفض"));
    s.appendChild(act);
  }

  function editSheet(e, cats) {
    var rest = h("div", { style: "margin-top:14px" },
      h("div", { class: "sheet-actions" },
        h("button", { class: "btn-ghost", type: "button", onclick: function () { previewSheet(e); } }, "معاينة تيليجرام"),
        h("button", { class: "btn-ghost", type: "button", onclick: function () { api("sync.request", { entity_id: e.id }).then(function () { toast("طُلبت المزامنة."); }, fail); } }, "مزامنة"),
        h("button", { class: "btn-ghost", type: "button", onclick: function () { syncLogSheet(e); } }, "سجل المزامنة")),
      e.name_locked || e.desc_locked ? h("p", { class: "hint" }, "الاسم/الوصف المعدَّلان يدويًا لا تكتب فوقهما المزامنة.") : null);
    formSheet("تعديل: " + e.name, [
      { key: "name", label: "الاسم", value: e.name }, { key: "short_description", label: "وصف قصير", value: e.short_description },
      { key: "long_description", label: "وصف مطوّل", type: "textarea", value: e.long_description },
      { key: "image_url", label: "رابط الصورة (https:// أو /images/...)", type: "url", value: e.image_url },
      { key: "telegram_username", label: "اسم المستخدم في تيليجرام (بدون @) — أو اسم حزمة الملصقات", type: "url", value: e.telegram_username },
      { key: "invite_url", label: "رابط الدعوة للقناة/الجروب الخاص (https://t.me/+...)", type: "url", value: e.invite_url },
      { key: "category_id", label: "التصنيف", type: "select", options: catOptions(e.entity_type, cats), value: e.category_id },
      { key: "relationship", label: "العلاقة بالمشروع", type: "select", options: REL, value: e.relationship },
      { key: "status", label: "الحالة", type: "select", options: STATUS, value: e.status },
      { key: "subscriber_count", label: "عدد المتابعين (يدوي للكيانات التي لا يزامنها البوت)", value: e.subscriber_count },
      { key: "is_featured", label: "مميّز", type: "toggle", value: e.is_featured }, { key: "is_new", label: "علامة «جديد»", type: "toggle", value: e.is_new },
      { key: "subscriber_count_hidden", label: "إخفاء العدد عن العامة", type: "toggle", value: e.subscriber_count_hidden },
    ], "حفظ", function (v) {
      return api("entity.update", Object.assign({ id: e.id }, v, { category_id: v.category_id || null, relationship: v.relationship || null,
        subscriber_count: v.subscriber_count === "" ? null : Number(v.subscriber_count) })).then(function () { toast("تم الحفظ."); screens.entities(); });
    }, rest);
  }

  function createSheet(cats) {
    formSheet("إضافة كيان يدويًا", [
      { key: "entity_type", label: "النوع", type: "chips", options: TYPE, value: "bot" },
      { key: "name", label: "الاسم" }, { key: "telegram_username", label: "اسم المستخدم (بدون @)", type: "url" },
      { key: "short_description", label: "وصف قصير" }, { key: "image_url", label: "رابط الصورة", type: "url" },
      { key: "relationship", label: "العلاقة بالمشروع", type: "select", options: REL },
      { key: "category_id", label: "التصنيف (يجب أن يطابق النوع)", type: "select", options: (function () { var o = {}; cats.filter(function (c) { return c.is_active; }).forEach(function (c) { o[c.id] = TYPE[c.entity_type] + " — " + c.label_ar; }); return o; })() },
    ], "إضافة ونشر", function (v) {
      return api("entity.create", Object.assign({}, v, { category_id: v.category_id || null, relationship: v.relationship || null }))
        .then(function () { toast("تمت الإضافة."); screens.entities(); });
    });
  }

  function previewSheet(e) {
    var s = openSheet("معاينة: " + e.name), box = h("div", {});
    s.appendChild(h("p", { class: "hint" }, "1) اضغط «بدء». 2) افتح البوت وأرسل له من 1 إلى 3 رسائل بالترتيب الذي تريده (نص/صورة/ألبوم/فيديو/صوت/ملف). 3) ارجع واضغط «حفظ المعاينة». تُستبدل المعاينة السابقة. لا تُحفظ أي صورة؛ مراجع فقط."));
    s.appendChild(box);
    function refresh() {
      api("preview.status").then(function (r) {
        replace(box, r.active ? [h("p", { class: "t" }, "الجلسة نشطة لـ «" + r.entity + "»: " + r.count + " من 3 رسائل"),
          r.items.map(function (i, n) { return h("div", { class: "mini-row" }, h("span", {}, (n + 1) + ". " + i.type + (i.album ? " (" + i.album + " صور)" : "")), h("span", {}, i.text)); })] : h("p", { class: "hint" }, "لا جلسة نشطة."));
      }, fail);
    }
    var row = h("div", { class: "sheet-actions", style: "margin-top:14px;flex-wrap:wrap" },
      h("button", { class: "btn-primary", type: "button", onclick: function () { api("preview.start", { entity_id: e.id }).then(function () { toast("ابدأ بإرسال الرسائل للبوت."); refresh(); }, fail); } }, "بدء"),
      h("button", { class: "btn-ghost", type: "button", onclick: refresh }, "تحديث"),
      h("button", { class: "btn-primary", type: "button", onclick: function () { api("preview.save").then(function (r) { toast("حُفظت المعاينة (" + r.saved + ")."); closeSheet(); }, fail); } }, "حفظ المعاينة"),
      h("button", { class: "btn-ghost", type: "button", onclick: function () { api("preview.cancel").then(function () { toast("أُلغيت الجلسة."); refresh(); }, fail); } }, "إلغاء"));
    s.appendChild(row); refresh();
  }

  function projectSheet(p) {
    formSheet(p ? "تعديل مشروع" : "إضافة مشروع / طلب مساعدة", [
      { key: "kind", label: "النوع", type: "chips", options: PROJ, value: p ? p.kind : "website" },
      { key: "name", label: "الاسم", value: p && p.name }, { key: "description", label: "وصف قصير", value: p && p.description },
      { key: "url", label: "الرابط (https://...) — لـ«ساعد»: الجهة التي تتم عبرها المساعدة", type: "url", value: p && p.url },
      { key: "image_url", label: "رابط الصورة", type: "url", value: p && p.image_url },
      { key: "expires_at", label: "تاريخ الانتهاء (لـ«ساعد» فقط، يختفي بعده تلقائيًا)", type: "date", value: p && p.expires_at },
    ], "حفظ", function (v) { return api("project.upsert", Object.assign({ id: p && p.id }, v)).then(function () { toast("تم الحفظ."); screens.content(); }); },
    p ? h("button", { class: "btn-ghost", type: "button", style: "margin-top:12px;width:100%", onclick: function () {
      api("project.toggle", { id: p.id, active: !p.is_active }).then(function () { toast("تم."); closeSheet(); screens.content(); }, fail); } }, p.is_active ? "إيقاف" : "تفعيل") : null);
  }
  function oppSheet(o) {
    formSheet(o ? "تعديل فرصة" : "إضافة فرصة مساهمة", [
      { key: "kind", label: "النوع", type: "chips", options: OPP, value: o ? o.kind : "publishing" },
      { key: "title", label: "ما المطلوب؟ (مثال: ناشر لقناة السيرة)", value: o && o.title },
      { key: "target_label", label: "القناة/البوت/الحساب المقصود (اختياري)", value: o && o.target_label },
      { key: "description", label: "تفاصيل (اختياري)", type: "textarea", value: o && o.description },
      { key: "apply_url", label: "رابط التقديم (اختياري) — وإلا يُحوَّل الزائر لنموذج التواصل", type: "url", value: o && o.apply_url },
      { key: "expires_at", label: "آخر موعد (اختياري)", type: "date", value: o && o.expires_at },
    ], "حفظ", function (v) { return api("opportunity.upsert", Object.assign({ id: o && o.id }, v)).then(function () { toast("تم الحفظ."); screens.content(); }); },
    o ? h("button", { class: "btn-ghost", type: "button", style: "margin-top:12px;width:100%", onclick: function () {
      api("opportunity.toggle", { id: o.id, active: !o.is_active }).then(function () { toast("تم."); closeSheet(); screens.content(); }, fail); } }, o.is_active ? "إيقاف" : "تفعيل") : null);
  }
  function socialSheet(s) {
    formSheet(s ? "تعديل حساب" : "إضافة حساب", [
      { key: "platform", label: "المنصة (WhatsApp, Instagram, TikTok...)", value: s && s.platform }, { key: "label", label: "الاسم المعروض", value: s && s.label },
      { key: "url", label: "الرابط", type: "url", value: s && s.url },
    ], "حفظ", function (v) { return api("social.upsert", Object.assign({ id: s && s.id }, v)).then(function () { toast("تم الحفظ."); screens.content(); }); },
    s ? h("button", { class: "btn-ghost", type: "button", style: "margin-top:12px;width:100%", onclick: function () {
      api("social.toggle", { id: s.id, active: !s.is_active }).then(function () { toast("تم."); closeSheet(); screens.content(); }, fail); } }, s.is_active ? "إيقاف" : "تفعيل") : null);
  }
  function catSheet(c) {
    formSheet(c ? "تعديل تصنيف" : "إضافة تصنيف", [
      { key: "entity_type", label: "النوع", type: "chips", options: TYPE, value: c ? c.entity_type : "channel" },
      { key: "label_ar", label: "الاسم", value: c && c.label_ar }, { key: "sort_order", label: "الترتيب (رقم)", value: c ? c.sort_order : 0 },
      { key: "is_active", label: "نشط", type: "toggle", value: c ? c.is_active : true },
    ], "حفظ", function (v) { state.cats = null; return api("category.upsert", Object.assign({ id: c && c.id }, v, { sort_order: Number(v.sort_order) || 0 })).then(function () { toast("تم الحفظ."); screens.content(); }); });
  }
  function settingsSheet() {
    api("settings.get").then(function (r) {
      var extra = r.hero_image_url ? h("img", { src: r.hero_image_url, alt: "", style: "width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-top:14px" }) : null;
      formSheet("إعدادات الموقع", [
        { key: "hero_image_url", label: "رابط صورة الواجهة (فارغ = الصورة الافتراضية داخل المشروع)", type: "url", value: r.hero_image_url },
        { key: "bot_users_total", label: "إجمالي مستخدمي بوتاتك (يدوي؛ تيليجرام لا يوفره)", value: r.bot_users_total },
      ], "حفظ", function (v) { return api("settings.set", { hero_image_url: v.hero_image_url, bot_users_total: v.bot_users_total }).then(function () { toast("تم الحفظ."); }); }, extra);
    }, fail);
  }
  function listSheet(title, action, fmt) {
    var s = openSheet(title);
    s.appendChild(empty("جارٍ التحميل…"));
    api(action).then(function (r) {
      replace(s, h("h3", {}, title), r.items.length ? r.items.map(function (i) { var f = fmt(i); return h("div", { class: "list-row answer", style: "cursor:default" }, h("div", { class: "t" }, f[0]), h("div", { class: "s" }, f[1])); }) : empty("لا شيء."),
        h("button", { class: "btn-ghost", type: "button", style: "margin-top:14px;width:100%", onclick: closeSheet }, "إغلاق"));
    }, function (e) { closeSheet(); fail(e); });
  }
  var IMPORT = {
    links: { label: "روابط (الأسهل)", example: "https://t.me/quran_hz1\nhttps://t.me/+AbCdEfGh12345678\nhttps://t.me/addstickers/MyPack\nhttps://t.me/my_bot\nhttps://instagram.com/xxxx",
      hint: "الصق الروابط كما هي (واحد في كل سطر أو متتابعة). يجلب النظام الاسم والوصف والعدد والصورة من صفحة كل رابط، ويحدد النوع (قناة/جروب/بوت/ملصقات) ويقترح التصنيف، وتُضاف حسابات التواصل. العلاقة تُضبط «من مشروعنا». راجع التصنيفات بعدها." },
    entities: { label: "قنوات وبوتات وجروبات وملصقات",
      example: "# النوع | الاسم | اسم المستخدم | التصنيف | العلاقة | وصف قصير\nقناة | قرآن بصوت متنوع | @quran_demo | قنوات محتوى القرآن متنوع | من مشروعنا | تلاوات مختارة\nبوت | بوت الأذكار | @azkar_demo_bot | قرآن | من مشروعنا\nملصقات | ملصقات دينية | PackShortName | ملصقات دينية | من مشروعنا",
      hint: "النوع: قناة/بوت/جروب/ملصقات. العلاقة: من مشروعنا / مساهمة / مدعوم. التصنيف بنفس اسمه في النظام. للملصقات اكتب اسم الحزمة (آخر جزء من رابط addstickers). الأسطر التي تبدأ بـ # تُتجاهل." },
    projects: { label: "مواقع ومشاريع وطلبات مساعدة",
      example: "# النوع | الاسم | الرابط | وصف | تاريخ الانتهاء (لساعد فقط)\nموقع | موقع مسبحتي | https://example.com | مسبحة إلكترونية\nمدعوم | مشروع تجريبي | https://example.org | وصف قصير",
      hint: "النوع: موقع / نساهم / مدعوم / ساعد." },
    social: { label: "حسابات التواصل", example: "# المنصة | الاسم | الرابط\nInstagram | أثر أواب | https://instagram.com/example", hint: "أضف حساباتك الحقيقية فقط." },
  };
  function importSheet() {
    var kind = "links", s = openSheet("استيراد قائمة جاهزة");
    var labels = {}; Object.keys(IMPORT).forEach(function (k) { labels[k] = IMPORT[k].label; });
    var hint = h("p", { class: "hint" }, IMPORT.links.hint);
    var ta = h("textarea", { class: "search-input", rows: "9", dir: "ltr", placeholder: IMPORT.links.example });
    var out = h("div", {});
    s.appendChild(chips(labels, kind, function (k) { kind = k; hint.textContent = IMPORT[k].hint; ta.placeholder = IMPORT[k].example; ta.dir = k === "links" ? "ltr" : "rtl"; }));
    s.appendChild(hint); s.appendChild(ta);
    var go = h("button", { class: "btn-primary", type: "button" }, "استيراد");
    function runLinks() {
      var urls = (ta.value.match(/https?:\/\/[^\s<>"'،,]+/g) || []).map(function (u) { return u.replace(/[)\].،,;]+$/, ""); });
      urls = urls.filter(function (u, i) { return urls.indexOf(u) === i; });
      if (!urls.length) { replace(out, empty("لم أجد روابط.")); return Promise.resolve(); }
      var done = 0, created = 0, rows = [];
      function paint() {
        replace(out, h("p", { class: "t" }, "تمت معالجة " + done + " من " + urls.length + " — أُضيف " + created),
          rows.map(function (r) {
            return h("div", { class: "mini-row" }, h("span", {}, [h("span", { class: "pill " + (r.status === "created" ? "ok" : r.status === "skipped" ? "" : "bad") }, r.status === "created" ? "أُضيف" : r.status === "skipped" ? "موجود" : "مرفوض"), r.name || r.url]),
              h("span", {}, r.status === "created" ? [r.type, r.category ? " — " + r.category : ""] : r.reason));
          }));
      }
      var chain = Promise.resolve();
      for (var i = 0; i < urls.length; i += 20) (function (chunk) {
        chain = chain.then(function () { return api("import.links", { urls: chunk }); }).then(function (r) {
          done += chunk.length; created += r.created; rows = rows.concat(r.report); paint();
        });
      })(urls.slice(i, i + 20));
      return chain;
    }
    go.addEventListener("click", function () {
      if (!ta.value.trim()) return;
      go.disabled = true; replace(out, empty("جارٍ الاستيراد…"));
      var job = kind === "links" ? runLinks() : api("import.run", { kind: kind, text: ta.value }).then(function (r) {
        replace(out, h("p", { class: "t" }, "أُضيف " + r.created + " عنصر، وتُخطّي " + r.skipped + " موجود مسبقًا" + (r.problems.length ? "، ورُفض " + r.problems.length + " سطر:" : ".")),
          r.problems.map(function (p) { return h("div", { class: "mini-row" }, h("span", {}, "سطر " + p.line), h("span", {}, p.reason)); }));
      });
      job.then(function () { state.cats = null; }, function (e) { replace(out, empty(ERR[e.code] || "تعذّر الاستيراد.")); }).then(function () { go.disabled = false; });
    });
    s.appendChild(h("div", { class: "sheet-actions", style: "margin-top:14px" }, go, h("button", { class: "btn-ghost", type: "button", onclick: closeSheet }, "إغلاق")));
    s.appendChild(out);
  }
  function usersSheet() {
    var s = openSheet("مستخدمو البوت"), out = h("div", {});
    var q = h("input", { class: "search-input", type: "search", placeholder: "المعرّف الرقمي أو اسم المستخدم أو الاسم" });
    function search() {
      api("users.search", { q: q.value }).then(function (r) {
        replace(out, r.items.length ? r.items.map(function (u) {
          return h("div", { class: "list-row", onclick: function () { userSheet(u); } }, h("div", { class: "t" }, [u.first_name || "", " ", u.last_name || ""]),
            h("div", { class: "s" }, ["@" + (u.username || "-"), " · " + u.telegram_user_id, " · إحالات " + u.referrals_count, u.has_badge ? " · شارة" : "", u.is_banned ? " · محظور" : ""]));
        }) : empty(q.value ? "لا نتائج." : "اكتب للبحث. تيليجرام لا يوفر قائمة كاملة بمستخدمي البوت؛ المسجلون هم من بدأوا محادثة معه."));
      }, fail);
    }
    var t; q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(search, 350); });
    s.appendChild(q); s.appendChild(out); search();
    s.appendChild(h("button", { class: "btn-ghost", type: "button", style: "margin-top:14px;width:100%", onclick: closeSheet }, "إغلاق"));
  }
  function userSheet(u) {
    formSheet("مستخدم: " + (u.first_name || u.telegram_user_id), [
      { key: "is_banned", label: "محظور من استعمال البوت (الحظر داخل المحادثات من أمر /globalban في البوت)", type: "toggle", value: u.is_banned },
      { key: "notes", label: "ملاحظات (للأدمن فقط)", type: "textarea", value: u.notes },
    ], "حفظ", function (v) { return api("user.update", { telegram_user_id: u.telegram_user_id, is_banned: v.is_banned, notes: v.notes }).then(function () { toast("تم الحفظ."); usersSheet(); }); });
  }

  function contactSheet() {
    var s = openSheet("رسائل التواصل");
    function load() {
      api("contact.list").then(function (r) {
        replace(s, h("h3", {}, "رسائل التواصل"), r.items.length ? r.items.map(function (m) {
          return h("div", { class: "list-row answer", style: "cursor:default" }, h("div", { class: "t" }, [m.is_read ? null : h("span", { class: "pill warn" }, "جديدة"), m.name || "بلا اسم"]),
            h("div", { class: "s" }, (m.contact ? m.contact + " · " : "") + date(m.created_at) + "\n" + m.message),
            h("div", { class: "row-actions" },
              h("button", { type: "button", onclick: function () { api("contact.mark", { id: m.id, read: !m.is_read }).then(load, fail); } }, m.is_read ? "اجعلها غير مقروءة" : "تمّت القراءة"),
              h("button", { type: "button", onclick: function () { if (confirm("حذف الرسالة نهائيًا؟")) api("contact.delete", { id: m.id }).then(load, fail); } }, "حذف")));
        }) : empty("لا رسائل."), h("button", { class: "btn-ghost", type: "button", style: "margin-top:14px;width:100%", onclick: closeSheet }, "إغلاق"));
      }, function (e) { closeSheet(); fail(e); });
    }
    replace(s, empty("جارٍ التحميل…")); load();
  }

  function jobsSheet() {
    var s = openSheet("المهام والمزامنة");
    var ST = { queued: "بالانتظار", running: "قيد التنفيذ", done: "تمّت", failed: "فشلت", cancelled: "أُلغيت" };
    function load() {
      api("jobs.list").then(function (r) {
        replace(s, h("h3", {}, "المهام والمزامنة"), h("p", { class: "hint" }, "طلبات المزامنة والبث التي يضعها الموقع وينفذها البوت. إن بقيت «بالانتظار» طويلًا فالبوت متوقف."),
          r.items.length ? r.items.map(function (j) {
            var res = j.result ? " · " + Object.keys(j.result).map(function (k) { return k + ": " + j.result[k]; }).join("، ") : "";
            return h("div", { class: "list-row", style: "cursor:default" }, h("div", { class: "t" }, [h("span", { class: "pill " + (j.status === "done" ? "ok" : j.status === "failed" ? "bad" : "") }, ST[j.status]), j.kind === "broadcast" ? "بث إعلان" : "مزامنة" + (j.payload && j.payload.entity_id ? " (كيان واحد)" : " (الكل)")]),
              h("div", { class: "s" }, date(j.created_at) + res + (j.error ? " · " + j.error : "")),
              j.status === "failed" || j.status === "queued" ? h("div", { class: "row-actions" }, j.status === "failed" ? h("button", { type: "button", onclick: function () { api("job.retry", { id: j.id }).then(load, fail); } }, "إعادة المحاولة") : null,
                j.status === "queued" ? h("button", { type: "button", onclick: function () { api("job.cancel", { id: j.id }).then(load, fail); } }, "إلغاء") : null) : null);
          }) : empty("لا مهام بعد."), h("button", { class: "btn-ghost", type: "button", style: "margin-top:14px;width:100%", onclick: closeSheet }, "إغلاق"));
      }, function (e) { closeSheet(); fail(e); });
    }
    replace(s, empty("جارٍ التحميل…")); load();
  }

  function syncLogSheet(e) {
    var s = openSheet("سجل مزامنة: " + e.name);
    api("entity.syncs", { entity_id: e.id }).then(function (r) {
      replace(s, h("h3", {}, "سجل مزامنة: " + e.name), r.items.length ? r.items.map(function (l) {
        return h("div", { class: "mini-row" }, h("span", {}, new Date(l.created_at).toLocaleString("en-GB")),
          h("span", {}, l.result === "error" ? "فشل: " + (l.error || "") : l.result === "changed" ? "تغيّر: " + (l.changed || []).join("، ") : "بلا تغيير"));
      }) : empty("لا سجل بعد. الكيانات بلا chat_id لا تُزامَن حتى يربطها البوت."), h("button", { class: "btn-ghost", type: "button", style: "margin-top:14px;width:100%", onclick: closeSheet }, "إغلاق"));
    }, function (er) { closeSheet(); fail(er); });
  }

  function adminsSheet() {
    var s = openSheet("المشرفون");
    var ROLE = { owner: "مالك (كل شيء)", admin: "أدمن (إعدادات ومستخدمون وبث)", editor: "محرر (محتوى وكيانات)" };
    function load() {
      api("admins.list").then(function (r) {
        replace(s, h("h3", {}, "المشرفون وصلاحياتهم"),
          r.items.map(function (a) {
            return h("div", { class: "list-row", style: "cursor:default" }, h("div", { class: "t" }, [h("span", { class: "pill " + (a.is_active ? "ok" : "bad") }, a.is_active ? "فعّال" : "موقوف"), a.name || a.telegram_user_id]),
              h("div", { class: "s" }, a.telegram_user_id + " · " + ROLE[a.role]),
              h("div", { class: "row-actions" }, h("button", { type: "button", onclick: function () { adminForm(a); } }, "تعديل"),
                h("button", { type: "button", onclick: function () { api("admin.toggle", { telegram_user_id: a.telegram_user_id, active: !a.is_active }).then(load, fail); } }, a.is_active ? "إيقاف" : "تفعيل")));
          }),
          h("button", { class: "send-btn", type: "button", style: "margin-top:14px", onclick: function () { adminForm(null); } }, "إضافة مشرف"),
          h("button", { class: "btn-ghost", type: "button", style: "width:100%", onclick: closeSheet }, "إغلاق"));
      }, function (e) { closeSheet(); fail(e.code === "forbidden" ? { code: "forbidden" } : e); });
    }
    function adminForm(a) {
      formSheet(a ? "تعديل مشرف" : "إضافة مشرف", [
        { key: "telegram_user_id", label: "المعرّف الرقمي في تيليجرام (يعرفه من @userinfobot)", value: a && a.telegram_user_id },
        { key: "name", label: "الاسم", value: a && a.name }, { key: "role", label: "الدور", type: "chips", options: ROLE, value: a ? a.role : "editor" },
      ], "حفظ", function (v) { return api("admin.upsert", { telegram_user_id: Number(v.telegram_user_id), name: v.name, role: v.role }).then(function () { toast("تم الحفظ."); adminsSheet(); }); });
    }
    replace(s, empty("جارٍ التحميل…")); load();
  }

  function broadcastSheet() {
    var s = openSheet("بث إعلان");
    api("broadcast.preview").then(function (p) {
      var ta = h("textarea", { class: "search-input", rows: "6", maxlength: "3500", placeholder: "نص الإعلان (نص عادي)" });
      var go = h("button", { class: "btn-primary", type: "button" }, "إرسال الإعلان");
      go.addEventListener("click", function () {
        if (ta.value.trim().length < 3) return;
        if (!confirm("سيُرسل هذا النص إلى " + p.count + " محادثة. متأكد؟")) return;
        go.disabled = true;
        api("broadcast.send", { text: ta.value }).then(function () { toast("وُضع البث في الطابور، وسيصلك تقرير من البوت."); closeSheet(); }, function (e) { go.disabled = false; fail(e); });
      });
      replace(s, h("h3", {}, "بث إعلان"),
        h("p", { class: "hint" }, p.count ? "سيصل إلى " + p.count + " قناة/جروب «من مشروعنا» يشرف عليها البوت" + (p.names.length ? " (منها: " + p.names.join("، ") + ")" : "") + ". يُرسل بمعدل آمن، ثم يصلك تقرير النجاح والفشل." : "لا توجد قنوات/جروبات «من مشروعنا» يشرف عليها البوت حاليًا. تأكد من العلاقة وصلاحية البوت."),
        ta, h("div", { class: "sheet-actions", style: "margin-top:14px" }, p.count ? go : null, h("button", { class: "btn-ghost", type: "button", onclick: closeSheet }, "إغلاق")));
    }, function (e) { closeSheet(); fail(e); });
  }

  function analyticsSheet(days) {
    var s = openSheet("الإحصاءات");
    api("analytics.get", { days: days }).then(function (r) {
      var delta = function (cur, prev) { return prev ? (cur >= prev ? "+" : "") + (Math.round((cur - prev) / prev * 1000) / 10) + "% عن الفترة السابقة" : "لا أساس للمقارنة"; };
      var max = Math.max.apply(null, [1].concat(r.daily.map(function (d) { return d.views; })));
      var list = function (items, key, val) { return items.length ? items.map(function (x) { return h("div", { class: "mini-row" }, h("span", {}, x[key]), h("span", {}, Number(x[val]).toLocaleString("en-US"))); }) : empty("لا بيانات بعد."); };
      replace(s, h("h3", {}, "الإحصاءات"),
        chips({ 7: "7 أيام", 30: "30 يومًا", 90: "90 يومًا" }, String(r.days), function (v) { analyticsSheet(Number(v)); }),
        h("div", { class: "stat-grid", style: "grid-template-columns:repeat(2,1fr)" },
          h("div", { class: "stat-box" }, h("div", { class: "n" }, Number(r.views).toLocaleString("en-US")), h("div", { class: "l" }, "زيارات الصفحات"), h("div", { class: "l" }, delta(r.views, r.views_prev))),
          h("div", { class: "stat-box" }, h("div", { class: "n" }, Number(r.clicks).toLocaleString("en-US")), h("div", { class: "l" }, "نقرات «انضم إلى تيليجرام»"), h("div", { class: "l" }, delta(r.clicks, r.clicks_prev)))),
        h("h3", { class: "section-title" }, "الزيارات يوميًا"),
        r.daily.length ? h("div", { class: "bars", role: "img", "aria-label": "الزيارات اليومية" }, r.daily.map(function (d) { return h("div", { class: "bar", title: d.day + ": " + d.views, style: "height:" + Math.max(4, Math.round(d.views / max * 100)) + "%" }); })) : empty("لا زيارات مسجلة بعد."),
        h("h3", { class: "section-title" }, "أكثر الصفحات"), list(r.top_pages, "path", "views"),
        h("h3", { class: "section-title" }, "أكثر الكيانات نقرًا"), list(r.top_entities, "name", "clicks"),
        h("h3", { class: "section-title" }, "بحث بلا نتائج (فرص محتوى)"), list(r.search_misses, "term", "hits"),
        h("p", { class: "hint" }, "الإحصاءات عدّادات يومية مجهولة بلا عناوين IP. لا تتضمن الدول أو الأجهزة في هذه النسخة."),
        h("button", { class: "btn-ghost", type: "button", style: "margin-top:10px;width:100%", onclick: closeSheet }, "إغلاق"));
    }, function (e) { closeSheet(); fail(e); });
  }

  // ---- البدء ----
  if (!initData) {
    replace(root, h("div", { class: "state-message full" }, "افتح هذه اللوحة من داخل تيليجرام عبر زر لوحة التحكم في البوت (/admin)."));
    return;
  }
  api("overview").then(function (d) { state.role = d._role; shell(); screens.overview(); },
    function (e) { replace(root, h("div", { class: "state-message full" }, ERR[e.code] || "تعذّر الاتصال بالخادم.")); });
})();
