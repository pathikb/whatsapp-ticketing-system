const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('Pass API', () => {
  let authToken;
  let userId;
  let eventId;
  let passId;

  beforeAll(async () => {
    // Initialize test database
    await new Promise((resolve) => {
      db.run('DELETE FROM passes', () => {
        db.run('DELETE FROM events', () => {
          db.run('DELETE FROM users', resolve);
        });
      });
    });

    // Register a test user
    const userRes = await request(app)
      .post('/users/register')
      .send({
        name: 'Test User',
        phone: '1234567890',
        email: 'user@test.com'
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

    eventId = eventRes.body.id;
  });

  describe('POST /passes', () => {
    it('should create a new pass', async () => {
      const res = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: eventId,
          category: 'Gold'
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      passId = res.body.id;
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/passes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId: 'invalid',
          category: 'Invalid'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /passes/:id', () => {
    it('should get pass details', async () => {
      const res = await request(app)
        .get(`/passes/${passId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', passId);
    });

    it('should return 404 for non-existent pass', async () => {
      const res = await request(app)
        .get('/passes/9999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /passes/event/:eventId', () => {
    it('should get all passes for an event', async () => {
      const res = await request(app)
        .get(`/passes/event/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });

  describe('GET /passes/user/:userId', () => {
    it('should get all passes for a user', async () => {
      const res = await request(app)
        .get(`/passes/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });
});