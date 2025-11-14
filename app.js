require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const bodyParser = require("body-parser");
const cors       = require("cors");
const session    = require("express-session");
const flash      = require("connect-flash");
const path       = require("path");
const fs         = require("fs");
const multer     = require("multer");

const app        = express();
const http       = require("http").createServer(app);
const io         = require("socket.io")(http);

const routes      = require("./routes/api");
const ChatMessage = require("./models/ChatMessage");

/* ───────── multer (upload) ───────── */
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename   : (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* ───────── middleware ───────── */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ───────── ejs ───────── */
app.set("view engine", "ejs");
app.set("views", "./views");

/* ───────── mongo ───────── */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

/* ───────── session & flash ───────── */
app.use(session({
  secret: "rahasia_ka",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));
app.use(flash());

/* ───────── upload route ───────── */
app.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ───────── api routes ───────── */
app.use("/", routes);

/* ───────── helper riwayat ───────── */
async function sendHistory(socket, roomId, limit = 100) {
  try {
    const history = await ChatMessage.find({ roomId })
      .sort({ timestamp: 1 })
      .limit(limit);
    socket.emit("load-messages", history);
  } catch (err) {
    console.error("Fetch history error:", err);
  }
}

/* ───────── SOCKET.IO ───────── */
io.on("connection", (socket) => {
  console.log("🔌 connect:", socket.id);

  /* join */
  socket.on("join-chat", async ({ username, role }) => {
    socket.username = username;
    socket.role = role;

    if (role === "admin") {
      socket.join("admins");
      console.log("👑 Admin", username, "join admins");
    } else {
      const room = `user:${username}`;
      socket.join(room);
      console.log("🙋‍♂️ User", username, "join", room);
      await sendHistory(socket, room);
    }
  });

  /* USER REQUEST ADMIN - Ketika user klik "Talk to Admin" */
  socket.on("user-request-admin", async ({ username }) => {
    console.log("💬 User", username, "request admin chat");

    const roomId = `user:${username}`;

    // Cek apakah sudah ada chat history
    const existingMessages = await ChatMessage.find({ roomId }).limit(1);

    // Jika belum ada history, kirim greeting message otomatis dari admin
    if (existingMessages.length === 0) {
      const greetingMessage = "Halo! Nama saya Reza dari ScentOS. Ada yang bisa saya bantu? 😊";

      const payload = {
        roomId: roomId,
        sender: "Admin",
        message: greetingMessage,
        timestamp: Date.now(),
      };

      const doc = await ChatMessage.create(payload);

      // Kirim greeting ke user
      io.to(roomId).emit("chat-from-admin", {
        _id: doc._id,
        sender: doc.sender,
        message: doc.message,
        roomId: doc.roomId,
        timestamp: doc.timestamp
      });

      console.log("✅ Greeting message sent to", username);
    }

    // Kirim notifikasi ke admin bahwa ada user baru yang ingin chat
    // Gunakan greeting message atau placeholder untuk memunculkan user di sidebar admin
    const notificationMessage = existingMessages.length === 0
      ? "Halo! Nama saya Reza dari ScentOS. Ada yang bisa saya bantu? 😊"
      : "[User connected to admin chat]";

    io.to("admins").emit("chat-from-customer", {
      _id: null,
      sender: username,
      message: notificationMessage,
      roomId: roomId,
      timestamp: Date.now()
    });
  });

  /* USER → ADMIN */
  socket.on("chat-to-admin", async ({ message }) => {
    const payload = {
      roomId: `user:${socket.username}`,
      sender: socket.username,
      message,
      timestamp: Date.now(),
    };
    const doc = await ChatMessage.create(payload);

    /* kirim ke admin */
    io.to("admins").emit("chat-from-customer", {
      _id: doc._id, sender: doc.sender, message: doc.message,
      roomId: doc.roomId, timestamp: doc.timestamp
    });

    /* 🚩 kirim balik ke pengirim untuk pasang _id */
    socket.emit("chat-from-customer", {
      _id: doc._id, sender: doc.sender, message: doc.message,
      roomId: doc.roomId, timestamp: doc.timestamp
    });
  });

  /* ADMIN → USER */
  socket.on("chat-to-customer", async ({ username, message }) => {
    const payload = {
      roomId: `user:${username}`,
      sender: "Admin",
      message,
      timestamp: Date.now(),
    };
    const doc = await ChatMessage.create(payload);

    // Send to user
    io.to(`user:${username}`).emit("chat-from-admin", {
      _id: doc._id, sender: doc.sender, message: doc.message,
      roomId: doc.roomId, timestamp: doc.timestamp
    });

    // Send back to admin (for confirmation)
    socket.emit("chat-from-admin", {
      _id: doc._id, sender: doc.sender, message: doc.message,
      roomId: doc.roomId, timestamp: doc.timestamp, username: username
    });
  });

  /* ───── admin mengetik → user ───── */
  socket.on("admin-typing", ({ username, typing }) => {
    io.to(`user:${username}`).emit("admin-typing", { typing });
  });

  /* ───── user mengetik → admin ───── */
  socket.on("user-typing", ({ typing }) => {
    io.to("admins").emit("user-typing", { username: socket.username, typing });
  });

  /* admin buka room user */
  socket.on("admin-open-room", async ({ username }) => {
    if (socket.role !== "admin") return;
    for (const r of socket.rooms) {
      if (r.startsWith("user:") && r !== socket.id) socket.leave(r);
    }
    socket.join(`user:${username}`);
    await sendHistory(socket, `user:${username}`);
  });

  /* EDIT */
  socket.on("edit-message", async ({ id, message }) => {
    try {
      const doc = await ChatMessage.findByIdAndUpdate(id, { message }, { new: true });
      if (doc) {
        io.to(doc.roomId).emit("message-edited", { id, message: doc.message });
        io.to("admins").emit("message-edited", { id, message: doc.message });
      }
    } catch (err) { console.error("Edit error:", err); }
  });

  /* DELETE */
  socket.on("delete-message", async ({ id }) => {
    try {
      const doc = await ChatMessage.findByIdAndDelete(id);
      if (doc) {
        io.to(doc.roomId).emit("message-deleted", { id });
        io.to("admins").emit("message-deleted", { id });
      }
    } catch (err) { console.error("Delete error:", err); }
  });

  socket.on("disconnect", () => console.log("❌ disconnect:", socket.id));
});

/* ───────── start ───────── */
http.listen(3000, () => console.log("Server running on http://localhost:3000"));
