const card = document.querySelector("#card");
const msg = document.querySelector("#msg");
const matchesEl = document.querySelector("#matches");
const storeEl = document.querySelector("#store");
let deck = [];
document.querySelector("#like").addEventListener("click", () => swipe(true));
document.querySelector("#nope").addEventListener("click", () => swipe(false));
document.querySelector("#reset").addEventListener("click", async () => { await fetch("/api/reset", { method: "POST" }); msg.textContent = ""; load(); });
function escapeHtml(s) { return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "<" + "lt;"); }
async function swipe(like) {
  const cur = deck[0]; if (!cur) return;
  const data = await (await fetch("/api/swipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cur.id, like }) })).json();
  msg.textContent = data.match ? "Like a " + cur.name : "Nope a " + cur.name;
  deck.shift(); paint(); matches();
}
async function load() { deck = await (await fetch("/api/deck")).json(); paint(); matches(); }
function paint() {
  const cur = deck[0];
  card.innerHTML = cur ? "<h2>" + escapeHtml(cur.name) + ", " + cur.age + "</h2><p>" + escapeHtml(cur.city) + "</p><p>" + escapeHtml(cur.bio) + "</p>" : "<p>No hay más perfiles.</p>";
}
async function matches() {
  const rows = await (await fetch("/api/matches")).json();
  matchesEl.innerHTML = rows.map((p) => "<li>♥ " + escapeHtml(p.name) + "</li>").join("");
}
async function boot() { const health = await (await fetch("/health")).json(); storeEl.textContent = health.store === "mongodb" ? "MongoDB" : "Local"; load(); }
boot();
