export function adminAuthorization(): Record<string, string> {
  const token = sessionStorage.getItem('mse_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
