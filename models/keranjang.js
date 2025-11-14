const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const keranjangSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      produk: { type: Schema.Types.ObjectId, ref: 'Produk', required: true },
      quantity: { type: Number, default: 1 },
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Keranjang', keranjangSchema);
