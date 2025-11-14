const express = require("express");
const Produk = require("../models/produk");
const Transaksi = require("../models/transaksi");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/user");
const Keranjang = require("../models/keranjang");
const sendResetEmail = require('../utils/email');   // relative dari routes/
const crypto = require('crypto');
const Favorite = require("../models/Favorite");



// GET /favorite
router.get("/favorite", async (req, res) => {
  const userId = req.session.username || "guest"; // Ganti ini sesuai login session kamu
  const favorites = await Favorite.find({ userId });
  res.render("favorite", { favoriteList: favorites });
});

// POST /favorite/add/:id
router.post("/favorite/add/:id", async (req, res) => {
  const userId = req.session.username || "guest";
  const id = parseInt(req.params.id);

  // Kamu bisa sesuaikan parfumList ini ke database produk kamu kalau sudah ada
  const parfumList = [
    { id: 1, name: "YSL Y", image: "/img/ysl.png", description: "Wangi bunga segar dengan ketahanan hingga 8 jam." },
    { id: 2, name: "Eros Flame", image: "/img/ero.png", description: "Aroma laut yang menyegarkan, cocok untuk pria aktif." },
    { id: 3, name: "LV Imagination", image: "/img/lvv.png", description: "Manis dan hangat, cocok untuk suasana romantis." }
  ];

  const parfum = parfumList.find(p => p.id === id);
  if (!parfum) return res.status(404).send("Parfum tidak ditemukan.");

  // Cek apakah sudah ada
  const existing = await Favorite.findOne({ userId, parfumId: id });
  if (!existing) {
    await Favorite.create({ userId, parfumId: id, name: parfum.name, image: parfum.image, description: parfum.description });
  }

  res.redirect("/favorite");
});

// DELETE /favorite/delete/:id
router.post("/favorite/delete/:id", async (req, res) => {
  const userId = req.session.username || "guest";
  const parfumId = parseInt(req.params.id);
  await Favorite.deleteOne({ userId, parfumId });
  res.redirect("/favorite");
});

// POST /favorite  ← tambahkan
router.post("/favorite", async (req, res) => {
  const userId    = req.session.username || "guest";
  const { productId } = req.body;           // 'ysl-y', 'eros-flame', dst.

  // Peta kode → detail parfum
  const parfumMap = {
    "ysl-y":        { id: 1, name: "YSL Y",          image: "/img/ysl.png", description: "Wangi bunga segar dengan ketahanan hingga 8 jam." },
    "eros-flame":   { id: 2, name: "Eros Flame",     image: "/img/ero.png", description: "Aroma laut yang menyegarkan, cocok untuk pria aktif." },
    "lv-imagination":{ id: 3, name: "LV Imagination", image: "/img/lvv.png", description: "Manis dan hangat, cocok untuk suasana romantis." }
  };

  const parfum = parfumMap[productId];
  if (!parfum) return res.status(404).json({ message: "Parfum tidak ditemukan" });

  // Hindari duplikasi
  const exists = await Favorite.findOne({ userId, parfumId: parfum.id });
  if (!exists) {
    await Favorite.create({
      userId,
      parfumId   : parfum.id,
      name       : parfum.name,
      image      : parfum.image,
      description: parfum.description
    });
  }

  return res.status(200).json({ success: true });
});



router.get('/admin-chat', (req, res) => {
  res.render('admin-chat', { username: 'Admin' }); // atau bisa pakai session username jika ada
});

// Analytics Route - Render analytics page
router.get('/analytics', async (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).send("Akses hanya untuk admin.");
  }
  res.render('analytics');
});

