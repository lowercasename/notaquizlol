const mongoose = require('mongoose');
const DBRef = mongoose.Schema.Types.ObjectId;

const topicSchema = new mongoose.Schema({
  user: { type: DBRef, ref: 'User' },
  name: { type: String, trim: true, required: true },
});

module.exports = mongoose.model('Topic', topicSchema);
