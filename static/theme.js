// Before first paint: the theme cookie, else localStorage.theme, else the
// system setting.
try {
  let t = (document.cookie.match(/(?:^|; )theme=(light|dark)(?:;|$)/) || [])[1] || localStorage.getItem("theme");
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.className = "rk " + (t === "dark" ? "dk" : "lt") + " js";
} catch (e) { document.documentElement.className = "rk lt js"; }
