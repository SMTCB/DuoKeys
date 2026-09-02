/* ==========================================================================
   DuoKeys documentation — shared behaviour
   1. Auto-builds the sidebar TOC from h2/h3 in <main>
   2. Scrollspy highlighting
   3. Filter box — narrows TOC, requirement blocks and table rows by ID or text
   4. Auto-linkifies every DuoKeys ID (FR-, TA-, ADR-, US-, NFR-, RISK-) so the
      traceability chain is clickable across documents without hand-authoring
   5. Heading anchor links, theme toggle
   ========================================================================== */
(function () {
  "use strict";

  var main = document.querySelector("main");
  var body = document.body;
  var THIS_DOC = body.getAttribute("data-doc") || "";

  /* ---------------------------------------------------- 4. ID auto-linking */
  // Where each ID family is defined. Keep in sync with docs/00-INDEX.md.
  var TARGET = {
    ADR: "architecture.html",
    TA: "architecture.html",
    NFR: "architecture.html",
    RISK: "architecture.html",
    FR: "functional.html",
    US: "sprints.html"
  };
  var ID_RE = /\b(?:ADR-\d{3}|NFR-\d{3}|RISK-\d{3}|TA-[A-Z]{3}-\d{3}|FR-[A-Z]{3}-\d{3}|US-\d\.\d{2})\b/g;

  function familyOf(id) { return id.split("-")[0]; }

  function linkify(root) {
    var SKIP = { PRE: 1, CODE: 1, A: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, H1: 1, OPTION: 1 };
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
          // never linkify the ID inside its own definition heading
          if (p.classList && p.classList.contains("aid")) return NodeFilter.FILTER_REJECT;
        }
        return ID_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var text = node.nodeValue, last = 0, m;
      ID_RE.lastIndex = 0;
      while ((m = ID_RE.exec(text)) !== null) {
        var id = m[0], file = TARGET[familyOf(id)];
        if (!file) continue;
        if (last < m.index) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement("a");
        a.className = "ref";
        a.href = (file === THIS_DOC ? "" : file) + "#" + id;
        a.textContent = id;
        a.title = (file === THIS_DOC ? "Jump to " : "Open in " + file.replace(".html", "") + " — ") + id;
        frag.appendChild(a);
        last = m.index + id.length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  if (main) linkify(main);

  /* ------------------------------------------------------------- 1. TOC */
  var toc = document.getElementById("toc");
  var heads = main ? Array.prototype.slice.call(main.querySelectorAll("h2[id], h3[id]")) : [];

  if (toc && heads.length) {
    heads.forEach(function (h) {
      var a = document.createElement("a");
      a.href = "#" + h.id;
      if (h.tagName === "H3") {
        a.className = "lv3";
        var aid = h.querySelector(".aid");
        var label = h.getAttribute("data-toc") || h.textContent.replace(/¶/g, "").trim();
        if (aid) {
          var em = document.createElement("em");
          em.textContent = aid.textContent.trim();
          a.appendChild(em);
          label = label.replace(aid.textContent.trim(), "").replace(/^[\s—–-]+/, "");
        }
        a.appendChild(document.createTextNode(label));
      } else {
        a.className = "sec";
        a.textContent = (h.getAttribute("data-toc") || h.textContent).replace(/¶/g, "").trim();
      }
      a.setAttribute("data-t", a.textContent.toLowerCase());
      toc.appendChild(a);
    });

    /* ------------------------------------------------------ 2. scrollspy */
    var links = {};
    Array.prototype.forEach.call(toc.querySelectorAll("a"), function (a) {
      links[decodeURIComponent(a.getAttribute("href").slice(1))] = a;
    });
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id);
      });
      var first = heads.find(function (h) { return visible.has(h.id); });
      Array.prototype.forEach.call(toc.querySelectorAll("a.on"), function (a) { a.classList.remove("on"); });
      if (first && links[first.id]) {
        links[first.id].classList.add("on");
        var r = links[first.id].getBoundingClientRect(), rr = toc.parentNode.getBoundingClientRect();
        if (r.top < rr.top || r.bottom > rr.bottom) links[first.id].scrollIntoView({ block: "nearest" });
      }
    }, { rootMargin: "-10% 0px -70% 0px", threshold: 0 });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* --------------------------------------------------- 5. heading anchors */
  heads.forEach(function (h) {
    var a = document.createElement("a");
    a.className = "anch"; a.href = "#" + h.id; a.textContent = "#";
    a.setAttribute("aria-label", "Link to this section");
    a.addEventListener("click", function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href.split("#")[0] + "#" + h.id).catch(function () {});
      }
    });
    h.appendChild(a);
  });

  /* ------------------------------------------------------------ 3. filter */
  var box = document.getElementById("filter");
  var meta = document.getElementById("filterMeta");
  var empty = document.querySelector(".empty");

  if (box) {
    // Blocks that can be filtered: requirement cards, sprint blocks, table rows.
    var reqs = main ? Array.prototype.slice.call(main.querySelectorAll(".req")) : [];
    var rows = main ? Array.prototype.slice.call(main.querySelectorAll("tbody tr")) : [];

    function apply() {
      var q = box.value.trim().toLowerCase();
      var shownReq = 0, shownRow = 0;

      reqs.forEach(function (r) {
        var hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.classList.toggle("hide", !hit);
        if (hit) shownReq++;
      });
      rows.forEach(function (r) {
        var hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.classList.toggle("hide", !hit);
        if (hit) shownRow++;
      });
      if (toc) {
        Array.prototype.forEach.call(toc.querySelectorAll("a"), function (a) {
          a.classList.toggle("hide", !!q && a.getAttribute("data-t").indexOf(q) === -1);
        });
      }

      if (!q) {
        if (meta) meta.textContent = "";
        if (empty) empty.classList.remove("on");
        return;
      }
      var bits = [];
      if (reqs.length) bits.push(shownReq + "/" + reqs.length + " entries");
      if (rows.length) bits.push(shownRow + "/" + rows.length + " rows");
      if (meta) meta.textContent = bits.join(" · ");
      if (empty) empty.classList.toggle("on", shownReq === 0 && shownRow === 0);
    }

    box.addEventListener("input", apply);
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { box.value = ""; apply(); box.blur(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== box && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); box.focus(); box.select();
      }
    });
    // deep link: architecture.html?q=tolerance
    var q0 = new URLSearchParams(location.search).get("q");
    if (q0) { box.value = q0; apply(); }
  }

  /* ------------------------------------------------------- theme toggle */
  var btn = document.getElementById("themeBtn");
  if (btn) {
    var stored = null;
    try { stored = localStorage.getItem("duokeys-theme"); } catch (e) {}
    if (stored === "dark" || stored === "light") document.documentElement.setAttribute("data-theme", stored);
    function label() {
      var t = document.documentElement.getAttribute("data-theme");
      btn.textContent = t === "dark" ? "dark" : t === "light" ? "light" : "auto";
    }
    label();
    btn.addEventListener("click", function () {
      var t = document.documentElement.getAttribute("data-theme");
      var next = t === "dark" ? "light" : t === "light" ? null : "dark";
      if (next) document.documentElement.setAttribute("data-theme", next);
      else document.documentElement.removeAttribute("data-theme");
      try { next ? localStorage.setItem("duokeys-theme", next) : localStorage.removeItem("duokeys-theme"); } catch (e) {}
      label();
    });
  }

  /* --------------------------------- highlight a deep-linked ID on arrival */
  function flash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var t = el.closest(".req") || el.closest("tr") || el;
    t.style.transition = "background-color .5s";
    t.style.backgroundColor = "var(--brass-soft)";
    setTimeout(function () { t.style.backgroundColor = ""; }, 1400);
  }
  window.addEventListener("hashchange", flash);
  if (location.hash) setTimeout(flash, 60);
})();
