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
      genre: 'Trap',
      user: { username: 'Test Artist' },
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
      user: { username: 'Test Artist' },
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
      genre: 'Techno',
      user: { username: 'Mix Master' },
    },
    // Original upload, short, recent, NOT in any playlist - trips ONLY the
    // genre filter (case-mismatched on purpose: mock settings use "drum
    // and bass" lowercase, this track's real genre string is
    // "Drum & Bass" - the match has to be case-insensitive).
    '/testartist/genre-track': {
      id: 1007,
      kind: 'track',
      title: 'Genre Tagged Track',
      permalink_url: 'https://soundcloud.com/testartist/genre-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      duration: 200000, // 3:20
      downloadable: false,
      genre: 'Drum & Bass',
      user: { username: 'Test Artist' },
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
      // NOTE: no download_url field here on purpose - live-verified (#38)
      // that SoundCloud's real /resolve and /tracks responses never
      // include one, even for a genuinely downloadable track. The actual
      // signed link comes from the separate GET /tracks/{id}/download call
      // mocked below via downloadRedirects.
      user: { username: "DJ O'Brien-Smith" },
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
      user: { username: 'Test Artist' },
    },
    // Downloadable, but otherwise untouched by any OTHER fixture/test in
    // this same file - #83's regression test needs a track that's
    // genuinely never been resolved yet, so lib/api.js's cache can't
    // short-circuit past the client_id-not-ready-yet race it's reproducing.
    '/testartist/late-client-id-track': {
      id: 1008,
      kind: 'track',
      title: 'Late Client Id Track',
      permalink_url: 'https://soundcloud.com/testartist/late-client-id-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      duration: 150000,
      downloadable: true,
      user: { username: 'Test Artist' },
    },
    // Downloadable, whose /download redirect HANGS FOREVER (#85's
    // regression test). Three distinct ids (not one reused three times) -
    // getDownloadRedirectUrl dedupes concurrent calls for the SAME track
    // id into one shared in-flight request, so filling all 3 of
    // lib/api.js's MAX_CONCURRENT queue slots with hanging jobs needs 3
    // different tracks, matching how the live bug actually wedged the
    // queue (3 different downloadable tracks each stalling their own
    // /download call).
    '/testartist/hanging-download-track-1': {
      id: 1009,
      kind: 'track',
      title: 'Hanging Download Track 1',
      permalink_url: 'https://soundcloud.com/testartist/hanging-download-track-1',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      duration: 160000,
      downloadable: true,
      user: { username: 'Test Artist' },
    },
    '/testartist/hanging-download-track-2': {
      id: 1010,
      kind: 'track',
      title: 'Hanging Download Track 2',
      permalink_url: 'https://soundcloud.com/testartist/hanging-download-track-2',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      duration: 160000,
      downloadable: true,
      user: { username: 'Test Artist' },
    },
    '/testartist/hanging-download-track-3': {
      id: 1011,
      kind: 'track',
      title: 'Hanging Download Track 3',
      permalink_url: 'https://soundcloud.com/testartist/hanging-download-track-3',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      duration: 160000,
      downloadable: true,
      user: { username: 'Test Artist' },
    },
    // A label/aggregator upload: the account is NOT the real artist. Real
    // example confirmed live (see #36): soundcloud.com/nawtyrecords posts
    // as "Nawty Records" but publisher_metadata.artist is "Neumonic".
    '/nawtyrecords/label-track': {
      id: 1006,
      kind: 'track',
      title: 'Neumonic - Massive',
      permalink_url: 'https://soundcloud.com/nawtyrecords/label-track',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      duration: 200000,
      downloadable: false,
      user: { username: 'Nawty Records' },
      publisher_metadata: { artist: 'Neumonic' },
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

  // trackId -> signed redirect URL, for GET /tracks/{id}/download (see
  // lib/api.js's getDownloadRedirectUrl). Live-verified (#38) that this
  // real endpoint 401s without a real OAuth Authorization header -
  // sc-api-mock.js's handler enforces the same thing, so a regression that
  // drops the header from the real fetch call fails here too.
  downloadRedirects: {
    1004: 'https://cf-media.sndcdn.com/mock-signed-download-1004',
    // A second, otherwise-untouched id for the OAuth-requirement test in
    // downloadbutton-selfcheck.html - using 1004 there too intermittently
    // raced against lib/api.js's own dedupe/inflight tracking for that
    // same id from the earlier button-render step in the same test.
    9999: 'https://cf-media.sndcdn.com/mock-signed-download-9999',
    1008: 'https://cf-media.sndcdn.com/mock-signed-download-1008',
    1009: 'HANG_FOREVER',
    1010: 'HANG_FOREVER',
    1011: 'HANG_FOREVER',
  },
};
