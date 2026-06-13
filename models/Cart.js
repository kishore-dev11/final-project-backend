const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: String,
  productId: Number,
  name: String,
  image: String,
  price: Number,
  quantity: Number,
});

module.exports = mongoose.model("Cart", cartSchema);