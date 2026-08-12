export async function requestApi(path, options = {}, token = null) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.details?.map((item) => item.mensaje).join(' ');
    throw new Error(detail || data.error || 'No fue posible completar la solicitud.');
  }
  return data;
}
