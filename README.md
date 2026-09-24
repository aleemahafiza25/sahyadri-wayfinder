# Sahyadri ground floor wayfinder

A QR-based, editable indoor floor map. This version always starts at the main entrance. Visitors only choose a destination. The entrance QR code links to `https://YOUR-LIVE-DOMAIN/?from=entry`. The browser does not track visitors as they walk.

## Run on your computer

Install Node.js 18 or newer. In this folder, run `npm install` and set an admin password before `npm start`:

- PowerShell: `$env:ADMIN_PASSWORD="choose-a-long-private-password"; npm start`
- macOS/Linux: `ADMIN_PASSWORD='choose-a-long-private-password' npm start`

Open http://localhost:3000. The visitor view works without signing in. Click **Editor sign in** to edit room names, add rooms, move their pins by clicking the plan, assign the closest corridor junction, and save. The entrance QR PNG appears in the editor. Generate it on the live website and paste it at the entrance; a localhost QR will not work on visitors’ phones.

## Deploy

Push this folder to a private Git repository and deploy as a Node web service. Set `ADMIN_PASSWORD` and `SESSION_SECRET` as private environment variables, `COOKIE_SECURE=true` when the site uses HTTPS, and `PUBLIC_URL=https://your-real-domain` before printing QR codes. Build command: `npm install`. Start command: `npm start`.

**Important:** `locations.json` is written by the editor. Hosts with ephemeral disks (including typical free web service instances) can erase edits when the service restarts or redeploys. Use a persistent disk and set `DATA_FILE` to its mounted path, initially copying `locations.json` there. Alternatively move saved locations to a database before relying on the editor in production. Keep `ADMIN_PASSWORD` private. A private Git repository does not restrict access to the visitor website; the password protects edits.

## Verify the floor plan

Room pins and the hand-entered corridor graph are approximations based on the supplied image. Inspect the floor in person before placing QR codes or presenting directions as reliable. The supplied plan does not show a C Programming Lab, so add it only after confirming its location. This is a ground-floor prototype; other floors need their own plans and connection points. Direction text uses orientation from the image, not door-by-door counts.
