const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const initSqlJs = require("sql.js");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 12 * 1024 * 1024, cors: { origin: true, credentials: true } });
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "cambia-esto-por-una-clave-larga-y-secreta";
const storageDir = process.env.STORAGE_DIR || path.join(__dirname, "storage");
const uploadDir = path.join(storageDir, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });


let db;
const dbPath = path.join(storageDir, "chat.sqlite");
function persistDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}
async function initDb() {
  const SQL = await initSqlJs();
  const legacyDbPath = path.join(__dirname, "chat.sqlite");
  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : fs.existsSync(legacyDbPath)
      ? new SQL.Database(fs.readFileSync(legacyDbPath))
      : new SQL.Database();
  const legacyUploads = path.join(__dirname, "public", "uploads");
  if (fs.existsSync(legacyUploads)) {
    for (const name of fs.readdirSync(legacyUploads)) {
      const from = path.join(legacyUploads, name);
      const to = path.join(uploadDir, name);
      if (fs.statSync(from).isFile() && !fs.existsSync(to)) fs.copyFileSync(from, to);
    }
  }
  db.run("PRAGMA foreign_keys = ON");
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE COLLATE NOCASE,
    password TEXT NOT NULL, avatar TEXT DEFAULT '', status TEXT DEFAULT 'online',
    created_at INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
    UNIQUE(from_id,to_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
    body TEXT DEFAULT '', media_url TEXT DEFAULT '', media_type TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  )`);
  persistDb();
}

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 }
});

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = new Set(["https://localhost", "capacitor://localhost", `https://${req.headers.host}`, `http://${req.headers.host}`]);
  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav|webm))$/;
    cb(allowed.test(file.mimetype) ? null : new Error("Tipo de archivo no permitido"), allowed.test(file.mimetype));
  }
});


function rowsFromStatement(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const idRows = rowsFromStatement("SELECT last_insert_rowid() AS id");
  persistDb();
  return Promise.resolve({ lastID: idRows[0]?.id || 0, changes });
}
function get(sql, params = []) {
  return Promise.resolve(rowsFromStatement(sql, params)[0]);
}
function all(sql, params = []) {
  return Promise.resolve(rowsFromStatement(sql, params));
}

function safeUser(u) {
  return { id: u.id, username: u.username, avatar: u.avatar || "", status: u.status || "offline" };
}
function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Inicia sesión primero." });
  next();
}
async function areFriends(a, b) {
  const row = await get("SELECT id FROM friendships WHERE state='accepted' AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?))", [a,b,b,a]);
  return !!row;
}

