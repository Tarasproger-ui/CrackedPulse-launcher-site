# CrackedPulse Launcher

This repo contains two things:

- `public/` - static website for GitHub + Vercel.
- `electron/` - local Windows launcher source.

## Vercel

Deploy the repository to Vercel. The build command is:

```bash
npm run build:site
```

The output directory is:

```bash
dist-site
```

## Local Launcher

Run in development:

```bash
npm install
npm start
```

Build Windows executable:

```bash
npm run dist:win
```

The generated launcher file is named `crackedpulse.exe`.

## Game Download

When `Play` is pressed, the launcher checks the selected install folder.
If the required files are missing, it downloads `CrackedPulse.zip` from GitHub Releases automatically:

```text
https://github.com/Tarasproger-ui/CrackedPulse-launcher-site/releases/latest/download/CrackedPulse.zip
```

The zip must contain `loader-1.21.4.ps1`, `game/`, and `launcher/`.
The launcher installs it as a folder named:

```text
CrackedPulse
```

You can change that path in launcher settings.
