const mongoose = require('mongoose');
const DBRef = mongoose.Schema.Types.ObjectId;

const questionSchema = new mongoose.Schema({
  topic: { type: DBRef, ref: 'Topic' },
  type: { type: String, trim: true },
  question: { type: String, trim: true },
  answers: [{ type: String, trim: true }],
  wrongAnswers: [{ type: String, trim: true }],
});

module.exports = mongoose.model('Question', questionSchema);
