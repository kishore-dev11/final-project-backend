const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  uid: String,
  name: String,
  image: String,
  price: Number,
  originalPrice: Number,
  category: String,
  description: String,
  stock: Number,
});

module.exports = mongoose.model("Product", productSchema);