# Build Instructions

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build:prod
```

### Electron Build
```bash
npm run electron:build
```

## Build Process

### 1. Type Checking
Before building, TypeScript types are checked:
```bash
npm run type-check
```

### 2. Production Build
The production build process:
1. Runs TypeScript type checking
2. Builds optimized bundles with Vite
3. Splits code into optimized chunks
4. Minifies JavaScript and CSS
5. Generates hashed filenames for cache busting

### 3. Electron Packaging
Electron builder packages the app:
- Windows: NSIS installer and portable executable
- Includes all necessary files
- Creates desktop shortcuts
- Sets up auto-update infrastructure (if configured)

## Build Output

### Web Build
- **Location**: `dist/`
- **Structure**:
  ```
  dist/
  ├── index.html
  ├── assets/
  │   ├── js/
  │   │   ├── react-vendor-[hash].js
  │   │   ├── ffmpeg-vendor-[hash].js
  │   │   ├── media-vendor-[hash].js
  │   │   ├── vendor-[hash].js
  │   │   └── [name]-[hash].js
  │   ├── images/
  │   └── fonts/
  └── ffmpeg/
  ```

### Electron Build
- **Location**: `release/`
- **Windows**: 
  - `Video Recorder Setup [version].exe` (NSIS installer)
  - `Video Recorder [version].exe` (Portable)

## Build Configuration

### Vite Configuration
- **Minification**: ESBuild (fast and efficient)
- **Source Maps**: Disabled in production
- **Code Splitting**: Automatic with manual chunking
- **Target**: ES2020
- **CSS**: Code splitting enabled

### Chunking Strategy
- **react-vendor**: React and React DOM
- **ffmpeg-vendor**: FFmpeg libraries (large, separate)
- **media-vendor**: Media processing libraries
- **vendor**: All other node_modules
- **App chunks**: Application code split by route

## Performance Optimizations

1. **Lazy Loading**: Heavy components loaded on demand
2. **Tree Shaking**: Unused code eliminated
3. **Asset Optimization**: Small assets inlined (< 4KB)
4. **Cache Busting**: Hashed filenames for long-term caching
5. **Code Splitting**: Smaller initial bundle size

## Troubleshooting

### Build Fails
1. Check TypeScript errors: `npm run type-check`
2. Clear cache: `rm -rf node_modules/.vite dist`
3. Reinstall dependencies: `rm -rf node_modules && npm install`

### Large Bundle Size
- Check chunk sizes in build output
- Review manual chunking in `vite.config.ts`
- Consider additional code splitting

### Electron Build Issues
- Ensure all dependencies are listed in `package.json`
- Check `electron-builder` configuration
- Verify icon files exist if specified

## Environment Variables

Build-time constants (defined in `vite.config.ts`):
- `__APP_VERSION__`: From package.json version
- `__BUILD_TIME__`: ISO timestamp of build
- `__IS_PRODUCTION__`: Boolean production flag

These are available in code via TypeScript definitions.

## Continuous Integration

Example CI/CD pipeline:
```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm ci

- name: Type check
  run: npm run type-check

- name: Build
  run: npm run build:prod

- name: Build Electron
  run: npm run electron:build
```

