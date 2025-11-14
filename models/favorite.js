const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  parfumId: Number,
  name: String,
  image: String,
  description: String
});

module.exports = mongoose.model('Favorite', favoriteSchema);
