const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email tidak boleh kosong"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Password tidak boleh kosong"],
  },
  telepon: {
    type: String,
    required: [true, "Nomor telepon tidak boleh kosong"],
    unique: true,
  },
  role: {
    type: String,
    enum: ["customer", "admin"],
    default: "customer",
  },

  // === Field untuk fitur reset password ===
  resetToken: String,          // token acak
  resetTokenExpires: Date      // masa berlaku token
});

module.exports = mongoose.model("User", userSchema);