// Analytics API - Return JSON data for real-time analytics
router.get('/api/analytics', async (req, res) => {
  try {
    // Get all transactions with populated data
    const transaksi = await Transaksi.find()
      .populate('user')
      .populate('items.produk')
      .sort({ tanggal: -1 });

    // Calculate total revenue
    const totalRevenue = transaksi.reduce((sum, t) => sum + t.totalHarga, 0);

    // Calculate total transactions
    const totalTransactions = transaksi.length;

    // Calculate total products sold
    const totalProductsSold = transaksi.reduce((sum, t) => {
      return sum + t.items.reduce((itemSum, item) => itemSum + item.jumlah, 0);
    }, 0);

    // Calculate average order value
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Sales trend for last 7 days
    const today = new Date();
    const last7Days = [];
    const salesByDay = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      last7Days.push(dateStr);
      salesByDay[dateStr] = 0;
    }

    // Calculate sales per day
    transaksi.forEach(t => {
      const dateStr = new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      if (salesByDay.hasOwnProperty(dateStr)) {
        salesByDay[dateStr] += t.totalHarga;
      }
    });

    const salesTrend = {
      labels: last7Days,
      values: last7Days.map(day => salesByDay[day])
    };

    // Top products
    const productStats = {};

    transaksi.forEach(t => {
      t.items.forEach(item => {
        if (item.produk) {
          const produkId = item.produk._id.toString();
          if (!productStats[produkId]) {
            productStats[produkId] = {
              name: item.produk.namaProduk,
              quantity: 0,
              revenue: 0
            };
          }
          productStats[produkId].quantity += item.jumlah;
          productStats[produkId].revenue += item.produk.harga * item.jumlah;
        }
      });
    });

    // Convert to array and sort by quantity
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({
      totalRevenue,
      totalTransactions,
      totalProductsSold,
      avgOrderValue,
      salesTrend,
      topProducts
    });

  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Gagal mengambil data analytics' });
  }
});

module.exports = router;


router.get('/chat', (req, res) => {
  const username = req.session?.userId ? 'User-' + req.session.userId.toString().slice(-4) : 'Pengguna';
  res.render('chat', { username });
});

// GET: form lupa password
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { message: null });
});

// POST: proses lupa password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.render('forgot-password', { message: 'Email tidak ditemukan.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token;
  user.resetTokenExpires = Date.now() + 1000 * 60 * 15; // 15 menit
  await user.save();

  try {
    await sendResetEmail(email, token);  // pakai fungsi dari utils/email.js
    res.render('forgot-password', { message: 'Link reset dikirim ke email Anda.' });
  } catch (err) {
    console.error(err);
    res.render('forgot-password', { message: 'Gagal mengirim email. Coba lagi.' });
  }
});

// (optional) GET dan POST untuk reset-password bisa kamu tambahkan setelah ini

router.get('/reset-password/:token', async (req, res) => {
  const user = await User.findOne({
    resetToken: req.params.token,
    resetTokenExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.send('Token tidak valid atau sudah kadaluarsa.');
  }

  res.render('reset-password', { token: req.params.token, msg: null });
});
// POST: simpan password baru
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: Date.now() }
  });
  if (!user) {
    return res.send('Token tidak valid / sudah kadaluarsa.');
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  res.render('reset-password', { token: null, msg: 'Password berhasil diperbarui. Silakan login.' });
});



module.exports = router;

// Routes untuk views
router.get("/", (req, res) => {
    res.render("index");
});

router.get("/login", (req, res) => {
  res.render("login", {
    error: req.query.error || null,
    email: req.query.email || ""
  });
});




router.get("/register", (req, res) => {
    const error = req.query.error || null; // ambil dari query string (jika ada)
    res.render("register", { error });
});


router.get("/homepage", (req, res) => {
    res.render("homepage");
});

router.get('/produk1', async (req, res) => {
    try {
        const produk = await Produk.findOne({ namaProduk: "YSL Y" });
        if (!produk) {
            return res.status(404).send("Produk tidak ditemukan.");
        }
        res.render('produk1', { produk });
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengambil produk.");
    }
});

