(function () {
  const STORAGE_KEY = 'saas-apps-theme'
  const ICON_BASE = 'assets/icons/'

  const SUN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
  const MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'

  function getTheme() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    const icon = document.getElementById('theme-icon')
    if (icon) icon.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG
  }

  function renderCatalog() {
    const catalog = document.getElementById('catalog')
    const countEl = document.getElementById('app-count')
    const categories = window.SAAS_APPS_CATALOG || []
    if (!catalog) return

    if (!categories.length) {
      catalog.innerHTML =
        '<section class="catalog-error">' +
        '<h2>Could not load apps</h2>' +
        '<p>The app catalog did not load. If you manage this site, ensure <code>apps-data.js</code>, <code>saas-home.js</code>, and <code>saas-home.css</code> are included in the deployment (GitHub Actions workflow or <code>docs/</code> folder).</p>' +
        '</section>'
      if (countEl) countEl.textContent = ''
      return
    }
    let totalApps = 0
    catalog.innerHTML = ''

    categories.forEach(function (cat) {
      totalApps += cat.apps.length
      const panel = document.createElement('section')
      panel.className = 'category-panel'
      panel.setAttribute('data-app-count', String(cat.apps.length))
      panel.setAttribute('aria-labelledby', 'cat-' + cat.id)

      const head = document.createElement('div')
      head.className = 'category-head'
      head.innerHTML =
        '<h2 class="category-title" id="cat-' + cat.id + '">' + cat.title + '</h2>' +
        (cat.description ? '<p class="category-desc">' + cat.description + '</p>' : '')

      const appsWrap = document.createElement('div')
      appsWrap.className = 'category-apps'

      cat.apps.forEach(function (app) {
        const link = document.createElement('a')
        link.className = 'app-link'
        link.href = app.href
        link.title = app.name
        link.innerHTML =
          '<span class="app-icon"><img src="' + ICON_BASE + app.icon + '" alt="" loading="lazy" width="26" height="26"></span>' +
          '<span class="app-name">' + app.name + '</span>'
        appsWrap.appendChild(link)
      })

      panel.appendChild(head)
      panel.appendChild(appsWrap)
      catalog.appendChild(panel)
    })

    if (countEl) {
      countEl.textContent = totalApps + ' apps'
    }
  }

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', function () {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark')
  })
  setTheme(getTheme())

  renderCatalog()

  // Settings modal
  const modal = document.getElementById('settings-modal')
  const keys = ['openai', 'unsplash', 'giphy', 'pixabay', 'pexels', 'googleClientId', 'metaAccessToken', 'metaAdAccountId', 'metaPageId']

  function updateStorageStatus() {
    const data = window.SaasApiKeys ? window.SaasApiKeys.load() : {}
    const driveStatus = document.getElementById('storage-drive-status')
    const driveDisconnect = document.getElementById('storage-disconnect-drive')
    const folderStatus = document.getElementById('storage-folder-status')
    const folderDisconnect = document.getElementById('storage-disconnect-folder')

    if (driveStatus) {
      if (data.googleDriveAccessToken) {
        driveStatus.textContent = 'Connected to Google Drive'
        if (driveDisconnect) driveDisconnect.style.display = 'inline-block'
      } else {
        driveStatus.textContent = 'Connect to Google Drive'
        if (driveDisconnect) driveDisconnect.style.display = 'none'
      }
    }

    const folderName = data.localFolderName || (window.SaasStorage && window.SaasStorage.localFolderName)
    if (folderStatus) {
      if (folderName) {
        folderStatus.textContent = folderName.length > 30 ? folderName.slice(0, 27) + '...' : folderName
        if (folderDisconnect) folderDisconnect.style.display = 'inline-block'
      } else {
        folderStatus.textContent = 'Choose local folder'
        if (folderDisconnect) folderDisconnect.style.display = 'none'
      }
    }
  }

  function openSettings() {
    if (window.SaasApiKeys) {
      const data = window.SaasApiKeys.load()
      keys.forEach(function (k) {
        const el = document.getElementById('key-' + k)
        if (el) el.value = data[k] || ''
      })
    }
    updateStorageStatus()
    if (modal) modal.style.display = 'flex'
  }

  function closeSettings() {
    if (modal) modal.style.display = 'none'
  }

  function saveSettings() {
    if (!window.SaasApiKeys) return
    const data = {}
    keys.forEach(function (k) {
      const el = document.getElementById('key-' + k)
      if (el) data[k] = (el.value || '').trim()
    })
    window.SaasApiKeys.save(data)
    closeSettings()
  }

  document.getElementById('settings-btn')?.addEventListener('click', openSettings)
  document.getElementById('settings-close')?.addEventListener('click', closeSettings)
  document.getElementById('settings-cancel')?.addEventListener('click', closeSettings)
  document.getElementById('settings-save')?.addEventListener('click', saveSettings)
  modal?.addEventListener('click', function (e) {
    if (e.target === modal) closeSettings()
  })
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal?.style.display === 'flex') closeSettings()
  })

  document.getElementById('storage-connect-drive')?.addEventListener('click', function () {
    if (!window.SaasApiKeys) return
    const data = window.SaasApiKeys.load()
    const clientId = (data.googleClientId || '').trim()
    if (!clientId) {
      alert('Please enter a Google Client ID in the API Keys section first.')
      return
    }
    const base = window.location.href.replace(/\/[^/]*$/, '')
    const redirectUri = (base.endsWith('/') ? base : base + '/') + 'google-drive-callback.html'
    const scope = 'https://www.googleapis.com/auth/drive.readonly'
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&response_type=token&scope=' + encodeURIComponent(scope)
    window.open(url, 'saas-google-drive', 'width=500,height=600')
  })

  document.getElementById('storage-disconnect-drive')?.addEventListener('click', function () {
    if (!window.SaasApiKeys) return
    window.SaasApiKeys.save({ googleDriveAccessToken: '' })
    updateStorageStatus()
  })

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'saas-google-drive-token' && e.data.token) {
      window.SaasApiKeys.save({ googleDriveAccessToken: e.data.token })
      updateStorageStatus()
    } else if (e.data?.type === 'saas-google-drive-error') {
      alert('Google Drive connection failed: ' + (e.data.error || 'Unknown error'))
    }
  })

  window.SaasStorage = window.SaasStorage || { localFolderHandle: null, localFolderName: '' }

  document.getElementById('storage-choose-folder')?.addEventListener('click', async function () {
    if (!('showDirectoryPicker' in window)) {
      alert('Local folder picker is only supported in Chrome or Edge.')
      return
    }
    try {
      const handle = await window.showDirectoryPicker()
      const name = handle.name
      window.SaasStorage.localFolderHandle = handle
      window.SaasStorage.localFolderName = name
      if (window.SaasStorage.setConnectedLocalFolder) {
        await window.SaasStorage.setConnectedLocalFolder(handle, name)
      }
      if (window.SaasApiKeys) {
        window.SaasApiKeys.save({ localFolderName: name })
      }
      updateStorageStatus()
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Folder picker error:', err)
    }
  })

  document.getElementById('storage-disconnect-folder')?.addEventListener('click', async function () {
    window.SaasStorage.localFolderHandle = null
    window.SaasStorage.localFolderName = ''
    if (window.SaasStorage.clearConnectedLocalFolder) {
      await window.SaasStorage.clearConnectedLocalFolder()
    }
    if (window.SaasApiKeys) {
      window.SaasApiKeys.save({ localFolderName: '' })
    }
    updateStorageStatus()
  })
})()
