const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const LEAGUES_URL = `${API_BASE_URL}/leagues`;

export async function getLeagueStats(slug, signal) {
  const response = await fetch(`${LEAGUES_URL}/${slug}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch league stats: ${response.status}`);
  }

  return response.json();
}