router.get('/produk2', async (req, res) => {
    try {
        const produk = await Produk.findOne({ namaProduk: "Eros Flame" });
        if (!produk) {
            return res.status(404).send("Produk tidak ditemukan.");
        }
        res.render('produk2', { produk });
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengambil produk.");
    }
});

router.get('/produk3', async (req, res) => {
    try {
        const produk = await Produk.findOne({ namaProduk: "LV Imagination" });
        if (!produk) {
            return res.status(404).send("Produk tidak ditemukan.");
        }
        res.render('produk3', { produk });
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengambil produk.");
    }
});

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Gagal logout:", err);
            return res.status(500).send("Gagal logout.");
        }
        res.redirect("/login");
    });
});

router.get('/transaksi-gagal', (req, res) => {
    res.render('transaksi-gagal');
});

router.get('/transaksi-berhasil', (req, res) => {
    res.render('transaksi-berhasil');
});


// Dashboard Admin
router.get("/admin-dashboard", async (req, res) => {
    if (req.session.role !== "admin") {
        return res.status(403).send("Akses hanya untuk admin.");
    }

    try {
        const produkList = await Produk.find(); // ambil semua produk dari MongoDB
        res.render("admin-dashboard", { produkList }); // kirim ke EJS
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengambil produk");
    }
});

// Route untuk menampilkan daftar pengguna
router.get('/kelola-user', async (req, res) => {
    try {
        const users = await User.find();
        res.render('kelola-user', { users, messages: req.flash() }); // Pass flash messages ke EJS
    } catch (err) {
        res.status(500).send('Terjadi kesalahan');
    }
});

// Tampilkan form edit pengguna
router.get('/edit-user/:id', async (req, res) => {
    try {
        console.log("Edit ID:", req.params.id);
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send('Pengguna tidak ditemukan');
        }
        res.render('edit-user', { user });
    } catch (err) {
        console.error("Gagal mengambil data pengguna:", err);
        res.status(500).send('Gagal mengambil data pengguna');
    }
});

// Simpan perubahan
router.post('/edit-user/:id', async (req, res) => {
    const { email, telepon, role } = req.body;
    try {
        await User.findByIdAndUpdate(req.params.id, { email, telepon, role });
        res.redirect('/kelola-user');
    } catch (err) {
        console.error("Gagal menyimpan perubahan:", err);
        res.status(500).send('Gagal memperbarui data pengguna');
    }
});

router.post('/edit-user/hapus/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).send('Pengguna tidak ditemukan');
        }

        await User.findByIdAndDelete(id);
        res.redirect('/kelola-user'); // Ganti ke halaman setelah penghapusan jika perlu
    } catch (err) {
        console.error('Gagal menghapus user:', err);
        res.status(500).send('Terjadi kesalahan server');
    }
});


// Menampilkan semua transaksi untuk admin
router.get("/admin-transaksi", async (req, res) => {
    try {
        const transaksi = await Transaksi.find()
            .populate('user')  // Ambil hanya email user
            .populate('items.produk') // Ambil hanya nama produk
            .lean(); // Convert to plain JavaScript objects for better performance

        // Filter out transactions with invalid user or product references
        const validTransaksi = transaksi.filter(t => {
            // Check if user exists
            if (!t.user) {
                console.warn(`Transaksi ${t._id} tidak memiliki user yang valid`);
                return false;
            }
            // Check if all items have valid products
            const hasValidItems = t.items && t.items.every(item => item.produk);
            if (!hasValidItems) {
                console.warn(`Transaksi ${t._id} memiliki item dengan produk yang tidak valid`);
            }
            return hasValidItems;
        });

        res.render("admin-transaksi", { transaksi: validTransaksi });
    } catch (err) {
        console.error("Error fetching admin transactions:", err);
        res.status(500).json({ error: "Gagal mengambil data transaksi." });
    }
});

