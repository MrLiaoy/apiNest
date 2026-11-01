/** Basic Auth：RFC 7617，UTF-8 安全的 Base64 */

export function basicAuthValue(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
