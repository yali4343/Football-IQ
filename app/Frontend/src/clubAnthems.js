// Each entry is a YouTube video of that club's fan song/anthem/chant, picked
// by real view count (not just recognizability) among candidates found for
// each club, and confirmed embeddable via YouTube's oEmbed endpoint.

// Serie A — not every club has an entry yet.
const SERIE_A_ANTHEM_VIDEO_IDS = {
  49: "JuRvtv1zXSY", // AC Milan
  50: "-TvkjYlJ3J4", // ACF Fiorentina
  51: "kQwMpd5Cb54", // AS Roma
  52: "ihlECJZqXvQ", // Atalanta BC
  53: "buAbSGS4Nsc", // Bologna FC 1909
  54: "28D-o8uncSE", // Cagliari Calcio
  55: "wmBVWXZFWwU", // Genoa CFC
  56: "7YnXim9Gszc", // FC Internazionale Milano
  57: "U9yPVNfSZ3E", // Juventus FC
  58: "xTi99s0cFGQ", // SS Lazio
  59: "w03agEPEVCQ", // Parma Calcio 1913
  60: "iNvOt2yDUI4", // SSC Napoli
  61: "SHnuzybIuqg", // Udinese Calcio
  62: "SmO6LH-G4lI", // Venezia FC
  63: "M_2_z6Fj9jk", // Frosinone Calcio
  64: "0WME97JYByE", // US Sassuolo Calcio
  65: "eFvpZj25JkQ", // Torino FC
  66: "fMKTE_DJO7o", // US Lecce
  67: "5lsbASxdJnM", // AC Monza
  68: "62L-NA4t6C4", // Como 1907
};

// Premier League — searched specifically for "<club> fan song from inside
// the stadium", so these favor genuine in-stadium fan recordings over
// official/studio anthem uploads. Two are lower-confidence (best available,
// not clearly a real in-stadium recording): Coventry City (28), a
// lyrics-overlay compilation; AFC Bournemouth (27), likewise, and its view
// count is low regardless — worth a second look/replacement.
const PREMIER_LEAGUE_ANTHEM_VIDEO_IDS = {
  9: "QJnO_rhXuxI", // Arsenal FC — fans singing "North London Forever" (16.4K views)
  10: "1_LvqbpZPW4", // Aston Villa FC — "Allez, Allez, Allez" at Villa Park (86K views)
  11: "l1Z4oPmtBgc", // Chelsea FC — "Blue is the Colour" at Stamford Bridge (162K views)
  12: "zEoifRY8ViU", // Everton FC — Z-Cars at the new stadium, official channel (257K views)
  13: "3txnxdA-dyk", // Fulham FC — "Fulham 'Til I Die", official channel (87.3K views)
  14: "U7pciN69n9o", // Liverpool FC — "You'll Never Walk Alone" at Anfield (1.56M views)
  15: "pD0E6kwFnzM", // Manchester City FC — "Blue Moon" at kickoff vs Man Utd (735K views)
  16: "a1nDYrCxeig", // Manchester United FC — Stretford End, Ferguson's last home game (5.4M views)
  17: "WOTBR-AU82s", // Newcastle United FC — "Local Hero" (Stadium Version) entrance song (306K views)
  18: "glvJ2-SPjG8", // Sunderland AFC — "Wise Men Say" at the Stadium of Light (110K views)
  19: "dGl4JmAoSdg", // Tottenham Hotspur FC — fans singing at the stadium (358K views)
  20: "wStgp-VnSmI", // Hull City AFC — 24,000 fans sing "Can't Help Falling in Love" (64.8K views)
  21: "t_Z2XTu8ao4", // Leeds United FC — "Marching On Together" at Elland Road (663K views)
  22: "V-iNPhtOuE0", // Ipswich Town FC — club song at Portman Road (3.2K views, best available)
  23: "_EjqWtKBiI4", // Nottingham Forest FC — "Mull of Kintyre" at the City Ground, official channel (169K views)
  24: "1p70wQajSxs", // Crystal Palace FC — "Glad All Over" fan recording (45.7K views)
  25: "gPEI0G5bCB0", // Brighton & Hove Albion FC — "Sussex by the Sea", promotion party (67.5K views)
  26: "Omee74eSev0", // Brentford FC — "Hey Jude" vs Arsenal, amazing atmosphere (602K views)
  27: "GXy_cFyug5k", // AFC Bournemouth — chants compilation (10.5K views, low confidence)
  28: "ma3doiRm38c", // Coventry City FC — chants compilation (62.2K views, low confidence)
};