router.delete("/admin-transaksi/:id", async (req, res) => {
    try {
        const transaksiId = req.params.id;

        const transaksi = await Transaksi.findById(transaksiId);
        if (!transaksi) {
            return res.status(404).json({ error: "Transaksi tidak ditemukan." });
        }

        await Transaksi.findByIdAndDelete(transaksiId);

        res.json({ message: "Transaksi berhasil dihapus." });
    } catch (err) {
        console.error("Error menghapus transaksi:", err);
        res.status(500).json({ error: "Gagal menghapus transaksi." });
    }
});

router.get('/produk', async (req, res) => {
    const produkList = await Produk.find();
    res.render('kelola-produk', { produkList });
});

router.post('/produk/tambah', async (req, res) => {
    const { namaProduk, harga, stok } = req.body;
    await Produk.create({ namaProduk, harga, stok });
    res.redirect('/produk');
});

router.get("/produk/edit/:id", async (req, res) => {
    try {
        const produk = await Produk.findById(req.params.id);
        res.render("edit-produk", { produk });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

router.post('/produk/hapus/:id', async (req, res) => {
    try {
        await Produk.findByIdAndDelete(req.params.id);
        res.redirect('/produk');
    } catch (err) {
        res.status(500).send('Gagal menghapus produk');
    }
});

router.get('/produk/tambah', (req, res) => {
    res.render('tambah-produk');
});

// Tambahkan produk ke DB
router.post('/produk/tambah', async (req, res) => {
    const { namaProduk, harga, stok } = req.body;
    try {
        const produkBaru = new Produk({ namaProduk, harga, stok });
        await produkBaru.save();
        res.redirect('/produk'); // Kembali ke halaman kelola
    } catch (err) {
        res.status(500).send('Gagal menambah produk');
    }
});


// Simpan perubahan
router.post("/produk/edit/:id", async (req, res) => {
    try {
        await Produk.findByIdAndUpdate(req.params.id, {
            namaProduk: req.body.namaProduk,
            harga: req.body.harga,
            stok: req.body.stok,
        });
        res.redirect("/produk");
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal mengupdate produk");
    }
});


// POST: Proses pendaftaran
router.post('/register', async (req, res) => {
  try {
    const { email, password, telepon, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('register', { error: 'Email sudah digunakan' });
    }

     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
     return res.redirect("/register?error=Format%20email%20tidak%20valid");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      telepon,
      role: role || "customer"
    });

    await user.save();
    res.redirect("/login");

  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Terjadi kesalahan saat mendaftar.' });
  }
});

// ======================================================
// POST  /login  – proses autentikasi
// ======================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── 1.  Email terdaftar? ────────────────────────────
    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect("/login?error=Email%20belum%20terdaftar");
    }

    // ── 2.  Cek password cocok? ────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const q = `?error=Password%20salah&email=${encodeURIComponent(email)}`;
      return res.redirect(`/login${q}`);
    }

    // ── 3.  Set sesi dan arahkan ───────────────────────
    req.session.userId = user._id;
    req.session.role   = user.role;

    if (user.role === "admin") {
      return res.redirect("/admin-dashboard");
    }
    return res.redirect("/homepage");

  } catch (err) {
    console.error("Error saat login:", err);
    return res.redirect("/login?error=Terjadi%20kesalahan");
  }
});
module.exports = router;



// Endpoint CRUD User
router.get("/user", async (req, res) => {
    const user = await User.find();
    res.json(user);
});
router.post("/user", async (req, res) => {
    const user = new User(req.body);
    await user.save();
    res.json(user);
});

// Middleware auth sederhana untuk keranjang
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect("/login");
    }
};

// Tampilkan keranjang
router.get("/keranjang", async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.log("User not logged in, redirecting to /login");
            return res.redirect('/login');
        }

        const keranjang = await Keranjang.findOne({ userId }).populate('items.produk');
        if (!keranjang) {
            console.log("No keranjang found for user:", userId);
        }
        res.render("keranjang", { keranjang: keranjang || { items: [] } });
    } catch (err) {
        console.error("Gagal mengambil keranjang:", err.stack || err);
        res.status(500).send("Terjadi kesalahan saat mengambil keranjang.");
    }
});

