const jsonRequests = new Map();

export function loadJson(path) {
  const key = String(path);
  const cached = jsonRequests.get(key);
  if (cached) return cached;

  const request = fetch(key, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${key}: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      jsonRequests.delete(key);
      throw error;
    });

  jsonRequests.set(key, request);
  return request;
}
