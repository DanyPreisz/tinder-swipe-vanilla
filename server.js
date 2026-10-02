const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC = path.join(__dirname, "public");
const SEED = path.join(__dirname, "data", "db.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "tinder.json");
const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "tinder";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
function seedData() { try { return JSON.parse(fs.readFileSync(SEED, "utf8")); } catch { return { profiles: [] }; } }
let storePromise = null;
async function store() {
  if (!MONGO_URI) return null;
  if (!storePromise) {
    storePromise = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      const db = client.db(MONGO_DB);
      const profiles = db.collection("profiles");
      const swipes = db.collection("swipes");
      if ((await profiles.countDocuments()) === 0) {
        const seed = seedData();
        if (seed.profiles?.length) await profiles.insertMany(seed.profiles);
      }
      return { profiles, swipes };
    })();
  }
  return storePromise;
}
function localRead() {
  try { if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8")); } catch {}
  const seed = { profiles: seedData().profiles || [], likes: [], nopes: [] };
  fs.writeFileSync(LOCAL_DB, JSON.stringify(seed, null, 2));
  return seed;
}
function localWrite(db) { fs.writeFileSync(LOCAL_DB, JSON.stringify(db, null, 2)); }
function send(res, status, body, type = TYPES[".json"]) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function body(req) { return new Promise((resolve) => { let raw = ""; req.on("data", (c) => { raw += c; }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } }); }); }
function file(res, filePath) { fs.readFile(filePath, (err, data) => { if (err) return send(res, 404, "No encontrado", "text/plain; charset=utf-8"); send(res, 200, data, TYPES[path.extname(filePath)] || "application/octet-stream"); }); }
function clean(p) { return { id: p.id, name: p.name, age: p.age, city: p.city, bio: p.bio }; }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const db = await store();
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) return send(res, 200, { ok: true, store: db ? "mongodb" : "local" });
    if (req.method === "GET" && url.pathname === "/api/deck") {
      if (db) {
        const seen = new Set((await db.swipes.find({}, { projection: { _id: 0, profileId: 1 } }).toArray()).map((s) => s.profileId));
        return send(res, 200, (await db.profiles.find({}, { projection: { _id: 0 } }).toArray()).filter((p) => !seen.has(p.id)).map(clean));
      }
      const local = localRead();
      const seen = new Set([...(local.likes || []), ...(local.nopes || [])]);
      return send(res, 200, local.profiles.filter((p) => !seen.has(p.id)));
    }
    if (req.method === "GET" && url.pathname === "/api/matches") {
      if (db) {
        const likes = new Set((await db.swipes.find({ like: true }, { projection: { _id: 0, profileId: 1 } }).toArray()).map((s) => s.profileId));
        return send(res, 200, (await db.profiles.find({}, { projection: { _id: 0 } }).toArray()).filter((p) => likes.has(p.id)).map(clean));
      }
      const local = localRead();
      const likes = new Set(local.likes || []);
      return send(res, 200, local.profiles.filter((p) => likes.has(p.id)));
    }
    if (req.method === "POST" && url.pathname === "/api/swipe") {
      const data = await body(req);
      const id = String(data.id || "");
      const like = Boolean(data.like);
      if (db) {
        if (!(await db.profiles.findOne({ id }))) return send(res, 404, { error: "no" });
        await db.swipes.updateOne({ profileId: id }, { $set: { profileId: id, like, at: Date.now() } }, { upsert: true });
        return send(res, 200, { id, like, match: like });
      }
      const local = localRead();
      if (!local.profiles.some((p) => p.id === id)) return send(res, 404, { error: "no" });
      local.likes = (local.likes || []).filter((x) => x !== id);
      local.nopes = (local.nopes || []).filter((x) => x !== id);
      if (like) local.likes.push(id); else local.nopes.push(id);
      localWrite(local);
      return send(res, 200, { id, like, match: like });
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      if (db) await db.swipes.deleteMany({});
      else { const local = localRead(); local.likes = []; local.nopes = []; localWrite(local); }
      return send(res, 200, { ok: true });
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    file(res, path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, "")));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "store", detail: String(err.message || err) });
  }
});
server.listen(PORT, HOST, () => console.log("listening " + PORT));
