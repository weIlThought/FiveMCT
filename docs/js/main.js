document.getElementById("submitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  try {
    const res = await fetch(`${API_BASE}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    document.getElementById("response").textContent = data.message || "Gesendet!";
  } catch (err) {
    document.getElementById("response").textContent = "Fehler beim Senden";
  }
});