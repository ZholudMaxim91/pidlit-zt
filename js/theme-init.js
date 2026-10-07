// Встановлює тему до відмалювання сторінки, щоб не було «спалаху» світлої теми.
(function () {
  var theme = null;
  try { theme = localStorage.getItem("zt-theme"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
