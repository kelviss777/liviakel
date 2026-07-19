import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Aplicação (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => app.close());
  it('inicializa a aplicação', () => expect(app).toBeDefined());
  it('GET /api/v1/health responde sem Supabase remoto', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      environment: 'test',
      service: 'rumo-ao-sim-api',
    });
  });
});
