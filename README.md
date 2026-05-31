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

## Game Folder

The launcher expects a run-only Minecraft folder with `loader-1.21.4.ps1`, `game/`, and `launcher/`.
By default it looks for:

```text
C:\Users\vital\Downloads\CrackedPulse-RunOnly
```

You can change that path in launcher settings.
