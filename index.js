const express = require('express')
const app = express()
const port = 9988

const { nanoid } = require('nanoid')

require('dotenv').config();
const fs = require('fs')
const csv = require('csv-parser')

const bcrypt = require('bcryptjs');

app.use(express.static('public'))
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));

app.use(express.urlencoded());

const handlebars = require('express-handlebars');

app.engine('.hbs', handlebars({
  layoutsDir: __dirname + '/views/layouts',
  extname: '.hbs'
}));

app.set('view engine', '.hbs');

const { check, validationResult } = require('express-validator');

const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection
  .on('open', () => {
    console.log('Mongoose connection open');
  })
  .on('error', (err) => {
    console.log(`Connection error: ${err.message}`);
  });

const session = require('express-session');
const Topic = require('./models/Topic');
const Question = require('./models/Question');
var MongoDBStore = require('connect-mongodb-session')(session);

const store = new MongoDBStore({
  uri: process.env.DATABASE,
  collection: 'sessions'
});

app.use(session({
  secret: 'notaquizdotlol',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  store: store,
  resave: true,
  saveUninitialized: true
}));

// Custom flash middleware -- from Ethan Brown's book, 'Web Development with Node & Express'
app.use(function (req, res, next) {
  // if there's a flash message in the session request, make it available in the response, then delete it
  res.locals.sessionFlash = req.session.sessionFlash;
  delete req.session.sessionFlash;
  next();
});

const multer  = require('multer');
const Quiz = require('./models/Quiz');
const Attempt = require('./models/Attempt');
const upload = multer({ dest: 'uploads/' })

const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    res.redirect('/');
  } else {
    next();
  }
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

app.get('/quiz/:shareCode', async (req, res) => {
  const quiz = await Quiz.findOne({ shareCode: req.params.shareCode }).lean()
  if (quiz) {
    res.render('quiz', { quiz, layout: 'quiz' })
  } else {
    res.redirect('/')
  }
})

app.get('/api/quiz/:quizId', async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.quizId })
  if (quiz) {
    console.log(quiz)
    let questions = await Question.find({ topic: quiz.topic, type: quiz.questionType }).lean()
    if (quiz.shuffle) {
      shuffleArray(questions)
    }
    let finalQuestions = []
    for (let i = 0; i < quiz.numberOfQuestions; i++) {
      if (i >= questions.length) {
        finalQuestions.push(questions[Math.floor(Math.random() * questions.length)])
      } else {
        finalQuestions.push(questions[i])
      }
    }
    finalQuestions = finalQuestions.filter(v => v !== undefined && v !== null);
    if (quiz.reverse) {
      finalQuestions.forEach(o => {
        // 50% chance of a reversal
        if (o.type === 'single' && Math.random() > 0.5) {
          let newAnswer = [o.question]
          let newQuestion = o.answers[0]
          o.answers = newAnswer
          o.question = newQuestion
        }
      })
    }
    console.log(finalQuestions)
    return res.send({ quiz, questions: finalQuestions })
  } else {
    return res.sendStatus(404)
  }
})

app.post('/api/attempt', async (req, res) => {
  console.log(req.body)
  const attempt = new Attempt({
    topic: req.body.topicId,
    quiz: req.body.quizId,
    name: req.body.name,
    timestamp: Date().now,
    score: req.body.questions.filter(o => o.correct == 'true').length,
    total: req.body.questions.length,
    questions: req.body.questions
  })
  attempt.save()
  res.sendStatus(200)
})


app.get('/', (req, res) => {
  res.render('landing', { flash: res.locals.sessionFlash });
})

app.get('/create-account', (req, res) => {
  res.render('create-account', { flash: res.locals.sessionFlash });
})

app.get('/sign-out', (req, res) => {
  req.session.user = false;
  res.redirect('/')
})

app.get('/dashboard', checkAuth, async (req, res) => {
  let topics = await Topic.find({ user: req.session.user._id }).lean()
  res.render('dashboard', { user: req.session.user, topics, flash: res.locals.sessionFlash })
})

app.get('/dashboard/topic/:topicId', checkAuth, async (req, res) => {
  const topic = await Topic.findOne({ _id: req.params.topicId }).lean()
  if (topic) {
    const questions = await Question.find({ topic: req.params.topicId }).lean()
    const quizzes = await Quiz.find({ topic: req.params.topicId }).lean()
    res.render('topic', { user: req.session.user, topic, questions, quizzes, flash: res.locals.sessionFlash })
  } else {
    res.redirect('/dashboard')
  }
})

app.get('/dashboard/quiz/:quizId', checkAuth, async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.quizId }).populate('topic').lean()
  if (quiz) {
    const attempts = await Attempt.find({ quiz: quiz._id }).lean()
    attempts.forEach(o => o.timestamp = new Date(o.timestamp).toLocaleTimeString('en-GB') + ' ' + new Date(o.timestamp).toLocaleDateString('en-GB'))
    res.render('analytics', { user: req.session.user, flash: res.locals.sessionFlash, quiz, attempts })
  } else {
    res.redirect('/dashboard')
  }
})

app.post('/api/topic', checkAuth, [
  check('topicName').isLength({ min: 1 }).withMessage('Please enter a topic name.')
], (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    const topic = new Topic({
      name: req.body.topicName,
      user: req.session.user._id
    })
    topic.save()
    res.redirect(`/dashboard/topic/${topic._id}`)
  }
  else {
    req.session.sessionFlash = {
      type: 'danger',
      errors: errors.array(),
      topicName: req.body.topicName,
    }
    res.redirect('/dashboard');
  }
})

