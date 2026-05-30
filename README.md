# CricScore UI

React + Vite frontend for the CricScore backend.

## Local env

Create `.env` in this folder:

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
```

The profile image upload uses Cloudinary unsigned upload. The uploaded image's
`secure_url` is saved into the backend as `profile_picture_url`.

## Run

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

## Build and lint

```bash
npm run lint
npm run build
```

## Team player API used by the UI

The team detail page links existing players through the team-player registry instead of the team update PUT routes.

- `GET /team_players/{team_id}` returns the players linked to a team.
- `POST /team_players` links one existing player to a team.
- Payload example:

```json
{
	"team_id": 20,
	"player_id": 7
}
```

If multiple players are selected in the UI, the app sends one request per player and waits for each request to finish before refreshing the roster.

If you see `404 Not Found` on `PUT /teams/{id}`, the backend in this environment does not expose that route for the UI flow.

# Yourscore
