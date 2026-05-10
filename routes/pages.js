const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/instructions', (req, res) => {
  res.render('instructions');
});

router.get('/play', (req, res) => {
  res.render('play');
});

router.get('/howwasitmade.html', (req, res) => {
  res.redirect(301, '/instructions');
});

router.get('/instructions.html', (req, res) => {
  res.redirect(301, '/instructions');
});

router.get('/play.html', (req, res) => {
  res.redirect(301, '/play');
});

module.exports = router;
