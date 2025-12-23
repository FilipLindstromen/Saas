# Building Windows .exe from Video Recorder

This guide explains how to build a Windows executable (.exe) from the Video Recorder application.

## Prerequisites

1. **Node.js** (v18 or higher) installed
2. **npm** or **yarn** package manager
3. **Windows** operating system (for building Windows executables)

## Installation

1. Install dependencies (including Electron):
```bash
npm install
```

## Development with Electron

To run the app in Electron during development:
```bash
npm run electron:dev
```

This will:
- Start the Vite dev server
- Launch Electron when the server is ready
- Enable hot-reload during development

## Building the .exe

### Option 1: Create Installer (Recommended)

Creates a Windows installer (.exe installer):
```bash
npm run electron:build
```

The installer will be created in the `release` folder.

### Option 2: Create Portable Executable

Creates a portable .exe that doesn't require installation:
```bash
npm run electron:pack
```

The portable executable will be in the `release/win-unpacked` folder.

## Output Files

After building, you'll find:
- **Installer**: `release/Video Recorder Setup 1.0.0.exe` (NSIS installer)
- **Portable**: `release/Video Recorder 1.0.0.exe` (standalone executable)
- **Unpacked**: `release/win-unpacked/` (folder with all app files)

## Building Steps

1. **Build the web app**: The build script first runs `npm run build` which compiles your React app using Vite
2. **Package with Electron**: electron-builder packages the built app into a Windows executable
3. **Output**: The .exe file(s) will be in the `release` directory

## Customization

### Change App Icon

1. Create a `build` folder in the project root
2. Add your icon as `build/icon.ico` (256x256 pixels recommended)
3. The icon will be used in the .exe and installer

### Modify Build Configuration

Edit the `build` section in `package.json` to:
- Change app name and ID
- Modify installer settings
- Add code signing certificates
- Configure auto-updates

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that Vite build succeeds: `npm run build`

### App Doesn't Load

- Ensure `base: './'` is set in `vite.config.ts` (for relative paths)
- Check that `dist/index.html` exists after building
- Verify Electron can access the file paths

### File System Access Issues

The File System Access API used by the app works differently in Electron:
- Electron has access to Node.js file system APIs
- Consider adding Electron-specific file handling if needed

## Distribution

The built executable can be distributed to users who:
- Don't need to install Node.js
- Don't need to run npm commands
- Can simply double-click the .exe to run

## Notes

- First build will download Electron binaries (may take a few minutes)
- Build size will be ~150-200MB (includes Electron runtime)
- Consider code signing for production releases