app.post("/api/register", async (req, res) => {
  try {
    let { username, password } = req.body || {};
    username = String(username || "").trim();
    if (!/^[\p{L}\p{N}_ -]{3,20}$/u.test(username)) return res.status(400).json({ error: "El nombre debe tener entre 3 y 20 caracteres." });
    if (String(password || "").length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    const hash = await bcrypt.hash(password, 12);
    const result = await run("INSERT INTO users(username,password,created_at) VALUES(?,?,?)", [username, hash, Date.now()]);
    req.session.userId = result.lastID;
    res.json({ user: safeUser(await get("SELECT * FROM users WHERE id=?", [result.lastID])) });
  } catch (e) {
    res.status(400).json({ error: e.code === "SQLITE_CONSTRAINT" ? "Ese nombre ya está ocupado." : "No se pudo crear la cuenta." });
  }
});
app.post("/api/login", async (req, res) => {
  const user = await get("SELECT * FROM users WHERE username=? COLLATE NOCASE", [String(req.body?.username || "").trim()]);
  if (!user || !(await bcrypt.compare(String(req.body?.password || ""), user.password))) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  req.session.userId = user.id;
  res.json({ user: safeUser(user) });
});
app.post("/api/logout", auth, async (req, res) => {
  const id = req.session.userId;
  await run("UPDATE users SET status='offline' WHERE id=?", [id]);
  io.emit("presence", { userId: id, status: "offline" });
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/me", auth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id=?", [req.session.userId]);
  res.json({ user: safeUser(user) });
});
app.post("/api/avatar", auth, upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Sube una imagen." });
  const url = "/uploads/" + req.file.filename;
  await run("UPDATE users SET avatar=? WHERE id=?", [url, req.session.userId]);
  res.json({ avatar: url });
});
app.post("/api/status", auth, async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["online","idle","dnd","invisible"].includes(status)) return res.status(400).json({ error: "Estado no válido." });
  await run("UPDATE users SET status=? WHERE id=?", [status, req.session.userId]);
  io.emit("presence", { userId: req.session.userId, status: status === "invisible" ? "offline" : status });
  res.json({ ok: true });
});
app.get("/api/users", auth, async (req, res) => {
  const rows = await all(`SELECT id,username,avatar,status FROM users WHERE id != ? ORDER BY username`, [req.session.userId]);
  res.json({ users: rows.map(u => ({...u, status: onlineUsers.has(u.id) && u.status !== "invisible" ? u.status : "offline"})) });
});
app.get("/api/friends", auth, async (req, res) => {
  const id = req.session.userId;
  const friends = await all(`SELECT u.id,u.username,u.avatar,u.status FROM friendships f JOIN users u
    ON u.id=CASE WHEN f.from_id=? THEN f.to_id ELSE f.from_id END
    WHERE f.state='accepted' AND (f.from_id=? OR f.to_id=?)`, [id,id,id]);
  const incoming = await all(`SELECT f.id,u.id AS userId,u.username,u.avatar FROM friendships f JOIN users u ON u.id=f.from_id WHERE f.to_id=? AND f.state='pending'`, [id]);
  const outgoing = await all(`SELECT u.id,u.username,u.avatar FROM friendships f JOIN users u ON u.id=f.to_id WHERE f.from_id=? AND f.state='pending'`, [id]);
  res.json({
    friends: friends.map(u => ({...u, status: onlineUsers.has(u.id) && u.status !== "invisible" ? u.status : "offline"})),
    incoming, outgoing
  });
});
app.post("/api/friend-request", auth, async (req, res) => {
  const to = Number(req.body?.userId), from = req.session.userId;
  if (!to || to === from || !(await get("SELECT id FROM users WHERE id=?", [to]))) return res.status(400).json({ error: "Usuario no válido." });
  try {
    const reverse = await get("SELECT id,state FROM friendships WHERE from_id=? AND to_id=?", [to,from]);
    if (reverse?.state === "pending") {
      await run("UPDATE friendships SET state='accepted' WHERE id=?", [reverse.id]);
      io.to("user:"+to).emit("friends-changed");
      io.to("user:"+from).emit("friends-changed");
      return res.json({ accepted: true });
    }
    await run("INSERT INTO friendships(from_id,to_id,state,created_at) VALUES(?,?,'pending',?)", [from,to,Date.now()]);
    io.to("user:"+to).emit("friends-changed");
    res.json({ ok: true });
  } catch { res.status(400).json({ error: "Ya existe una solicitud o amistad." }); }
});
app.post("/api/friend-request/:id/accept", auth, async (req, res) => {
  const requestId = Number(req.params.id);
  const result = await run("UPDATE friendships SET state='accepted' WHERE id=? AND to_id=? AND state='pending'", [requestId, req.session.userId]);
  if (!result.changes) return res.status(404).json({ error: "Solicitud no encontrada." });
  const row = await get("SELECT from_id FROM friendships WHERE id=?", [requestId]);
  io.to("user:"+row.from_id).emit("friends-changed");
  io.to("user:"+req.session.userId).emit("friends-changed");
  res.json({ ok: true });
});
app.get("/api/messages/:userId", auth, async (req, res) => {
  const other = Number(req.params.userId), me = req.session.userId;
  if (!(await areFriends(me, other))) return res.status(403).json({ error: "Solo puedes chatear con tus amigos." });
  const rows = await all(`SELECT id,from_id AS fromId,to_id AS toId,body,media_url AS mediaUrl,media_type AS mediaType,created_at AS createdAt
    FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100`, [me,other,other,me]);
  res.json({ messages: rows.reverse() });
});
app.post("/api/upload", auth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Archivo no válido." });
  res.json({ url: "/uploads/" + req.file.filename, type: req.file.mimetype });
});

const onlineUsers = new Map();
io.engine.use(sessionMiddleware);
io.use((socket, next) => socket.request.session?.userId ? next() : next(new Error("No autorizado")));
io.on("connection", async socket => {
  const id = socket.request.session.userId;
  socket.join("user:"+id);
  onlineUsers.set(id, (onlineUsers.get(id) || 0) + 1);
  const me = await get("SELECT status FROM users WHERE id=?", [id]);
  if (me?.status === "offline") await run("UPDATE users SET status='online' WHERE id=?", [id]);
  const status = me?.status === "invisible" ? "offline" : (me?.status || "online");
  io.emit("presence", { userId: id, status });
  socket.on("typing", async ({ to, active }) => {
    if (await areFriends(id, Number(to))) io.to("user:"+Number(to)).emit("typing", { from: id, active: !!active });
  });
  socket.on("private-message", async data => {
    try {
      const to = Number(data?.to), body = String(data?.body || "").slice(0, 3000);
      const mediaUrl = String(data?.mediaUrl || "").slice(0, 500);
      const mediaType = String(data?.mediaType || "").slice(0, 80);
      if (!to || !(await areFriends(id,to)) || (!body.trim() && !mediaUrl)) return;
      const result = await run("INSERT INTO messages(from_id,to_id,body,media_url,media_type,created_at) VALUES(?,?,?,?,?,?)", [id,to,body,mediaUrl,mediaType,Date.now()]);
      const msg = { id: result.lastID, fromId:id, toId:to, body, mediaUrl, mediaType, createdAt:Date.now() };
      io.to("user:"+id).to("user:"+to).emit("message", msg);
    } catch {}
  });
  socket.on("disconnect", async () => {
    const count = (onlineUsers.get(id) || 1) - 1;
    if (count <= 0) {
      onlineUsers.delete(id);
      const user = await get("SELECT status FROM users WHERE id=?", [id]);
      if (user?.status !== "invisible") {
        await run("UPDATE users SET status='offline' WHERE id=?", [id]);
        io.emit("presence", { userId:id, status:"offline" });
      }
    } else onlineUsers.set(id, count);
  });
});

app.get("/health", (_, res) => res.json({ ok: true, name: "Orbit Chat" }));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
initDb().then(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`Orbit Chat escuchando en el puerto ${PORT}`));
}).catch(err => {
  console.error("No se pudo iniciar la base de datos:", err);
  process.exit(1);
});
