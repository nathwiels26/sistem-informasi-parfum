const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TransaksiSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User" },
    items: [
      {
      produk: { type: Schema.Types.ObjectId, ref: "Produk" },
      jumlah: Number,
    }
  ],
  totalHarga: Number,
  tanggal: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaksi", TransaksiSchema);