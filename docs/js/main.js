async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  const recent = document.getElementById("recentList");
  if (recent) {
    fetchJSON(API_BASE + "/public/submissions")
      .then((j) => {
        if (j && j.ok && j.submissions.length) {
          recent.innerHTML = j.submissions
            .slice(0, 5)
            .map(
              (s) =>
                `<div class="card"><h3>${escapeHtml(
                  s.name
                )}</h3><p>${escapeHtml(
                  s.message
                )}</p><div style="font-size:12px;color:var(--muted)">${new Date(
                  s.createdAt
                ).toLocaleString()}</div></div>`
            )
            .join("");
          document.getElementById("total").textContent = j.submissions.length;
        } else {
          recent.innerHTML =
            '<div class="card"><p style="color:var(--muted)">Keine veröffentlichten Beiträge</p></div>';
        }
      })
      .catch(() => {
        recent.innerHTML =
          '<div class="card"><p style="color:var(--muted)">Fehler beim Laden</p></div>';
      });
  }

  const form = document.getElementById("reportForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const status = document.getElementById("response");
      status.textContent = "Sende...";
      try {
        const res = await fetch(API_BASE + "/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const j = await res.json();
        if (j.ok) {
          status.textContent =
            "Danke — dein Report wurde eingereicht und wartet auf Moderation.";
          form.reset();
        } else status.textContent = "Fehler: " + (j.error || "Unbekannt");
      } catch (err) {
        status.textContent = "Netzwerkfehler";
      }
      setTimeout(() => (status.textContent = ""), 4000);
    });
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
