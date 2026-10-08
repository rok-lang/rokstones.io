// Client-side stone search over search-index.json:
// [{t: name, u: url, v: latest version, p: description}].
(() => {
  const root = document.body.dataset.root || "";
  let index = null;

  const load = () =>
    index ? Promise.resolve(index)
      : fetch(root + "search-index.json").then((r) => r.json()).then((d) => (index = d));

  const boxes = [...document.querySelectorAll(".search")];

  for (const wrap of boxes) {
    const q = wrap.querySelector(".q");
    const box = wrap.querySelector(".results");
    let sel = -1;
    const links = () => [...box.querySelectorAll("a")];

    const mark = (i) => {
      const as = links();
      as.forEach((a, k) => a.classList.toggle("sel", k === i));
      sel = i;
      if (as[i]) as[i].scrollIntoView({ block: "nearest" });
    };

    const search = async () => {
      const query = q.value.trim().toLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      if (!terms.length) { box.hidden = true; return; }
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
      for (const [, e] of hits.slice(0, 40)) {
        const li = document.createElement("li");
        const a = document.createElement("a");
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
      }
      if (!hits.length) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = data.length ? "결과 없음" : "아직 publish 된 stone 이 없습니다";
        box.append(li);
      }
      box.hidden = false;
      mark(hits.length ? 0 : -1);
    };

    q.addEventListener("focus", load, { once: true });
    q.addEventListener("input", search);
    q.addEventListener("keydown", (ev) => {
      const n = links().length;
      if (ev.key === "ArrowDown" && n) { ev.preventDefault(); mark((sel + 1) % n); }
      else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); mark((sel - 1 + n) % n); }
      else if (ev.key === "Enter" && links()[sel]) { location.href = links()[sel].href; }
      else if (ev.key === "Escape") { box.hidden = true; q.blur(); }
    });
    document.addEventListener("click", (ev) => {
      if (!wrap.contains(ev.target)) box.hidden = true;
    });
  }

  document.addEventListener("keydown", (ev) => {
    const q = boxes.length && boxes[0].querySelector(".q");
    const typing = ev.target.closest && ev.target.closest("input, textarea");
    if (ev.key === "/" && q && !typing) { ev.preventDefault(); q.focus(); }
  });
})();
