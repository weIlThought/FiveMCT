async function loadLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs`);
    const logs = await res.json();
    const container = document.getElementById("logContainer");
    container.innerHTML = "";
    logs.forEach(log => {
      const div = document.createElement("div");
      div.className = "log-entry";
      div.textContent = `[${log.timestamp}] ${log.message}`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Logs", err);
  }
}
loadLogs();