const request = require('supertest');
const app = require('../app');

describe('page routes', () => {
  it('serves home page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
  });

  it('serves play page on canonical URL', async () => {
    const res = await request(app).get('/play');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('id="pauseGame"');
    expect(res.text).toContain('class="roundCount"');
    expect(res.text).toContain('id="shape10"');
  });

  it('redirects legacy play URL', async () => {
    const res = await request(app).get('/play.html');
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/play');
  });
});
