const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Register new user
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, phone, email } = req.body;

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (name, phone, email) VALUES (?, ?, ?)`,
        [name, phone, email],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return reject({ status: 400, message: 'Phone or email already exists' });
            }
            return reject(err);
          }
          resolve(this.lastID);
        }
      );
    });

    // Generate JWT
    const token = jwt.sign({ id: result }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.status(201).json({ id: result, token });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, phone, email, createdAt FROM users WHERE id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'User not found' });
          resolve(row);
        }
      );
    });

    res.json(user);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;