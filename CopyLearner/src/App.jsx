import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BUILT_IN_CATEGORIES, CUSTOM_CATEGORY, DEFAULT_POSTS, accentOf, labelOf } from './data/defaultPosts.js'
import { buildFeed, nextDue } from './utils/spacedRepetition.js'
import { extractTextFromFile, guessFileType } from './utils/fileParsing.js'
import { generateLessonsFromText } from './utils/generateLessons.js'
import {
  isCloudEnabled, getWorkspaceCode, setWorkspaceCode,
  subscribeState, saveState, subscribeSources, createSource, updateSource, deleteSource,
  subscribePosts, addPosts,
} from './utils/storage.js'
import TopBar from './components/TopBar.jsx'
import PostCard from './components/PostCard.jsx'
import SwipeStage from './components/SwipeStage.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import EmptyState from './components/EmptyState.jsx'

const ALL_CATEGORIES = [...BUILT_IN_CATEGORIES, CUSTOM_CATEGORY]
const cloudEnabled = isCloudEnabled()

export default function App() {
  const [workspaceCode, setWorkspaceCodeState] = useState(() => getWorkspaceCode())
  const [ready, setReady] = useState(false)
  const [selectedCats, setSelectedCats] = useState(BUILT_IN_CATEGORIES.map((c) => c.id))
  const [favorites, setFavorites] = useState([])
  const [progress, setProgress] = useState({})
  const [sources, setSources] = useState([])
  const [customPosts, setCustomPosts] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState('feed')
  const [postIdx, setPostIdx] = useState(0)
  const [slideIdx, setSlideIdx] = useState(0)
  const [revealed, setRevealed] = useState({})
  const [quizPick, setQuizPick] = useState(null)

  // Keep a ref of custom posts so the sources subscription (set up once per
  // workspace) can compute live post counts without re-subscribing.
  const customPostsRef = useRef([])
  useEffect(() => { customPostsRef.current = customPosts }, [customPosts])

  // Subscribe to synced state whenever the workspace code changes
  useEffect(() => {
    setReady(false)
    const unsubState = subscribeState((state) => {
      setSelectedCats(state.selectedCats && state.selectedCats.length ? state.selectedCats : BUILT_IN_CATEGORIES.map((c) => c.id))
      setFavorites(state.favorites || [])
      setProgress(state.progress || {})
      setReady(true)
    })
    const unsubSources = subscribeSources((list) => {
      const withCounts = list.map((s) => ({
        ...s,
        postCount: customPostsRef.current.filter((p) => p.sourceId === s.id).length,
      }))
      setSources(withCounts)
    })
    const unsubPosts = subscribePosts((list) => setCustomPosts(list))
    return () => { unsubState(); unsubSources(); unsubPosts() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceCode])

  useEffect(() => {
    setSources((prev) => prev.map((s) => ({ ...s, postCount: customPosts.filter((p) => p.sourceId === s.id).length })))
  }, [customPosts])

  const allPosts = useMemo(() => [...DEFAULT_POSTS, ...customPosts], [customPosts])

  const feed = useMemo(() => {
    if (view === 'favorites') return allPosts.filter((p) => favorites.includes(p.id))
    return buildFeed(allPosts, selectedCats.length ? selectedCats : BUILT_IN_CATEGORIES.map((c) => c.id), progress)
  }, [view, allPosts, selectedCats, progress, favorites])

  const post = feed[postIdx] || null
  const slide = post ? post.slides[slideIdx] : null
  const isLastSlide = post ? slideIdx === post.slides.length - 1 : false
  const isFav = post ? favorites.includes(post.id) : false

  const goPost = useCallback((delta) => {
    setPostIdx((i) => {
      const n = i + delta
      if (n < 0) return feed.length ? feed.length - 1 : 0
      if (n >= feed.length) return 0
      return n
    })
    setSlideIdx(0)
    setRevealed({})
    setQuizPick(null)
  }, [feed.length])

  useEffect(() => { setPostIdx(0); setSlideIdx(0); setRevealed({}); setQuizPick(null) }, [view])
  useEffect(() => {
    if (postIdx >= feed.length && feed.length > 0) setPostIdx(0)
  }, [feed.length, postIdx])

  const goSlide = (delta) => {
    if (!post) return
    const n = slideIdx + delta
    if (n < 0) { goPost(-1); return }
    if (n >= post.slides.length) { goPost(1); return }
    setSlideIdx(n)
    setQuizPick(null)
  }

  const toggleFavorite = () => {
    if (!post) return
    const next = isFav ? favorites.filter((id) => id !== post.id) : [...favorites, post.id]
    setFavorites(next)
    saveState({ favorites: next })
  }

  const rate = (gotIt) => {
    if (!post) return
    const prev = progress[post.id] || { box: 0 }
    const box = gotIt ? prev.box + 1 : 0
    const next = { ...progress, [post.id]: { box, due: nextDue(box), lastSeen: Date.now() } }
    setProgress(next)
    saveState({ progress: next })
    goPost(1)
  }

  const toggleCat = (id) => {
    const next = selectedCats.includes(id) ? selectedCats.filter((c) => c !== id) : [...selectedCats, id]
    const safe = next.length ? next : selectedCats
    setSelectedCats(safe)
    saveState({ selectedCats: safe })
  }

  const runGeneration = async (sourceId, text) => {
    try {
      const posts = await generateLessonsFromText(text, {
        onProgress: () => {},
      })
      if (!posts.length) {
        await updateSource(sourceId, { status: 'error', error: 'Could not find learnable ideas in this content.' })
        return
      }
      await addPosts(sourceId, posts)
      await updateSource(sourceId, { status: 'ready' })
    } catch (err) {
      await updateSource(sourceId, { status: 'error', error: err.message || 'Failed to generate lessons.' })
    }
  }

  const onAddFile = async (file) => {
    const type = guessFileType(file)
    const sourceId = await createSource({ title: file.name, type, text: '' })
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        await updateSource(sourceId, { status: 'error', error: 'No readable text found in this file.' })
        return
      }
      await runGeneration(sourceId, text)
    } catch (err) {
      await updateSource(sourceId, { status: 'error', error: err.message || 'Could not read this file.' })
    }
  }

  const onAddText = async (title, text) => {
    const sourceId = await createSource({ title, type: 'text', text })
    await runGeneration(sourceId, text)
  }

  const onDeleteSource = (id) => deleteSource(id)

  const onJoinWorkspace = (code) => {
    setWorkspaceCode(code)
    setWorkspaceCodeState(code)
  }

  if (!ready) {
    return (
      <div style={{ height: '100dvh', background: '#0B0B0C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#7A7A80', fontSize: 14 }}>Loading…</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', width: '100%', background: '#0B0B0C', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar view={view} setView={setView} favCount={favorites.length} onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, position: 'relative', padding: '4px 12px 12px', minHeight: 0 }}>
        {!post ? (
          <EmptyState view={view} onOpenSettings={() => setShowSettings(true)} onGoFeed={() => setView('feed')} />
        ) : (
          <SwipeStage
            onSwipeLeft={() => goSlide(1)}
            onSwipeRight={() => goSlide(-1)}
            onSwipeDown={() => goPost(1)}
            onSwipeUp={() => goPost(-1)}
          >
            <PostCard
              post={post}
              slide={slide}
              slideIdx={slideIdx}
              accent={accentOf(ALL_CATEGORIES, post.category)}
              label={labelOf(ALL_CATEGORIES, post.category)}
              isFav={isFav}
              revealed={revealed}
              setRevealed={setRevealed}
              quizPick={quizPick}
              setQuizPick={setQuizPick}
              onTapLeft={() => goSlide(-1)}
              onTapRight={() => goSlide(1)}
              onToggleFav={toggleFavorite}
              onRate={rate}
              isLastSlide={isLastSlide}
            />
          </SwipeStage>
        )}
      </div>

      {post && (
        <div style={{ textAlign: 'center', paddingBottom: 10 }}>
          <button onClick={() => goPost(1)} style={{ background: 'none', border: 'none', color: '#5C5C61', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
            swipe down for a new learning <ChevronDown size={14} />
          </button>
        </div>
      )}

      {showSettings && (
        <SettingsSheet
          categories={ALL_CATEGORIES}
          selectedCats={selectedCats}
          onToggleCat={toggleCat}
          onClose={() => setShowSettings(false)}
          sources={sources}
          onAddFile={onAddFile}
          onAddText={onAddText}
          onDeleteSource={onDeleteSource}
          cloudEnabled={cloudEnabled}
          workspaceCode={workspaceCode}
          onJoinWorkspace={onJoinWorkspace}
        />
      )}
    </div>
  )
}
