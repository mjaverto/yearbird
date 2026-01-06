# Deployment Guide

Yearbird is a static site that can be hosted anywhere. This guide covers the recommended options.

## GitHub Pages (Recommended)

The repo includes a GitHub Actions workflow that automatically deploys on push to `main`.

### For the Main Repo

Deployment is automatic once GitHub Pages is enabled (Settings → Pages → Source: GitHub Actions). After that, push to `main` and GitHub Actions handles the rest.

### For Forks

1. **Fork the repository**

   Click the "Fork" button on [github.com/mjaverto/yearbird](https://github.com/mjaverto/yearbird)

2. **Enable GitHub Pages**

   - Go to your fork's **Settings** → **Pages**
   - Under "Build and deployment", set **Source** to "GitHub Actions"
   - Click **Save**

3. **Configure OAuth (optional)**

   If you want your own OAuth client:
   - Create a Google Cloud project (see [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md))
   - Add `https://yourusername.github.io` to authorized origins
   - Update the Client ID in your fork

4. **Deploy**

   Push any change to trigger the workflow, or manually run it:
   - Go to **Actions** → **Deploy to GitHub Pages**
   - Click **Run workflow**

5. **Access your site**

   Your site will be at: `https://yourusername.github.io/yearbird/`

### Custom Domain

1. Create a `CNAME` file in the `public/` folder with your domain:
   ```
   yearbird.example.com
   ```

2. Configure DNS according to [GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

3. Update your Google OAuth authorized origins to include your custom domain

## Other Hosting Options

Since Yearbird is a static site, you can host it anywhere.

### Netlify

1. Connect your GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add your Netlify URL to Google OAuth authorized origins

### Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts. Add your Vercel URL to Google OAuth authorized origins.

### Cloudflare Pages

1. Connect your GitHub repo to Cloudflare Pages
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Add your Cloudflare Pages URL to Google OAuth authorized origins

### Self-Hosted (nginx, Apache, etc.)

1. Build the project:
   ```bash
   npm run build
   ```

2. Copy the `dist/` folder to your web server

3. Configure your server to serve `index.html` for all routes (SPA fallback)

   **nginx example:**
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

4. Add your domain to Google OAuth authorized origins

## Environment Variables

For production, you may want to set the Google Client ID via environment variable:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com npm run build
```

Or use a `.env.production` file (don't commit sensitive values!).

## Verifying Deployment

After deploying, verify:

1. **Site loads** — Visit your URL
2. **Assets load** — Check browser console for 404s
3. **OAuth works** — Click "Sign in with Google"
4. **Calendar loads** — Events appear in the grid

## Troubleshooting

### Blank page / 404 on assets

- Check that `base` in `vite.config.ts` matches your deployment path
- For GitHub Pages with repo name: `base: '/yearbird/'`
- For custom domain at root: `base: '/'`

### OAuth redirect fails

- Ensure your production URL is in Google OAuth authorized origins
- Check that it's the exact URL (with or without trailing slash)

### Site not updating after push

- Check the GitHub Actions workflow ran successfully
- Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R)
- Check the workflow logs for errors
