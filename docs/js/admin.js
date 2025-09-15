document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const loginStatus = document.getElementById("loginStatus");
  const adminPass = document.getElementById("adminPass");
  const adminPanel = document.getElementById("adminPanel");
  const subsTbody = document.querySelector("#subsTable tbody");

  let token = null;

  loginBtn &&
    loginBtn.addEventListener("click", async () => {
      loginStatus.textContent = "Logging in...";
      try {
        const res = await fetch(API_BASE + "/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPass.value }),
        });
        const j = await res.json();
        if (j.ok && j.token) {
          token = j.token;
          loginStatus.textContent = "Eingeloggt";
          document.getElementById("loginBox").style.display = "none";
          adminPanel.style.display = "block";
          loadAdmin();
        } else {
          loginStatus.textContent = "Login fehlgeschlagen";
        }
      } catch (e) {
        loginStatus.textContent = "Fehler";
      }
    });

  async function loadAdmin() {
    try {
      const res = await fetch(API_BASE + "/admin/logs", {
        headers: { Authorization: "Bearer " + token },
      });
      const j = await res.json();
      if (!j.ok) {
        subsTbody.innerHTML = '<tr><td colspan="4">Auth required</td></tr>';
        return;
      }
      const subs = j.submissions || [];
      subsTbody.innerHTML = subs
        .map(
          (s) => `<tr><td>${s.id}</td><td>${escapeHtml(
            s.name
          )}</td><td>${escapeHtml(s.message)}</td><td>
        <button data-id="${s.id}" class="pub">${
            s.published ? "Unpublish" : "Publish"
          }</button>
        <button data-id="${
          s.id
        }" class="del" style="margin-left:8px">Delete</button></td></tr>`
        )
        .join("");
      Array.from(document.querySelectorAll(".pub")).forEach((b) =>
        b.addEventListener("click", togglePub)
      );
      Array.from(document.querySelectorAll(".del")).forEach((b) =>
        b.addEventListener("click", delSub)
      );
    } catch (e) {
      subsTbody.innerHTML = '<tr><td colspan="4">Error loading</td></tr>';
    }
  }

  async function togglePub(e) {
    const id = e.currentTarget.dataset.id;
    const publish = e.currentTarget.textContent.trim() === "Publish";
    await fetch(API_BASE + "/admin/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ id, publish }),
    });
    loadAdmin();
  }
  async function delSub(e) {
    if (!confirm("Delete this submission?")) return;
    const id = e.currentTarget.dataset.id;
    await fetch(API_BASE + "/admin/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ id }),
    });
    loadAdmin();
  }
});
function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
