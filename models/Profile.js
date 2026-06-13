const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  email: String,
  name: String,
  phone: String,
  gender: String,
  dob: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  profileImage: String,
});

module.exports = mongoose.model("Profile", profileSchema);