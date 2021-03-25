const mongoose = require('mongoose');
const DBRef = mongoose.Schema.Types.ObjectId;

const questionAttemptSchema = new mongoose.Schema({
  question: { type: DBRef, ref: 'Question' },
  answer: { type: String, trim: true },
  correctAnswer: { type: String, trim: true },
  correct: Boolean
})

const attemptSchema = new mongoose.Schema({
  topic: { type: DBRef, ref: 'Topic' },
  quiz: { type: DBRef, ref: 'Quiz' },
  timestamp: { type : Date, default: Date.now },
  name: { type: String, trim: true },
  score: { type: Number },
  total: { type: Number },
  questions: [questionAttemptSchema]
});

module.exports = mongoose.model('Attempt', attemptSchema);
