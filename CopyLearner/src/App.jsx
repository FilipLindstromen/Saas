import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BUILT_IN_CATEGORIES, CUSTOM_CATEGORY, DEFAULT_POSTS, accentOf, labelOf } from './data/defaultPosts.js'
import { buildFeed, nextDue, pickFeedStartIndex } from './utils/spacedRepetition.js'
import { extractTextFromFile, guessFileType } from './utils/fileParsing.js'
import { generateLessonBatch, BATCH_SIZE, REFILL_THRESHOLD, MAX_TOTAL_LESSONS } from './utils/generateLessons.js'
import { transformCopy } from './utils/transformCopy.js'
import {
  isCloudEnabled, getWorkspaceCode, setWorkspaceCode,
  subscribeState, saveState, subscribeSources, createSource, updateSource, deleteSource,
  subscribePosts, addPosts, subscribeTransforms, addTransform, deleteTransform,
  getSessionSeenPostIds, markSessionSeenPost, clearSessionSeenForPosts,
  getSessionLastStartPostId, setSessionLastStartPostId,
} from './utils/storage.js'
import TopBar from './components/TopBar.jsx'
import PostCard from './components/PostCard.jsx'
import SwipeStage from './components/SwipeStage.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import EmptyState from './components/EmptyState.jsx'
import TransformView from './components/TransformView.jsx'

const ALL_CATEGORIES = [...BUILT_IN_CATEGORIES, CUSTOM_CATEGORY]
const cloudEnabled = isCloudEnabled()
// Source text is now kept around (not just used once at upload) so later
// batches can keep drawing on it — cap it well under Firestore's 1MB
// document limit for large uploads.
const MAX_STORED_TEXT_CHARS = 60000

