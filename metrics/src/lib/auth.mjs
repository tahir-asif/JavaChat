const AUTH_BASE_URL = process.env.AUTH_BASE_URL ?? 'http://localhost:8080';

async function postJson(path, body) {
  return fetch(`${AUTH_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function registerUser(username, password) {
  let response = await postJson('/api/auth/register', { username, password });
  if (response.ok) {
    const { token } = await response.json();
    return { username, token };
  }

  // A gateway retry can re-submit a registration that already succeeded.
  if (response.status === 400) {
    response = await postJson('/api/auth/login', { username, password });
    if (response.ok) {
      const { token } = await response.json();
      return { username, token };
    }
  }

  const detail = await response.text().catch(() => '');
  throw new Error(`failed to create ${username}: HTTP ${response.status} ${detail}`);
}

export async function registerUsers(count, runId, concurrency = 8) {
  const users = Array.from({ length: count }, (_, index) => ({
    username: `metrics_${runId}_${index}`,
    password: `metrics_pw_${runId}_${index}`
  }));

  const results = new Array(users.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= users.length) return;
      results[index] = await registerUser(users[index].username, users[index].password);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, users.length) }, () => worker())
  );

  return results;
}
