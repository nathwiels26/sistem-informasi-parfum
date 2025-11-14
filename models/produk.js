const mongoose = require("mongoose");
const ProdukSchema = new mongoose.Schema({
    namaProduk: String, harga: Number, stok: Number,
});
module.exports = mongoose.model("Produk", ProdukSchema);