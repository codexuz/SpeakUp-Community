# Local HTTPS Setup

This project supports local HTTPS for the API server and custom local domains for Expo-to-server requests.

Recommended approach

Use `mkcert`, which the web.dev guide recommends for local development because it creates certificates trusted by your local machine and browser.

Important

- Do not use `npm install -g mkcert` for this setup. That installs a different Node CLI with the same name.
- Use the official `FiloSottile/mkcert` binary so commands like `mkcert -install` and `mkcert api.speakup.local localhost 127.0.0.1 ::1` work as documented.

1. Install `mkcert`.
	Windows options for the official binary:
	- `winget install FiloSottile.mkcert`
	- Or download from the GitHub releases page: <https://github.com/FiloSottile/mkcert/releases>
2. Run `mkcert -install` once on your machine.
3. Generate a certificate for your local API host, for example:

```powershell
mkcert api.speakup.local localhost 127.0.0.1 ::1
```

4. Map the custom host to your machine in your hosts file.

Windows hosts file:

```text
127.0.0.1 api.speakup.local
```

5. Start the server with HTTPS environment variables:

```powershell
$env:JWT_SECRET="replace-me"
$env:PUBLIC_HOSTNAME="api.speakup.local"
$env:SSL_CERT_FILE="C:\path\to\api.speakup.local+3.pem"
$env:SSL_KEY_FILE="C:\path\to\api.speakup.local+3-key.pem"
$env:ALLOWED_ORIGINS="https://localhost:8081,https://api.speakup.local:8081,exp://127.0.0.1:8081"
Set-Location .\server
npm run dev
```

Or use the one-command helper:

```powershell
Set-Location .\server
npm run dev:https
```

Optional helper arguments:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-https.ps1 -Domain api.speakup.local -Port 3000 -CertDir .\certs
```

6. Point the Expo app at the HTTPS API:

```dotenv
EXPO_PUBLIC_API_SCHEME=https
EXPO_PUBLIC_API_HOST=api.speakup.local
EXPO_PUBLIC_API_PORT=3000
```

Notes

- The server falls back to plain HTTP if `SSL_CERT_FILE` and `SSL_KEY_FILE` are not set.
- `PUBLIC_HOSTNAME` controls the URL shown in server startup logs.
- `ALLOWED_ORIGINS` is optional. If omitted, CORS allows all origins in development.
- Never share `mkcert` root CA private keys. The web.dev guidance explicitly warns against exporting or committing them.