app.delete('/api/topic', checkAuth, async (req, res) => {
  if (req.body.topicId) {
    const topicResult = await Topic.deleteOne({ _id: req.body.topicId })
    if (topicResult.deletedCount === 1) {
      const questionsResult = await Question.deleteMany({ topic: req.body.topicId })
      const quizResult = await Quiz.deleteMany({ topic: req.body.topicId })
      const attemptResult = await Attempt.deleteMany({ topic: req.body.topicId })
      return res.sendStatus(200)
    }
  } else {
    return res.sendStatus(404)
  }
})

app.post('/api/quiz', checkAuth, [
  check('quizName').isLength({ min: 1}).withMessage('Please enter a quiz name.'),
  check('type').isIn(['single', 'multiple']).withMessage('Please select a quiz type.'),
  check('numberOfQuestions').isInt({min: 1}).withMessage('Please enter the number of questions.')
], async (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    const shuffleQuestions = req.body.shuffleQuestions ? true : false
    const reverseQuestions = req.body.reverseQuestions ? true : false
    const quiz = new Quiz({
      topic: req.body.topic,
      name: req.body.quizName,
      description: req.body.description,
      questionType: req.body.type,
      shuffle: shuffleQuestions,
      reverse: reverseQuestions,
      numberOfQuestions: req.body.numberOfQuestions,
      shareCode: nanoid(),
    })
    await quiz.save()
    res.redirect('back')
  } else {
    req.session.sessionFlash = {
      type: 'danger',
      errors: errors.array(),
      quizName: req.body.quizName,
      quizDescription: req.body.description,
    }
    res.redirect('back');
  }
})

app.delete('/api/quiz', checkAuth, async (req, res) => {
  if (req.body.quizId) {
    const result = await Quiz.deleteOne({ _id: req.body.quizId })
    if (result.deletedCount === 1) {
      return res.sendStatus(200)
    }
  } else {
    return res.sendStatus(404)
  }
})


app.delete('/api/question', checkAuth, async (req, res) => {
  if (req.body.questionId) {
    const result = await Question.deleteOne({ _id: req.body.questionId })
    if (result.deletedCount === 1) {
      return res.sendStatus(200)
    }
  } else {
    return res.sendStatus(404)
  }
})

app.post('/api/csv', checkAuth, upload.single('csv'), async (req, res) => {
  console.log(req.file)
  function redirect(errors) {
    req.session.sessionFlash = {
      type: 'danger',
      errors,
    }
    res.redirect('back');
  }
  if (req.file.mimetype !== 'text/csv') {
    return redirect([{ msg: 'Please upload a .CSV file.' }])
  }
  if (!req.body.topic) {
    // No topic ID supplied - exit here
    return res.sendStatus(500);
  }
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv({ headers: false }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      if (results.length) {
        for (const o of results) {
          const type = Object.keys(o).length === 2 ? 'single' : 'multiple'
          const question = o[0]
          const answers = []
          const wrongAnswers = []
          Object.keys(o).forEach((q, i) => {
            if (i === 1) {
              answers.push(o[i])
            } else if (i > 1) {
              wrongAnswers.push(o[i])
            }
          })
          const newQuestion = new Question({
            topic: req.body.topic,
            type,
            question,
            answers,
            wrongAnswers
          })
          await newQuestion.save()
          console.log('Done')
        }
        console.log('Finished loop')
      }
      res.redirect('back')
    });
})

app.post('/sign-in', [
  check('emailAddress').isEmail().withMessage('Please enter a valid email.'),
  check('password').isLength({ min: 1 }).withMessage('Please enter a password.')
], async (req, res) => {
  function redirect(errors) {
    req.session.sessionFlash = {
      type: 'danger',
      errors,
      emailAddress: req.body.emailAddress
    }
    res.redirect('/');
  }
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    // Does this user exist?
    const user = await User.findOne({ emailAddress: req.body.emailAddress })
    console.log(user)
    if (!user) {
      return redirect([{ msg: "We couldn't log you in. Check your password and try again." }])
    }
    // Check password hash
    if (!bcrypt.compareSync(req.body.password, user.password)) {
      return redirect([{ msg: "We couldn't log you in. Check your password and try again." }])
    }
    // Hooray, we're through!
    req.session.user = user
    res.redirect('/dashboard')
  } else {
    return redirect(errors.array())
  }
})

app.post('/create-account', [
  check('emailAddress').isEmail().withMessage('Please enter a valid email.'),
  check('firstName').isLength({ min: 1 }).withMessage('Please enter a first name.'),
  check('password').isLength({ min: 8 }).withMessage('Please enter a password of 8 characters or longer.').custom(async (password, { req }) => {
    const repeatPassword = req.body.repeatPassword
    if (password !== repeatPassword) {
      throw new Error('Your passwords do not match.')
    }
  }),
], (req, res) => {
  console.log(req.body);
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    // Hash our password
    const hash = bcrypt.hashSync(req.body.password, 10);
    const user = new User({
      emailAddress: req.body.emailAddress,
      firstName: req.body.firstName,
      password: hash,
    })
    user.save()
    req.session.sessionFlash = {
      type: 'success',
      errors: { msg: 'Your account has been created. Please sign in.' }
    }
    res.redirect('/')
  } else {
    console.log(errors.array());
    req.session.sessionFlash = {
      type: 'danger',
      errors: errors.array(),
      firstName: req.body.firstName,
      emailAddress: req.body.emailAddress
    }
    res.redirect('/create-account');
  }
});


app.listen(port, () => {
  console.log(`NotAQuiz.lol listening at http://localhost:${port}`)
})