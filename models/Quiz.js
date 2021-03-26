const mongoose = require('mongoose');
const DBRef = mongoose.Schema.Types.ObjectId;

const quizSchema = new mongoose.Schema({
  topic: { type: DBRef, ref: 'Topic' },
  name: { type: String, trim: true },
  description: { type: String, trim: true },
  questionType: { type: String, trim: true },
  // questions: [{ type: DBRef, ref: 'Question' }],
  shuffle: Boolean,
  reverse: Boolean,
  numberOfQuestions: Number,
  shareCode: { type: String, trim: true, unique: true },
});

module.exports = mongoose.model('Quiz', quizSchema);
