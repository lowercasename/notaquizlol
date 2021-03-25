const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, required: true },
  emailAddress: { type: String, trim: true, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model('User', userSchema);
