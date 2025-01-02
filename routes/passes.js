const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generate pass for a user for an event
router.post('/', authMiddleware, [
  body('eventId').isInt().withMessage('Event ID must be a valid integer'),
  body('category').isIn(['Gold', 'Silver', 'Platinum']).withMessage('Invalid pass category')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { eventId, category } = req.body;
  const userId = req.user.id;

  try {
    // Check if user already has a pass for this event
    const existingPass = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM passes WHERE userId = ? AND eventId = ?`,
        [userId, eventId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (existingPass) {
      return res.status(400).json({ error: 'User already has a pass for this event' });
    }

    // Insert new pass
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO passes (userId, eventId, category) VALUES (?, ?, ?)`,
        [userId, eventId, category],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    return res.status(201).json({ id: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch pass details by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pass = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM passes WHERE id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Pass not found' });
          resolve(row);
        }
      );
    });

    return res.json(pass);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Fetch all passes for an event
router.get('/event/:eventId', authMiddleware, async (req, res) => {
  try {
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM passes WHERE eventId = ?`,
        [req.params.eventId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    return res.json(passes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch all passes for a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM passes WHERE userId = ?`,
        [req.params.userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    return res.json(passes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;