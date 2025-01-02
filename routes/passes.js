const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Generate a new pass
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
    // Check event pass limits
    const event = await new Promise((resolve, reject) => {
      db.get(
        `SELECT goldPassLimit, silverPassLimit, platinumPassLimit FROM events WHERE id = ?`,
        [eventId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject({ status: 404, message: 'Event not found' });
          resolve(row);
        }
      );
    });

    // Check available passes for the selected category
    const passCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM passes WHERE eventId = ? AND category = ?`,
        [eventId, category],
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count);
        }
      );
    });

    const limit = event[`${category.toLowerCase()}PassLimit`];
    if (passCount >= limit) {
      return res.status(400).json({ error: `No more ${category} passes available` });
    }

    // Create the pass
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO passes (eventId, userId, category) VALUES (?, ?, ?)`,
        [eventId, userId, category],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    return res.status(201).json({ id: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Get user's passes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const passes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT p.id, p.eventId, p.category, p.status, p.createdAt, 
                e.name as eventName, e.date as eventDate
         FROM passes p
         JOIN events e ON p.eventId = e.id
         WHERE p.userId = ?`,
        [req.user.id],
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

// Update pass status
router.put('/:id/status', authMiddleware, [
  body('status').isIn(['Active', 'Used', 'Cancelled']).withMessage('Invalid status')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE passes SET status = ? WHERE id = ? AND userId = ?`,
        [status, req.params.id, req.user.id],
        function(err) {
          if (err) return reject(err);
          if (this.changes === 0) {
            return reject({ status: 404, message: 'Pass not found or not authorized' });
          }
          resolve();
        }
      );
    });

    return res.json({ message: 'Pass status updated successfully' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;