// Detail produk
router.get("/produk1/:id", async (req, res) => {
    try {
        const produkId = req.params.id;
        if (!produkId) return res.status(400).send("ID produk tidak valid");
        const produk = await Produk.findById(produkId);
        if (!produk) return res.status(404).send("Produk tidak ditemukan");
        res.render("produk1", { produk });
    } catch (err) {
        console.error("Error getting produk1 detail:", err.stack || err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

router.get('/produk/:id/produk2', async (req, res) => {
    try {
        const produkId = req.params.id;
        if (!produkId) return res.status(400).send('ID produk tidak valid');
        const produk = await Produk.findById(produkId);
        if (!produk) return res.status(404).send('Produk tidak ditemukan');
        res.render('produk2', { produk });
    } catch (err) {
        console.error('Error getting produk detail:', err.stack || err);
        res.status(500).send('Terjadi kesalahan server');
    }
});

router.get('/produk/:id/produk3', async (req, res) => {
    try {
        const produkId = req.params.id;
        if (!produkId) return res.status(400).send('ID produk tidak valid');
        const produk = await Produk.findById(produkId);
        if (!produk) return res.status(404).send('Produk tidak ditemukan');
        res.render('produk3', { produk });
    } catch (err) {
        console.error('Error getting produk detail:', err.stack || err);
        res.status(500).send('Terjadi kesalahan server');
    }
});

// Tambah ke keranjang
router.post('/keranjang/tambah', async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.log("User  not logged in, redirecting to /login");
            return res.redirect('/login');
        }

        const { produkId, quantity } = req.body;
        if (!produkId || !quantity || isNaN(quantity) || Number(quantity) <= 0) {
            return res.status(400).send("Produk ID atau quantity tidak valid");
        }

        const produk = await Produk.findById(produkId);
        if (!produk) return res.status(404).send('Produk tidak ditemukan');

        let keranjang = await Keranjang.findOne({ userId }) || new Keranjang({ userId, items: [] });

        // Hapus item yang rusak (produk null/undefined)
        keranjang.items = keranjang.items.filter(item => item.produk);

        // Debug log isi keranjang
        console.log(">> Isi keranjang saat ini:");
        keranjang.items.forEach((item, i) => {
            console.log(`Item ${i}: produk =`, item.produk?.toString(), ", quantity =", item.quantity);
        });

        // Pastikan produkId adalah string for comparison to avoid mismatch
        const produkIdStr = produkId.toString();

        // Cek apakah produk sudah ada
        const existingItem = keranjang.items.find(item => item.produk?.toString() === produkIdStr);

        if (existingItem) {
            existingItem.quantity += Number(quantity);
        } else {
            keranjang.items.push({
                produk: produkId,
                quantity: Number(quantity)
            });
        }

        await keranjang.save();
        res.redirect('/keranjang');
    } catch (err) {
        console.error("Error saat menambahkan ke keranjang:", err.stack || err);
        res.status(500).send("Gagal menambahkan ke keranjang.");
    }
});


// Hapus item dari keranjang
router.post('/keranjang/hapus', async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.log("User not logged in, redirecting to /login");
            return res.redirect('/login');
        }

        const { produkId } = req.body;
        if (!produkId) {
            return res.status(400).send("Produk ID tidak diberikan");
        }

        let keranjang = await Keranjang.findOne({ userId });
        if (!keranjang) {
            return res.status(404).send("Keranjang tidak ditemukan");
        }

        // Filter out the item to be deleted
        const itemIndex = keranjang.items.findIndex(item =>
            item.produk?.toString() === produkId.toString()
        );

        if (itemIndex === -1) {
            return res.status(404).send("Item produk tidak ditemukan di keranjang");
        }

        keranjang.items.splice(itemIndex, 1);

        await keranjang.save();

        res.redirect('/keranjang');
    } catch (err) {
        console.error("Error saat menghapus item dari keranjang:", err.stack || err);
        res.status(500).send("Gagal menghapus item dari keranjang.");
    }
});

