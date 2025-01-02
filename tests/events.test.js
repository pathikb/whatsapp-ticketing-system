const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('Event API', () => {
  let authToken;
  let userId;
  let eventId;

  beforeAll(async () => {
    // Initialize test database
    await new Promise((resolve) => {
      db.run('DELETE FROM users', () => {
        db.run('DELETE FROM events', resolve);
      });
    });

    // Register a test user
    const userRes = await request(app)
      .post('/users/register')
      .send({
        name: 'Test Organizer',
        phone: '1234567890',
        email: 'organizer@test.com'
      });
    
    authToken = userRes.body.token;
    userId = userRes.body.id;

    // Create a test event
    const eventRes = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Event',
        description: 'This is a test event',
        date: '2025-12-31T23:59:59Z',
        location: 'Test Location',
        goldPassLimit: 10,
        silverPassLimit: 20,
        platinumPassLimit: 5
      });

    if (eventRes.statusCode !== 201) {
      console.error('Event creation failed:', eventRes.body);
    }
    eventId = eventRes.body.id;
  });

  describe('POST /events', () => {
    it('should create a new event', async () => {
      const res = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Event',
          description: 'This is a test event',
          date: '2025-12-31T23:59:59Z',
          location: 'Test Location',
          goldPassLimit: 10,
          silverPassLimit: 20,
          platinumPassLimit: 5
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          date: 'invalid',
          location: ''
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /events', () => {
    it('should get all events', async () => {
      const res = await request(app)
        .get('/events');
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });

  describe('GET /events/:id', () => {
    it('should get event details', async () => {
      const res = await request(app)
        .get(`/events/${eventId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', eventId);
    });
  });

  describe('PUT /events/:id', () => {
    it('should update an event', async () => {
      const res = await request(app)
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Event',
          description: 'Updated Description',
          date: '2026-01-01T00:00:00Z',
          location: 'Updated Location'
        });
      
      expect(res.statusCode).toEqual(200);
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app)
        .put('/events/9999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Non-existent Event'
        });
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /events/:id', () => {
    it('should delete an event', async () => {
      const res = await request(app)
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(200);
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app)
        .delete('/events/9999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(404);
    });
  });
});