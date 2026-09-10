const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const CLUBS_URL = `${API_BASE_URL}/clubs`;

export async function getClubs(signal) {
  const response = await fetch(CLUBS_URL, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch clubs: ${response.status}`);
  }

  return response.json();
}

export async function getSelectedClub(signal) {
  const response = await fetch(`${CLUBS_URL}/selection`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch club selection: ${response.status}`);
  }

  return response.json();
}

export async function getClubPlayers(clubId, signal) {
  const response = await fetch(`${CLUBS_URL}/${clubId}/players`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch club players: ${response.status}`);
  }

  return response.json();
}

export async function selectClub(clubId) {
  const response = await fetch(`${CLUBS_URL}/selection`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clubId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save club selection: ${response.status}`);
  }

  return response.json();
}
