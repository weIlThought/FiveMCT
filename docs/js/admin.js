async function load() {
  const r = await fetch(API_BASE + "/logs");
  const j = await r.json();
  const tb = document.querySelector("#logTable tbody");
  tb.innerHTML = "";
  j.forEach((x, i) => {
    tb.innerHTML += `<tr><td>${i + 1}</td><td>${x.title}</td><td>${
      x.description
    }</td></tr>`;
  });
}
load();
