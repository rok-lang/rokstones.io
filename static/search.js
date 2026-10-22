// Client-side stone search over search-index.json:
// [{t: name, u: url, v: latest version, p: description}].
(() => {
  const root = document.body.dataset.root || "";
  let index = null;

  const load = () =>
    index ? Promise.resolve(index)
      : fetch(root + "search-index.json").then((r) => r.json()).then((d) => (index = d));

  // A copy button on each code block; article blocks get a macOS-style
  // title bar (traffic lights + language), the sidebar snippets stay plain.
  for (const pre of document.querySelectorAll(".meta pre, article pre:not(.err)")) {
    const wrap = document.createElement("div");
    wrap.className = "code";
    const tools = document.createElement("div");
    tools.className = "code-tools";
    const lang = (pre.querySelector("code")?.className.match(/language-(\w+)/) || [])[1];
    if (lang && lang !== "text" && !pre.closest(".meta")) wrap.dataset.lang = lang;
    pre.replaceWith(wrap);
    wrap.append(pre);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "copy";
    b.textContent = "copy";
    b.setAttribute("aria-label", "Copy code");
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
        b.textContent = "copied ✓";
      } catch {
        b.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "press ⌘C" : "press Ctrl+C";
      }
      b.classList.add("done");
      setTimeout(() => { b.textContent = "copy"; b.classList.remove("done"); }, 1600);
    });
    tools.append(b);
    if (wrap.dataset.lang) {
      const head = document.createElement("div");
      head.className = "code-head";
      const lights = document.createElement("span");
      lights.className = "lights";
      lights.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 3; i++) lights.append(document.createElement("i"));
      const title = document.createElement("span");
      title.className = "code-title";
      title.textContent = wrap.dataset.lang;
      head.append(lights, title, tools);
      wrap.prepend(head);
    } else {
      wrap.append(tools);
    }
  }

  // Theme button: auto (the system setting) -> light -> dark. The choice
  // is this reader's alone, so it lives in localStorage; the inline
  // script in <head> applies it before the page paints.
  const tb = document.querySelector(".theme");
  if (tb) {
    const order = ["auto", "light", "dark"];
    const glyph = { auto: "◐", light: "☀", dark: "☾" };
    const get = () => { try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; } };
    const show = (t) => {
      tb.textContent = glyph[t];
      tb.setAttribute("aria-label", `Theme: ${t}`);
      tb.title = `Theme: ${t}`;
    };
    show(get());
    tb.addEventListener("click", () => {
      const t = order[(order.indexOf(get()) + 1) % order.length];
      try { t === "auto" ? localStorage.removeItem("theme") : localStorage.setItem("theme", t); } catch {}
      if (t === "auto") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = t;
      show(t);
    });
  }

  // Compact header: the hamburger opens the nav as a drop panel. It
  // closes on a link, an outside click, Escape, or a return to the full nav.
  const top = document.querySelector(".top");
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("nav");
  if (top && navToggle && nav) {
    const setNav = (open) => {
      top.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    navToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setNav(!top.classList.contains("nav-open"));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
    document.addEventListener("click", (e) => {
      if (top.classList.contains("nav-open") && !e.target.closest(".nav-toggle, #nav")) setNav(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && top.classList.contains("nav-open")) { setNav(false); navToggle.focus(); }
    });
    // Collapse exactly when the full nav would not fit on one row: measure
    // the natural width with the row forced not to wrap or shrink. Works
    // for any number of links, so there is no per-page width breakpoint.
    const fitNav = () => {
      top.classList.remove("nav-compact");
      top.classList.add("nav-measuring");
      const overflow = top.scrollWidth > top.clientWidth + 1;
      top.classList.remove("nav-measuring");
      if (overflow) top.classList.add("nav-compact");
      else setNav(false);
    };
    fitNav();
    addEventListener("resize", fitNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
  }

  // 404.html: name the missing path in the error.
  const lost = document.getElementById("lost-path");
  if (lost) lost.textContent = location.pathname;

  // `text` as nodes, each search term in it wrapped in <mark>.
  const marked = (text, terms) => {
    const words = terms.filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) return [document.createTextNode(text)];
    const re = new RegExp(`(${words.join("|")})`, "gi");
    return text.split(re).map((part, k) => {
      if (k % 2 === 0) return document.createTextNode(part);
      const m = document.createElement("mark");
      m.textContent = part;
      return m;
    });
  };

  const emptyText = (data) => (data.length ? "No results" : "No stones published yet");

  const boxes = [...document.querySelectorAll(".search")];

  for (const wrap of boxes) {
    const q = wrap.querySelector(".q");
    const box = wrap.querySelector(".results");
    const status = wrap.querySelector("[role=status]");
    let sel = -1;
    const links = () => [...box.querySelectorAll("a")];

    const mark = (i) => {
      const as = links();
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
      if (!on) q.removeAttribute("aria-activedescendant");
    };

    const search = async () => {
      const query = q.value.trim().toLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      if (!terms.length) { show(false); status.textContent = ""; return; }
      const data = await load();
      const hits = [];
      for (const e of data) {
        const t = e.t.toLowerCase();
        const hay = t + " " + e.p.toLowerCase();
        if (!terms.every((w) => hay.includes(w))) continue;
        hits.push([t === query ? 0 : t.startsWith(query) ? 1 : t.includes(query) ? 2 : 3, e]);
      }
      hits.sort((a, b) => a[0] - b[0] || a[1].t.localeCompare(b[1].t));
      box.replaceChildren();
      hits.slice(0, 40).forEach(([, e], k) => {
        const li = document.createElement("li");
        li.setAttribute("role", "none");
        const a = document.createElement("a");
        a.id = box.id + "-" + k;
        a.setAttribute("role", "option");
        a.tabIndex = -1;
        a.href = root + e.u;
        a.append(...marked(e.t, terms), " ");
        const v = document.createElement("code");
        v.textContent = e.v;
        a.append(v);
        if (e.p) {
          const s = document.createElement("small");
          s.textContent = e.p;
          a.append(s);
        }
        li.append(a);
        box.append(li);
      });
      if (!hits.length) {
        const li = document.createElement("li");
        li.setAttribute("role", "none");
        li.className = "empty";
        li.textContent = emptyText(data);
        box.append(li);
      }
      show(true);
      status.textContent = !hits.length ? emptyText(data) : hits.length > 40 ? `40 of ${hits.length} results shown` : hits.length === 1 ? "1 result" : `${hits.length} results`;
      mark(hits.length ? 0 : -1);
    };

    q.addEventListener("focus", load, { once: true });
    q.addEventListener("input", search);
    q.addEventListener("keydown", (ev) => {
      const n = links().length;
      if (ev.key === "ArrowDown" && n) { ev.preventDefault(); mark((sel + 1) % n); }
      else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); mark((sel - 1 + n) % n); }
      else if (ev.key === "Enter" && links()[sel]) { location.href = links()[sel].href; }
      else if (ev.key === "Escape") { show(false); q.blur(); }
    });
    document.addEventListener("click", (ev) => {
      if (!wrap.contains(ev.target)) show(false);
    });
  }

  document.addEventListener("keydown", (ev) => {
    const q = boxes.length && boxes[0].querySelector(".q");
    const typing = ev.target.closest && ev.target.closest("input, textarea");
    if (ev.key === "/" && q && !typing) { ev.preventDefault(); q.focus(); }
  });
})();
