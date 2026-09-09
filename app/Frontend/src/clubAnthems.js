const CLUB_ANTHEM_VIDEO_IDS = {
  49: "z9ZaHM8e0lY", // AC Milan — "Milan Milan, solo con te" (Inno Milan 1988)
};

export function getClubAnthemVideoId(clubId) {
  return CLUB_ANTHEM_VIDEO_IDS[clubId] ?? null;
}
