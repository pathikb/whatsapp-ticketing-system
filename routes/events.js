const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Create event
router.post('/', authMiddleware, [
  body('name').notEmpty().withMessage('Name is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('goldPassLimit').isInt({ min: 0 }).withMessage('Gold pass limit must be a positive integer'),
  body('silverPassLimit').isInt({ min: 0 }).withMessage('Silver pass limit must be a positive integer'),
  body('platinumPassLimit').isInt({ min: 0 }).withMessage('Platinum pass limit must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, date, location, goldPassLimit, silverPassLimit, platinumPassLimit } = req.body;

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO events (name, description, date, location, organizerId, goldPassLimit, silverPassLimit, platinumPassLimit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, description, date, location, req.user.id, goldPassLimit, silverPassLimit, platinumPassLimit],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return reject(err);
          }
          resolve(this.lastID);
        }
      );
    });

    return res.status(201).json({ id: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, description, date, location, organizerId, goldPassLimit, silverPassLimit, platinumPassLimit FROM events`,
        (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            return reject(err);
          }
          resolve(rows);
        }
      );
    });

    return res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, description, date, location, organizerId, goldPassLimit, silverPassLimit, platinumPassLimit FROM events WHERE id = ?`,
        [req.params.id],
        (err, row) => {
          if (err) {
            console.error('Database error:', err);
            return reject(err);
          }
          if (!row) return reject({ status: 404, message: 'Event not found' });
          resolve(row);
        }
      );
    });

    return res.json(event);
  } catch (err) {
    console.error('Error fetching event:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Update event
router.put('/:id', authMiddleware, [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('location').optional().notEmpty().withMessage('Location cannot be empty')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, date, location } = req.body;

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE events SET 
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          date = COALESCE(?, date),
          location = COALESCE(?, location)
        WHERE id = ? AND organizerId = ?`,
        [name, description, date, location, req.params.id, req.user.id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return reject(err);
          }
          if (this.changes === 0) return reject({ status: 404, message: 'Event not found or not authorized' });
          resolve();
        }
      );
    });

    return res.status(200).json({ message: 'Event updated successfully' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// Delete event
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM events WHERE id = ? AND organizerId = ?`,
        [req.params.id, req.user.id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return reject(err);
          }
          if (this.changes === 0) return reject({ status: 404, message: 'Event not found or not authorized' });
          resolve();
        }
      );
    });

    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;