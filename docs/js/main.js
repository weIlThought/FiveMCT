document.getElementById("reportForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target).entries());
  const r = await fetch(API_BASE + "/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  });
  document.getElementById("response").textContent = JSON.stringify(
    await r.json()
  );
});
