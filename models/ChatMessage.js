// models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  roomId:  { type: String, required: true },   // contoh: "user:ridwan"
  sender:  { type: String, required: true },   // "Admin" atau "ridwan"
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

/* 
 * Index agar query riwayat per room cepat
 * (opsional, tapi dianjurkan)
 */
chatMessageSchema.index({ roomId: 1, timestamp: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
