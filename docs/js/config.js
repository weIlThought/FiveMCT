// API base (set to your backend URL)
const API_BASE = "https://fivemct.onrender.com/api";

// mark active nav link based on current filename
(function () {
  function setActive() {
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".sidebar a").forEach((a) => {
      let href = a.getAttribute("href") || "";
      if (
        href === path ||
        (href === "./index.html" && (path === "" || path === "index.html"))
      ) {
        a.classList.add("active");
      } else {
        a.classList.remove("active");
      }
    });
  }
  document.addEventListener("DOMContentLoaded", setActive);
})();