// Endpoint Transaksi
router.get("/transaksi", async (req, res) => {
    try {
        const transaksi = await Transaksi.find()
            .populate("user")
            .populate("produk");
        res.render("transaksi", { transaksi });
    } catch (err) {
        console.error("Error fetching transactions:", err);
        res.status(500).send("Terjadi kesalahan saat mengambil data transaksi.");
    }
});

// Route: Payment - Process payment and create transactions
router.post('/transaksi/bayar', async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.redirect('/login'); // Redirect to login if user is not logged in

    try {
        // Fetch cart for user and populate product details
        const keranjang = await Keranjang.findOne({ userId }).populate('items.produk');
        if (!keranjang || keranjang.items.length === 0) {
            return res.redirect('/keranjang?error=Keranjang%20kosong,%20tidak%20bisa%20checkout.');
        }

        // Verify stock availability for each item
        for (const item of keranjang.items) {
            if (!item.produk || item.produk.stok < item.quantity) {
                return res.redirect(`/keranjang?error=Stok%20produk%20${item.produk?.namaProduk || 'tidak valid'}%20tidak%20cukup.`);
            }
        }

        // Simulate payment process (replace with actual payment logic)
        const isPaymentSuccessful = true; // Simulate successful payment

        if (!isPaymentSuccessful) {
            return res.render('transaksi-gagal'); // Render the failure page
        }

        let totalHarga = 0;
        const items = [];

        for (const item of keranjang.items) {
            totalHarga += item.produk.harga * item.quantity;
            items.push({
                produk: item.produk._id,
                jumlah: item.quantity
            });

            // Kurangi stok
            item.produk.stok -= item.quantity;
            await item.produk.save();
        }

        const transaksiBaru = new Transaksi({
            user: userId,
            items: items,
            totalHarga: totalHarga
        });

        await transaksiBaru.save();

        // Kosongkan keranjang
        keranjang.items = [];
        await keranjang.save();

        // Redirect ke halaman sukses
        const user = await User.findById(userId);
        res.render('transaksi-berhasil', { user, transaksi: transaksiBaru });

    } catch (err) {
        console.error('Error saat memproses transaksi:', err);
        res.status(500).send('Terjadi kesalahan saat memproses transaksi.');
    }
});


router.post('/transaksi/checkout', async (req, res) => {
    const userId = req.session?.userId;
    console.log("User  ID:", userId); // Log user ID

    if (!userId) return res.redirect('/login');

    try {
        // Ambil keranjang berdasarkan userId
        const keranjang = await Keranjang.findOne({ userId }).populate('items.produk');

        // Log untuk memeriksa isi keranjang
        console.log("Keranjang:", keranjang);

        if (!keranjang || !Array.isArray(keranjang.items) || keranjang.items.length === 0) {
            return res.redirect('/keranjang?error=Keranjang%20kosong,%20tidak%20bisa%20checkout.');
        }

        // Cek stok untuk semua item
        for (const item of keranjang.items) {
            if (!item.produk) {
                console.warn(`Produk tidak ditemukan dalam item keranjang user ${userId}`);
                continue; // atau bisa Anda jadikan error juga kalau mau ketat
            }
            if (item.produk.stok < item.quantity) {
                return res.redirect(`/keranjang?error=Stok%20produk%20${item.produk.namaProduk}%20tidak%20cukup.`);
            }
        }

        // Render halaman konfirmasi pembayaran
        res.render('transaksi', { keranjang }); // Kirim keranjang ke tampilan
    } catch (err) {
        console.error("Error during checkout:", err);
        res.status(500).send("Terjadi kesalahan saat checkout.");
    }
});

module.exports = router;