export default function App() {
  const [workspaceCode, setWorkspaceCodeState] = useState(() => getWorkspaceCode())
  const [ready, setReady] = useState(false)
  const [selectedCats, setSelectedCats] = useState(BUILT_IN_CATEGORIES.map((c) => c.id))
  const [favorites, setFavorites] = useState([])
  const [progress, setProgress] = useState({})
  const [sources, setSources] = useState([])
  const [customPosts, setCustomPosts] = useState([])
  const [transforms, setTransforms] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState('feed')
  const [postIdx, setPostIdx] = useState(0)
  const [slideIdx, setSlideIdx] = useState(0)
  const [revealed, setRevealed] = useState({})
  const [quizPick, setQuizPick] = useState(null)
  const [isRestocking, setIsRestocking] = useState(false)

  // Lessons — for every topic, not just "My Content" — are generated
  // progressively in the background as the reader swipes, so no topic ever
  // runs dry or repeats. generatingCategoryRef holds the topic currently
  // being written (or null when idle); only one topic generates at a time.
  const generatingCategoryRef = useRef(null)
  const failureCooldownRef = useRef(0)

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
    const unsubTransforms = subscribeTransforms((list) => setTransforms(list))
    return () => { unsubState(); unsubSources(); unsubPosts(); unsubTransforms() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceCode])

  useEffect(() => {
    setSources((prev) => prev.map((s) => ({ ...s, postCount: customPosts.filter((p) => p.sourceId === s.id).length })))
  }, [customPosts])

  const allPosts = useMemo(() => [...DEFAULT_POSTS, ...customPosts], [customPosts])

  const feed = useMemo(() => {
    if (view === 'transform') return []
    if (view === 'favorites') return allPosts.filter((p) => favorites.includes(p.id))
    return buildFeed(allPosts, selectedCats.length ? selectedCats : BUILT_IN_CATEGORIES.map((c) => c.id), progress)
  }, [view, allPosts, selectedCats, progress, favorites])

  const post = feed[postIdx] || null
  const slide = post ? post.slides[slideIdx] : null
  const isFav = post ? favorites.includes(post.id) : false

  // Generate the next batch of lessons for one topic. Grounded in the
  // reader's uploaded content when any is ready (so "Headlines", "CTAs",
  // etc. all pull examples from their own material, not just "My
  // Content"); falls back to the mentor's own expertise on that topic
  // when there's nothing uploaded, so every topic can still flow forever.
  const generateNextBatch = useCallback(async (categoryId) => {
    generatingCategoryRef.current = categoryId
    setIsRestocking(true)
    try {
      const readySources = sources.filter((s) => s.status === 'ready' && s.text)
      const referenceText = readySources.slice(0, 3).map((s) => s.text).join('\n\n---\n\n')
      const coveredTitles = allPosts.filter((p) => p.category === categoryId).map((p) => p.title)
      const posts = await generateLessonBatch({ categoryId, referenceText, coveredTitles, batchSize: BATCH_SIZE })
      if (posts.length) {
        await addPosts(categoryId, readySources.length ? readySources[0].id : null, posts)
        failureCooldownRef.current = 0
      } else {
        // Empty result (e.g. the model's response didn't parse as valid
        // JSON) is still a failure — without a cooldown here, the topic
        // stays "needy" forever and this refires on every render, hammering
        // the API in a tight loop instead of ever recovering.
        console.warn(`CopyLearner: generation for "${categoryId}" returned no usable lessons; will retry shortly.`)
        failureCooldownRef.current = Date.now()
      }
    } catch (err) {
      console.warn(`CopyLearner: generation for "${categoryId}" failed:`, err)
      failureCooldownRef.current = Date.now()
    } finally {
      generatingCategoryRef.current = null
      setIsRestocking(false)
    }
  }, [sources, allPosts])

  // Keep every selected topic topped up: whenever the reader has swiped
  // through most of what's available for a topic this session, quietly
  // generate its next batch in the background — an endless, non-repeating
  // stream per topic instead of a small fixed pool that loops.
  useEffect(() => {
    if (view !== 'feed') return
    if (generatingCategoryRef.current) return
    if (customPosts.length >= MAX_TOTAL_LESSONS) return
    if (Date.now() - failureCooldownRef.current < 30000) return
    const hasReadySource = sources.some((s) => s.status === 'ready' && s.text)
    const sessionSeen = getSessionSeenPostIds(workspaceCode)
    const needyCategory = selectedCats.find((catId) => {
      if (catId === 'mine' && !hasReadySource) return false // nothing to teach from yet
      const postsInCat = allPosts.filter((p) => p.category === catId)
      const seenCount = postsInCat.filter((p) => sessionSeen.has(p.id)).length
      return postsInCat.length - seenCount <= REFILL_THRESHOLD
    })
    if (needyCategory) generateNextBatch(needyCategory)
  }, [view, selectedCats, post, customPosts, allPosts, sources, workspaceCode, generateNextBatch])

  const feedRef = useRef(feed)
  const progressRef = useRef(progress)
  useEffect(() => { feedRef.current = feed }, [feed])
  useEffect(() => { progressRef.current = progress }, [progress])

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

  const repositionToFeedStart = useCallback(() => {
    const currentFeed = feedRef.current
    const currentProgress = progressRef.current
    if (!currentFeed.length || view === 'transform') return
    const seen = getSessionSeenPostIds(workspaceCode)
    const allShownThisSession = currentFeed.every((p) => seen.has(p.id))
    if (allShownThisSession) clearSessionSeenForPosts(workspaceCode, currentFeed.map((p) => p.id))
    const sessionSeen = getSessionSeenPostIds(workspaceCode)
    const idx = pickFeedStartIndex(
      currentFeed,
      currentProgress,
      sessionSeen,
      getSessionLastStartPostId(workspaceCode),
    )
    const startPost = currentFeed[idx]
    if (startPost) setSessionLastStartPostId(workspaceCode, startPost.id)
    setPostIdx(idx)
    setSlideIdx(0)
    setRevealed({})
    setQuizPick(null)
  }, [view, workspaceCode])

  useEffect(() => {
    if (!ready) return
    repositionToFeedStart()
  }, [ready, view, workspaceCode, repositionToFeedStart])

  useEffect(() => {
    if (post?.id) markSessionSeenPost(workspaceCode, post.id)
  }, [post?.id, workspaceCode])

  useEffect(() => {
    if (postIdx >= feed.length && feed.length > 0) repositionToFeedStart()
  }, [feed.length, postIdx, repositionToFeedStart])

  // Reaching the end of a lesson (by swiping past its last slide, or
  // swiping down to skip to a new one) counts as "learned it" — there's no
  // rating button to tap, so it's recorded automatically.
  const completeAndAdvance = useCallback(() => {
    if (post) {
      const prev = progress[post.id] || { box: 0 }
      const box = prev.box + 1
      const next = { ...progress, [post.id]: { box, due: nextDue(box), lastSeen: Date.now() } }
      setProgress(next)
      saveState({ progress: next })
    }
    goPost(1)
  }, [post, progress, goPost])

  const goSlide = (delta) => {
    if (!post) return
    const n = slideIdx + delta
    if (n < 0) { goPost(-1); return }
    if (n >= post.slides.length) { completeAndAdvance(); return }
    setSlideIdx(n)
    setQuizPick(null)
  }

  const toggleFavorite = () => {
    if (!post) return
    const next = isFav ? favorites.filter((id) => id !== post.id) : [...favorites, post.id]
    setFavorites(next)
    saveState({ favorites: next })
  }

  const toggleCat = (id) => {
    const next = selectedCats.includes(id) ? selectedCats.filter((c) => c !== id) : [...selectedCats, id]
    const safe = next.length ? next : selectedCats
    setSelectedCats(safe)
    saveState({ selectedCats: safe })
  }

  // Uploading only extracts and stores the text — no AI call here. It
  // becomes reference material for generateNextBatch above, across
  // whichever topics the reader is swiping through.
  const onAddFile = async (file) => {
    const type = guessFileType(file)
    const sourceId = await createSource({ title: file.name, type, text: '' })
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        await updateSource(sourceId, { status: 'error', error: 'No readable text found in this file.' })
        return
      }
      await updateSource(sourceId, { status: 'ready', text: text.slice(0, MAX_STORED_TEXT_CHARS) })
    } catch (err) {
      await updateSource(sourceId, { status: 'error', error: err.message || 'Could not read this file.' })
    }
  }

  const onAddText = async (title, text) => {
    const sourceId = await createSource({ title, type: 'text', text: text.slice(0, MAX_STORED_TEXT_CHARS) })
    await updateSource(sourceId, { status: 'ready' })
  }

  const onDeleteSource = (id) => deleteSource(id)

  const onSubmitTransform = async ({ copy, instructions }) => {
    const standingInstructions = transforms.map((t) => t.instructions).filter(Boolean)
    const output = await transformCopy({ copy, instructions, standingInstructions })
    await addTransform({ copy, instructions, output })
  }

  const onDeleteTransform = (id) => deleteTransform(id)

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
      <TopBar
        view={view}
        setView={setView}
        favCount={favorites.length}
        onOpenSettings={() => setShowSettings(true)}
        categories={ALL_CATEGORIES}
        selectedCats={selectedCats}
        onToggleCat={toggleCat}
      />

      <div style={{ flex: 1, position: 'relative', padding: '4px 12px 12px', minHeight: 0 }}>
        {view === 'transform' ? (
          <TransformView transforms={transforms} onSubmit={onSubmitTransform} onDelete={onDeleteTransform} />
        ) : !post ? (
          <EmptyState view={view} onOpenSettings={() => setShowSettings(true)} onGoFeed={() => setView('feed')} />
        ) : (
          <SwipeStage
            onSwipeLeft={() => goSlide(1)}
            onSwipeRight={() => goSlide(-1)}
            onSwipeDown={completeAndAdvance}
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
              onToggleFav={toggleFavorite}
            />
          </SwipeStage>
        )}
      </div>

      {view !== 'transform' && post && (
        <div style={{ textAlign: 'center', paddingBottom: 10 }}>
          <button onClick={completeAndAdvance} style={{ background: 'none', border: 'none', color: '#5C5C61', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
            swipe down for a new learning <ChevronDown size={14} />
          </button>
          {isRestocking && <div style={{ color: '#4A4A50', fontSize: 10.5, marginTop: 2 }}>writing more lessons…</div>}
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
