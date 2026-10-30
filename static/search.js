// Header menu, stone search, code block bars, install tabs. The theme
// is theme.js, the search shortcut keys.js and Copy copy.js, from the
// web kit.
// search-index.json: [{t: name, u: canonical path, v: latest version, p: description, k: keywords}].
(() => {
  let index = null;
  const load = () =>
    index ? Promise.resolve(index)
      : fetch("/search-index.json").then((r) => r.json()).then((d) => (index = d));

  // Narrow header: the menu button shows the nav below.
  const hdr = document.querySelector(".hdr");
  const menu = document.querySelector(".hdr .menu");
  if (hdr && menu) {
    const set = (open) => {
      hdr.classList.toggle("open", open);
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    };
    menu.addEventListener("click", () => set(!hdr.classList.contains("open")));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && hdr.classList.contains("open")) { set(false); menu.focus(); }
    });
  }

  // A Copy button for copy.js (the web kit), as chrome::copy_button writes it.
  const copyButton = (text) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-2 btn-sm copy";
    b.dataset.copy = text;
    b.setAttribute("aria-label", "Copy");
    b.textContent = "Copy";
    return b;
  };

  // Code blocks in readmes and the guide: a bar with the language and Copy.
  for (const pre of document.querySelectorAll(".md pre")) {
    const lang = (pre.querySelector("code")?.className.match(/language-(\w+)/) || [])[1] || "";
    const fig = document.createElement("figure");
    fig.className = "cb";
    const bar = document.createElement("div");
    bar.className = "cb-h";
    const label = document.createElement("span");
    label.className = "t-label";
    label.textContent = lang && lang !== "text" ? lang : "";
    bar.append(label, copyButton(pre.textContent.replace(/\n$/, "")));
    pre.replaceWith(fig);
    fig.append(bar, pre);
  }

  // Install boxes: tabs (their Copy buttons are the page's own).
  for (const box of document.querySelectorAll(".inst")) {
    const tabs = [...box.querySelectorAll(".itabs [role=tab]")];
    const pick = (t, focus) => {
      for (const x of tabs) {
        const on = x === t;
        x.setAttribute("aria-selected", on ? "true" : "false");
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute("aria-controls")).classList.toggle("on", on);
      }
      if (focus) t.focus();
    };
    tabs.forEach((t, k) => {
      t.addEventListener("click", () => pick(t, false));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); pick(tabs[(k + d + tabs.length) % tabs.length], true); }
      });
    });
  }

  // Stone tabs: keep the current one in view, fade an edge with more beyond.
  const bar = document.querySelector(".stone-head .tabs");
  if (bar) {
    const cur = bar.querySelector("[aria-current]");
    if (cur) {
      // 40px: clear of the fade.
      const a = cur.getBoundingClientRect(), b = bar.getBoundingClientRect();
      if (a.right > b.right - 40) bar.scrollLeft += a.right - b.right + 40;
    }
    const edges = () => {
      const max = bar.scrollWidth - bar.clientWidth;
      bar.classList.toggle("more-l", bar.scrollLeft > 1);
      bar.classList.toggle("more-r", bar.scrollLeft < max - 1);
    };
    bar.addEventListener("scroll", edges, { passive: true });
    addEventListener("resize", edges);
    edges();
  }

  // 404.html: name the missing path.
  const lost = document.getElementById("lost-path");
  if (lost) lost.textContent = location.pathname;

  // Every term must be in the name, the description or a keyword; `why`
  // says where they were found. layout.rok's search ranks the same way.
  const match = (data, query) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const q = terms.join(" ");
    const hits = [];
    for (const e of data) {
      const t = e.t.toLowerCase();
      const p = e.p.toLowerCase();
      const ks = (e.k || []).map((k) => k.toLowerCase());
      const inKw = (w) => ks.some((k) => k.includes(w));
      if (!terms.every((w) => t.includes(w) || p.includes(w) || inKw(w))) continue;
      const where = [];
      if (terms.some((w) => t.includes(w))) where.push("name");
      if (terms.some((w) => p.includes(w))) where.push("description");
      if (terms.some(inKw)) where.push("keywords");
      e.why = where.length === 3 ? "name, description and keywords" : where.join(" and ");
      hits.push([t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : ks.includes(q) ? 3 : 4, e]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].t.localeCompare(b[1].t));
    return [hits.map((h) => h[1]), terms];
  };

  // The part of a description worth showing in one line: from a little
  // before the first matched term when it would be cut off.
  const snippet = (text, terms) => {
    const lo = text.toLowerCase();
    let at = -1;
    for (const w of terms) {
      const k = lo.indexOf(w);
      if (k >= 0 && (at < 0 || k < at)) at = k;
    }
    if (at < 48) return text;
    const from = text.lastIndexOf(" ", at - 20);
    return "..." + text.slice(from < 0 ? at - 20 : from + 1);
  };

  // `text` as nodes, each term wrapped in <mark>.
  const marked = (text, terms) => {
    const words = terms.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) return [document.createTextNode(text)];
    const re = new RegExp(`(${words.join("|")})`, "gi");
    return text.split(re).map((part, k) => {
      if (k % 2 === 0) return document.createTextNode(part);
      const m = document.createElement("mark");
      m.textContent = part;
      return m;
    });
  };

  // Header search: a combobox over the index; Enter without a pick opens
  // the full list filtered (stones/?q=).
  const form = document.querySelector(".hdr .search");
  if (form) {
    const q = form.querySelector(".q");
    const box = form.querySelector(".results");
    const status = form.querySelector("[role=status]");
    const MAX = 8;
    let sel = -1;
    const opts = () => [...box.querySelectorAll("[role=option]")];
    const mark = (i) => {
      const as = opts();
      as.forEach((a, k) => a.setAttribute("aria-selected", k === i ? "true" : "false"));
      sel = i;
      if (as[i]) {
        q.setAttribute("aria-activedescendant", as[i].id);
        as[i].scrollIntoView({ block: "nearest" });
      } else {
        q.removeAttribute("aria-activedescendant");
      }
    };
    const show = (on) => {
      box.hidden = !on;
      q.setAttribute("aria-expanded", on ? "true" : "false");
      if (!on) { q.removeAttribute("aria-activedescendant"); sel = -1; }
    };
    const search = async () => {
      const query = q.value.trim();
      if (!query) { show(false); status.textContent = ""; return; }
      const data = await load();
      const [hits, terms] = match(data, query);
      box.replaceChildren();
      hits.slice(0, MAX).forEach((e, k) => {
        const li = document.createElement("li");
        li.setAttribute("role", "none");
        const a = document.createElement("a");
        a.id = "results-" + k;
        a.setAttribute("role", "option");
        a.tabIndex = -1;
        a.href = e.u;
        const n = document.createElement("span");
        n.className = "n";
        n.append(...marked(e.t, terms));
        const v = document.createElement("span");
        v.className = "v";
        v.textContent = e.v;
        const vw = document.createElement("span");
        vw.className = "vw";
        const why = document.createElement("span");
        why.className = "why";
        why.textContent = "in " + e.why;
        vw.append(why, v);
        a.append(n, vw);
        if (e.p) {
          const s = document.createElement("small");
          s.append(...marked(snippet(e.p, terms), terms));
          a.append(s);
        }
        li.append(a);
        box.append(li);
      });
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      if (!hits.length) {
        li.className = "empty";
        li.textContent = data.length ? "No stones match." : "No stones published yet.";
        box.append(li);
      } else if (hits.length > MAX) {
        li.className = "all";
        li.textContent = `${hits.length} stones match. Press Enter to see all.`;
        box.append(li);
      }
      show(true);
      status.textContent = !hits.length ? "No stones match" : hits.length === 1 ? "1 stone" : `${hits.length} stones`;
      mark(-1);
    };
    q.addEventListener("focus", load, { once: true });
    q.addEventListener("input", search);
    q.addEventListener("keydown", (ev) => {
      const n = opts().length;
      if (ev.key === "ArrowDown" && n) { ev.preventDefault(); mark((sel + 1) % n); }
      else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); mark((sel - 1 + n) % n); }
      else if (ev.key === "Enter" && opts()[sel]) { ev.preventDefault(); location.href = opts()[sel].href; }
      else if (ev.key === "Escape") { if (!box.hidden) show(false); else q.blur(); }
    });
    document.addEventListener("click", (ev) => { if (!form.contains(ev.target)) show(false); });

    // The full list is filtered and sorted by the server (?q=, ?sort=);
    // a new order applies as soon as it is picked.
    const sort = document.getElementById("list-sort");
    if (sort) sort.addEventListener("change", () => sort.form.submit());
  }
})();
