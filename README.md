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
# Yourscore
