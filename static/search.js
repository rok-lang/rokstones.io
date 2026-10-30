// Theme, header menu, stone search, copy buttons, install tabs.
// search-index.json: [{t: name, u: url, v: latest version, p: description}].
(() => {
  const root = document.body.dataset.root || "";
  const html = document.documentElement;
  let index = null;
  const load = () =>
    index ? Promise.resolve(index)
      : fetch(root + "search-index.json").then((r) => r.json()).then((d) => (index = d));

  // Theme: localStorage.theme is "light" or "dark"; unset follows the system.
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const stored = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
  const tb = document.querySelector(".theme");
  const seg = document.querySelectorAll(".seg button");
  const apply = () => {
    const s = stored();
    const d = s === "dark" || (s !== "light" && dark.matches);
    html.classList.toggle("dk", d);
    html.classList.toggle("lt", !d);
    if (tb) {
      tb.setAttribute("aria-pressed", d ? "true" : "false");
      tb.title = d ? "Dark theme on" : "Dark theme off";
    }
    const cur = s === "light" || s === "dark" ? s : "system";
    seg.forEach((b) => b.setAttribute("aria-pressed", b.dataset.theme === cur ? "true" : "false"));
  };
  const choose = (t) => {
    try { t === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", t); } catch {}
    apply();
  };
  if (tb) tb.addEventListener("click", () => choose(html.classList.contains("dk") ? "light" : "dark"));
  seg.forEach((b) => b.addEventListener("click", () => choose(b.dataset.theme)));
  dark.addEventListener("change", apply);
  apply();

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

  const copyButton = (text, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = "Copy";
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text().replace(/\n$/, ""));
        b.textContent = "Copied";
      } catch {
        b.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "Press ⌘C" : "Press Ctrl+C";
      }
      setTimeout(() => { b.textContent = "Copy"; }, 1600);
    });
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
    bar.append(label, copyButton(() => pre.innerText, "copy"));
    pre.replaceWith(fig);
    fig.append(bar, pre);
  }

  // Install boxes: tabs plus a copy button per panel.
  for (const p of document.querySelectorAll(".ipanel")) {
    const pre = p.querySelector("pre");
    p.append(copyButton(() => pre.innerText.replace(/^\$ /, ""), "copy"));
  }
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

  const match = (data, query) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const q = terms.join(" ");
    const hits = [];
    for (const e of data) {
      const t = e.t.toLowerCase();
      const hay = t + " " + e.p.toLowerCase();
      if (!terms.every((w) => hay.includes(w))) continue;
      hits.push([t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 3, e]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].t.localeCompare(b[1].t));
    return [hits.map((h) => h[1]), terms];
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
        a.href = root + e.u.replace(/\.html$/, "");
        const n = document.createElement("span");
        n.className = "n";
        n.append(...marked(e.t, terms));
        const v = document.createElement("span");
        v.className = "v";
        v.textContent = e.v;
        a.append(n, v);
        if (e.p) {
          const s = document.createElement("small");
          s.textContent = e.p;
          a.append(s);
        }
        li.append(a);
        box.append(li);
      });
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      if (!hits.length) {
        li.className = "empty";
        li.textContent = data.length ? "No stone matches." : "No stones published yet.";
        box.append(li);
      } else if (hits.length > MAX) {
        li.className = "all";
        li.textContent = `${hits.length} stones match. Press Enter to see all.`;
        box.append(li);
      }
      show(true);
      status.textContent = !hits.length ? "No stone matches" : hits.length === 1 ? "1 stone" : `${hits.length} stones`;
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
    document.addEventListener("keydown", (ev) => {
      const typing = ev.target.closest && ev.target.closest("input, textarea, select, [contenteditable]");
      const slash = ev.key === "/" && !typing && !ev.metaKey && !ev.ctrlKey;
      const k = ev.key.toLowerCase() === "k" && (ev.metaKey || ev.ctrlKey) && !ev.altKey && !ev.shiftKey;
      if (slash || k) { ev.preventDefault(); q.focus(); q.select(); }
    });

    // The full list, filtered by ?q=.
    const list = document.querySelector(".list-page .rows");
    const query = new URLSearchParams(location.search).get("q");
    if (list && query && query.trim()) {
      q.value = query;
      load().then((data) => {
        const [hits, terms] = match(data, query);
        const want = new Map(hits.map((e, k) => [e.t, k]));
        const rows = [...list.children];
        for (const li of rows) {
          const name = li.querySelector(".nm").textContent;
          li.hidden = !want.has(name);
          li.style.order = want.get(name) ?? 0;
          const nm = li.querySelector(".nm");
          nm.replaceChildren(...marked(name, terms));
        }
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.hidden = !hits.length;
        document.getElementById("no-match").hidden = hits.length > 0;
        const title = document.getElementById("list-title");
        title.textContent = "Search results";
        const note = document.getElementById("list-note");
        note.textContent = `${hits.length === 1 ? "1 stone matches" : hits.length + " stones match"} “${query.trim()}”, best match first. `;
        const all = document.createElement("a");
        all.href = location.pathname;
        all.textContent = "Show all stones";
        note.append(all);
        document.title = `Search results for ${query.trim()} - rokstones.io`;
      });
    }
  }
})();
