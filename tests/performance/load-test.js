import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Opcional: metric customizada para falhas
const errorRate = new Rate('errors');

export const options = {
  // 100 users virtuais simultâneos, conforme solicitado (Prompt 8: "100 jobs simultâneos")
  stages: [
    { duration: '10s', target: 50 },  // rampa subida
    { duration: '30s', target: 100 }, // pico 100 users
    { duration: '10s', target: 0 },   // rampa descida
  ],
  thresholds: {
    // 95% dos pedidos devem ser resolvidos abaixo de 500ms
    http_req_duration: ['p(95)<500'],
    // Taxa de erros (excluindo 429 Too Many Requests do limitador)
    errors: ['rate<0.1'], // tolerância 10%
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

  // 1. Simular Login
  const loginPayload = JSON.stringify({
    userId: `user-${__VU}-${__ITER}`,
  });
  const loginHeaders = {
    'Content-Type': 'application/json',
    // Mock API key, alterar conforme o env de testes de carga
    'X-API-Key': 'test-secret-12345678901234567890',
  };

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, { headers: loginHeaders });
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    sleep(1);
    return; // não podemos continuar sem token
  }

  const token = loginRes.json('accessToken');

  // 2. Simular Enqueue (Job Upload Mock)
  // Como uploads multipart reais no k6 de videos HD são pesados para a RAM do load generator,
  // vamos simular batendo num endpoint de API ou submetendo pequenos mocks.
  
  // Vamos submeter um pedido fictício ao endpoint de assets
  const boundary = '----WebKitFormBoundaryNexoraLoadTest';
  const payload = `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `MOCK FILE\r\n` +
    `--${boundary}--`;

  const uploadHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  };

  const uploadRes = http.post(`${BASE_URL}/api/v1/assets/upload`, payload, { headers: uploadHeaders });
  
  const ok = check(uploadRes, {
    'upload status 201 or 429 (rate limit)': (r) => r.status === 201 || r.status === 429,
  });

  if (!ok && uploadRes.status !== 429) {
    errorRate.add(1);
  }

  sleep(Math.random() * 2); // Espera aleatória 0-2s para simular distanciamento humano
}
