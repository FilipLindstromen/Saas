# Production Deployment Guide

This document outlines the production-ready features and deployment instructions for the Video Recorder application.

## Production Features

### 1. Build Optimizations
- **Code Splitting**: Automatic code splitting with manual chunking strategy
- **Tree Shaking**: Unused code elimination
- **Minification**: ESBuild minification for optimal bundle size
- **Asset Optimization**: Inline assets < 4KB, optimized file naming with hashes
- **Source Maps**: Disabled in production for security and smaller bundle size

### 2. Error Handling
- **React Error Boundary**: Catches and handles React component errors gracefully
- **Global Error Handlers**: Unhandled errors and promise rejections are caught and logged
- **Error Logging**: Errors are logged to localStorage (last 10 errors) for debugging
- **User-Friendly Error UI**: Users see helpful error messages instead of blank screens

### 3. Performance
- **Lazy Loading**: Heavy components (ScriptStep, RecordStep, EditStep) are lazy-loaded
- **Code Splitting**: Vendor chunks separated (React, FFmpeg, Media libraries)
- **Optimized Chunking**: Better caching with hashed filenames

### 4. Logging
- **Production-Safe Logging**: Console logs automatically removed in production
- **Structured Logging**: Centralized logging utility with log levels
- **Error Reporting**: Errors are captured and can be integrated with services like Sentry

### 5. Security
- **No Source Maps**: Source maps disabled in production builds
- **Context Isolation**: Electron app uses context isolation
- **No Node Integration**: Renderer process doesn't have Node.js access

## Build Commands

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build:prod
```

### Type Checking
```bash
npm run type-check
```

### Electron Build
```bash
# Development
npm run electron:dev

# Production build
npm run electron:build

# Windows only
npm run electron:build:win
```

## Environment Configuration

The app uses build-time constants defined in `vite.config.ts`:
- `__APP_VERSION__`: Application version from package.json
- `__BUILD_TIME__`: ISO timestamp of build time
- `__IS_PRODUCTION__`: Boolean indicating production mode

These are available globally via TypeScript definitions in `src/types/global.d.ts`.

## Production Checklist

Before deploying to production:

- [ ] Run `npm run type-check` to ensure no TypeScript errors
- [ ] Run `npm run build:prod` to create production build
- [ ] Test the production build locally with `npm run preview`
- [ ] Verify error boundary works by intentionally causing an error
- [ ] Check that console logs are not visible in production
- [ ] Verify lazy loading works correctly
- [ ] Test all major features (recording, editing, exporting)
- [ ] Check bundle sizes are reasonable
- [ ] Verify Electron build works correctly
- [ ] Test on target platforms (Windows)

## Bundle Analysis

To analyze bundle size:
1. Build the app: `npm run build:prod`
2. Check the `dist` folder for chunk sizes
3. Use browser DevTools Network tab to see actual load sizes

## Error Monitoring

Errors are automatically logged to:
- Browser console (warnings and errors always shown)
- localStorage key `error_logs` (last 10 errors)

To integrate with external error monitoring:
1. Edit `src/utils/logger.ts`
2. Implement `reportError` method to send to your service (Sentry, LogRocket, etc.)

## Performance Monitoring

Key metrics to monitor:
- Initial load time
- Time to interactive
- Bundle sizes
- Memory usage during recording/editing
- Export performance

## Security Considerations

1. **API Keys**: OpenAI API keys are stored in localStorage (client-side only)
2. **File Access**: Electron app uses File System Access API
3. **CORS**: Proper CORS headers configured for SharedArrayBuffer support
4. **Content Security**: COOP/COEP headers required for FFmpeg WASM

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npm run type-check`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

### Production Build Issues
- Verify all imports use proper paths
- Check for any hardcoded development URLs
- Ensure all environment variables are properly defined

### Electron Build Issues
- Verify electron-builder configuration in package.json
- Check that all required files are included in build.files
- Ensure icon files exist if specified

## Support

For issues or questions:
1. Check error logs in localStorage
2. Review browser console for warnings
3. Check application logs (if logging service integrated)

