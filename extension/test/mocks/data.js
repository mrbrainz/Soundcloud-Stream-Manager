// Canned SoundCloud API data for the mock test harness. Keyed by permalink
// path so both /resolve (by URL) and the feed fixture's hrefs line up.
//
// Add a new scenario by adding an entry here, then referencing its
// permalink path from a fixture's markup — no other wiring needed, the
// mock API/DOM layer picks it up automatically.
window.__SCSM_MOCK_DATA__ = {
  tracks: {
    // Old repost — should trip "hide tracks older than X days" and show a
    // large age in "show repost age".
    '/testartist/old-repost-track': {
      id: 1001,
      kind: 'track',
      title: 'Old Repost Track',
      permalink_url: 'https://soundcloud.com/testartist/old-repost-track',
      created_at: '2023-01-15T10:00:00Z',
      duration: 210000, // 3:30
      downloadable: false,
    },
    // Recent repost — should NOT trip the age filter.
    '/testartist/recent-repost-track': {
      id: 1002,
      kind: 'track',
      title: 'Recent Repost Track',
      permalink_url: 'https://soundcloud.com/testartist/recent-repost-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      duration: 195000, // 3:15
      downloadable: true,
    },
    // Original upload, long mix — should trip "hide tracks longer than X
    // minutes" (default 25).
    '/testartist/long-mix': {
      id: 1003,
      kind: 'track',
      title: 'Long Mix Session',
      permalink_url: 'https://soundcloud.com/testartist/long-mix',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
      duration: 32 * 60 * 1000, // 32 min
      downloadable: false,
    },
    // Original upload, short + downloadable — happy path for the download
    // button and search-link features, should NOT trip either hide filter.
    '/testartist/short-downloadable-track': {
      id: 1004,
      kind: 'track',
      title: 'Short Downloadable Track',
      permalink_url: 'https://soundcloud.com/testartist/short-downloadable-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      duration: 180000, // 3:00
      downloadable: true,
      download_url: 'https://api-v2.soundcloud.com/tracks/1004/download',
    },
    // Already sits in "My Favourites" and "Techno 2026" per the playlists
    // mock below — happy path for "show playlist membership".
    '/testartist/in-playlist-track': {
      id: 1005,
      kind: 'track',
      title: 'In Playlist Track',
      permalink_url: 'https://soundcloud.com/testartist/in-playlist-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(), // 40 days ago
      duration: 240000, // 4:00
      downloadable: false,
    },
  },

  // GET /users/{id}/playlists — one page, matches the shape
  // references/soundcloud-playlist-membership.user.js expects (each
  // playlist embeds its full track list).
  playlistsPage: {
    collection: [
      {
        id: 5001,
        title: 'My Favourites',
        tracks: [
          { id: 1005, permalink_url: 'https://soundcloud.com/testartist/in-playlist-track' },
        ],
      },
      {
        id: 5002,
        title: 'Techno 2026',
        tracks: [
          { id: 1005, permalink_url: 'https://soundcloud.com/testartist/in-playlist-track' },
          { id: 1002, permalink_url: 'https://soundcloud.com/testartist/recent-repost-track' },
        ],
      },
    ],
  },

  // Fake page hydration state, mirroring what getClientId()/getMyUserId()
  // in the reference scripts read from window.__sc_hydration.
  hydration: [
    { hydratable: 'apiClient', data: { id: 'mock-client-id-123' } },
    { hydratable: 'meUser', data: { id: 999 } },
  ],
};