// Bundesliga — same "<club> fan song from inside the stadium" search.
// Several high-view candidates turned out to be produced fan songs from a
// "WUMMS"-style channel rather than genuine crowd recordings (verified by
// checking the video title/channel), so those were skipped in favor of a
// confirmed in-stadium recording even at a lower view count — same standard
// applied throughout Premier League. Two are lower-confidence (best
// available for a smaller club, not clearly a widely-recorded moment):
// 1. FSV Mainz 05 (78) and SV 07 Elversberg (85).
const BUNDESLIGA_ANTHEM_VIDEO_IDS = {
  69: "hlZOj_vyYl4", // 1. FC Köln — "Hymne" live (1.72M views)
  70: "-fentUEg6g0", // TSG 1899 Hoffenheim
  71: "BxmIyVpg7cI", // Bayer 04 Leverkusen
  72: "DsvWYxgm9Gk", // Borussia Dortmund
  73: "ipvNrUKGGQA", // FC Bayern München
  74: "ebZS6iHY9OA", // FC Schalke 04
  75: "YCWjlerOH3c", // Hamburger SV
  76: "ggGNcZeQsSg", // VfB Stuttgart
  77: "WMSefVNRuJo", // SV Werder Bremen
  78: "bHeiBwbGPiw", // 1. FSV Mainz 05
  79: "Jci9sTr5goI", // FC Augsburg
  80: "C55ALU_t97M", // SC Freiburg
  81: "SJmIr9wl3xY", // Borussia Mönchengladbach
  82: "_LW8nDcHoYI", // Eintracht Frankfurt
  83: "wnvH9OIMZog", // 1. FC Union Berlin
  84: "UpMMHfDMVUI", // SC Paderborn 07
  85: "Dd-g_hPpWpc", // SV 07 Elversberg
  86: "dch4BuF1tG4", // RB Leipzig
};

// La Liga — same "<club> fan song from inside the stadium" search. A few
// clubs' top-view candidates turned out to be produced anthem uploads from a
// "Himnos de Fútbol / JohnnyMLG"-style channel rather than genuine crowd
// recordings, so those were skipped in favor of a confirmed in-stadium
// recording even at a lower view count — same standard applied throughout
// the other leagues. Five are lower-confidence (best available for a
// smaller fanbase, not clearly a widely-recorded moment): RCD Espanyol (32),
// Getafe CF (34), Levante UD (38), Deportivo Alavés (43), and Real Racing
// Club de Santander (48).
const LA_LIGA_ANTHEM_VIDEO_IDS = {
  29: "eZeC9VguxaA", // Athletic Club
  30: "gqyqaRlGdUU", // Club Atlético de Madrid
  31: "DhkBNSNTktY", // CA Osasuna
  32: "XUbne8Po3tY", // RCD Espanyol de Barcelona
  33: "RisqBSF3BTg", // FC Barcelona
  34: "25fxHSK5pRM", // Getafe CF
  35: "cKLBLj2k2hs", // Málaga CF
  36: "D74ahf_1vzU", // Real Madrid CF
  37: "u-27axzdtn4", // Rayo Vallecano de Madrid
  38: "WTUEbpvrFSI", // Levante UD
  39: "F7u3O0yBUF8", // Real Betis Balompié
  40: "Rs7X3V2xyBA", // Real Sociedad de Fútbol
  41: "R2178RumhXU", // Villarreal CF
  42: "o8kyr5ehBok", // Valencia CF
  43: "y8PuZk-erNo", // Deportivo Alavés
  44: "1-Z4Kq-jnVo", // Elche CF
  45: "m18evrWoDuM", // RC Celta de Vigo
  46: "V9TiXrwiiec", // Sevilla FC
  47: "u7YQuxeNzdc", // RC Deportivo La Coruña
  48: "V_wJkEyPVTc", // Real Racing Club de Santander
};

const CLUB_ANTHEM_VIDEO_IDS = {
  ...SERIE_A_ANTHEM_VIDEO_IDS,
  ...PREMIER_LEAGUE_ANTHEM_VIDEO_IDS,
  ...BUNDESLIGA_ANTHEM_VIDEO_IDS,
  ...LA_LIGA_ANTHEM_VIDEO_IDS,
};

export function getClubAnthemVideoId(clubId) {
  return CLUB_ANTHEM_VIDEO_IDS[clubId] ?? null;
}
