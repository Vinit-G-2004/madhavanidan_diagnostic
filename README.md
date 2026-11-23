# Madhavanidan Diagnostic — website + admin panel

- **Website:** `/` (home with 3D scroll), `/blog`, `/launches`, `/post/<id>`
- **Admin panel:** `/admin`, protected by a username and password

Hosted on **Vercel**. Posts are stored in **Upstash Redis** and cover images in **Vercel Blob**. Both are free to start and you add them from the Vercel dashboard.

---

## Run it on your computer (VS Code)
Needs **Node.js 18 or newer** (nodejs.org). In VS Code: **File → Open Folder** → this folder, then **Terminal → New Terminal**:

```bash
npm install
npm run dev
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (login `admin` / `local-preview-123`)
- Stop with **Ctrl + C**. Local posts and images are kept in memory and reset each time.

---

## 1. Put the code on GitHub
Create a new repository (e.g. `madhavanidan-website`) and upload everything in this folder, **except** `node_modules`.

## 2. Import it into Vercel
Vercel → **Add New… → Project** → pick the repository → **Deploy**.
No build settings are needed. Vercel detects the `public/` folder and the `api/` functions on its own.

## 3. Connect storage (in the Vercel project → **Storage**)
1. **Create → Upstash for Redis** (from the Marketplace) → connect it to this project.
   This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `_TOKEN`) automatically.
2. **Create → Blob** → choose **Public** access → connect it to this project.
   This adds `BLOB_READ_WRITE_TOKEN` automatically.

## 4. Create the admin login
On any computer with Node.js 18+, open this folder in a terminal:

```bash
npm install
npm run hash-password -- "Choose-A-Strong-Password"
npm run make-secret
```

Then in Vercel → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_USERNAME` | the username, e.g. `admin@madhvanidandiagnostic.com` |
| `ADMIN_PASSWORD_HASH` | the line printed by `hash-password` (starts with `scrypt$`) |
| `SESSION_SECRET` | the line printed by `make-secret` |

The real password is **never stored**, only its hash. Then **Deployments → ⋯ → Redeploy**.

## 5. Connect the domain
Vercel → **Settings → Domains** → add `madhvanidandiagnostic.com` and follow the DNS steps shown.
After that, the admin panel lives at **https://madhvanidandiagnostic.com/admin**.

---

## Security built in
- Password stored as a salted **scrypt** hash, never in plain text
- Session in a signed **HttpOnly, Secure, SameSite=Strict** cookie that lasts 8 hours
- **5 failed logins per IP → locked for 15 minutes**
- Admin writes accepted only from the site's own admin page (cross-site requests blocked)
- Drafts are never sent to the public website
- `/admin` is marked `noindex` so search engines don't list it
- All post text is escaped, so pasted HTML or scripts can't run on the site

**Change the password:** run `hash-password` again, update `ADMIN_PASSWORD_HASH` in Vercel and redeploy.
**Sign everyone out:** change `SESSION_SECRET` and redeploy.

## Writing posts
- Leave a blank line between paragraphs. Start a line with `## ` for a heading or `- ` for a bullet.
- "New launch / feature" posts can carry a price or offer. They get a **Book this test** button and appear in the booking form.
- Tick **Feature on the home page** to show a post in the home page's "What's new" section (it shows the 3 newest posts, featured ones first).
- Published posts appear on the site within about a minute.
