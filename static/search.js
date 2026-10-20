// Client-side stone search over search-index.json:
// [{t: name, u: url, v: latest version, p: description}].
(() => {
  const root = document.body.dataset.root || "";
  let index = null;

  const load = () =>
    index ? Promise.resolve(index)
      : fetch(root + "search-index.json").then((r) => r.json()).then((d) => (index = d));

  // A copy button on each code block.
  for (const pre of document.querySelectorAll(".meta pre, article pre:not(.err)")) {
    const wrap = document.createElement("div");
    wrap.className = "code";
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
    wrap.append(b);
  }

  // Theme button: auto (the system setting) → light → dark. The choice
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

  // 404.html: name the missing path in the error.
  const lost = document.getElementById("lost-path");
  if (lost) lost.textContent = location.pathname;

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
        a.textContent = e.t + " ";
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
