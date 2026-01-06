# Setting Up Google OAuth

The hosted version at `mjaverto.github.io/yearbird` uses a shared OAuth client.
If you're self-hosting, you'll need your own Google Cloud project.

## Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Yearbird" (or anything you like)
4. Click "Create"

### 2. Enable the Google Calendar API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it, then click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you have Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: Yearbird
   - **User support email**: your email
   - **Developer contact**: your email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes**
7. Find and select: `https://www.googleapis.com/auth/calendar.readonly`
8. Click **Update**, then **Save and Continue**
9. On **Test users**, add your email address
10. Click **Save and Continue**, then **Back to Dashboard**

### 4. Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "Yearbird Web Client"
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - `https://yourusername.github.io` (for production)
6. Click **Create**
7. Copy the **Client ID** (it looks like `xxx.apps.googleusercontent.com`)

### 5. Configure Yearbird

The repo ships with a shared client ID in `.env` for the hosted demo. Create a
`.env.local` file in your project root to override it with your own client ID:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

**Important:** Never commit `.env.local` to git!

### 6. Test It

1. Start the dev server: `npm run dev`
2. Click "Sign in with Google"
3. Complete the OAuth flow
4. You should see your calendar events!

## App Verification (Optional)

If you're running Yearbird for just yourself or a small group, you don't need to verify. Google will show a warning screen, but you can click through it.

For production use with many users:

1. Submit your app for verification
2. You'll need:
   - A privacy policy URL
   - An explanation of how you use the data
3. Review takes 1-2 weeks

## Troubleshooting

### "This app isn't verified" warning

This is normal for unverified apps. Click:
1. **Advanced**
2. **Go to Yearbird (unsafe)**

### "Access blocked: This app's request is invalid"

- Check that your authorized JavaScript origins include the exact URL
- Make sure you're using `http://` for localhost, not `https://`
- Verify the Client ID is correct in `.env.local`

### "Invalid client" error

- Double-check your Client ID
- Make sure you're using the full ID including `.apps.googleusercontent.com`

### CORS errors

- Ensure your origin is in the authorized JavaScript origins
- Origins are exact matches — `localhost:5173` ≠ `localhost:5174`

## Security Notes

- We only request `calendar.readonly` — Yearbird cannot modify your calendar
- Your calendar data never leaves your browser
- OAuth tokens are stored in localStorage (cleared on sign out)
- We don't store any data on servers
