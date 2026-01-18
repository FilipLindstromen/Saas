import React, { useRef, useEffect, useState } from 'react';
import { Wand2, Loader2, Scale, MessageCircle, Bold, Heading1, Heading2, Heading3, Type } from 'lucide-react';
import { analyzeCopy } from '../services/openai';

const Editor = ({ content, setContent, apiKey, onGenerated, docType, style, targetAudience, onSelectionChange, onFeedback, onBalance }) => {
    const editorRef = useRef(null);
    const [loading, setLoading] = useState(false);

    // Toolbar State
    const [toolbar, setToolbar] = useState({ show: false, x: 0, y: 0 });

    // Sync content prop to editorRef
    useEffect(() => {
        if (editorRef.current && content !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = content;
        }
    }, [content]);

    const handleInput = (e) => {
        // We handle content updates primarily through generation, but manual edits exist.
        // If we want to persist manual edits, we should debounce setContent here or on blur.
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML);
        }
    };

    // Detect active block for Legend Highlighting AND Show Toolbar
    const handleSelection = () => {
        const selection = window.getSelection();

        // 1. Legend Highlighting Detection
        if (selection.rangeCount > 0) {
            let node = selection.anchorNode;
            // Traverse up to find a block or highlight class
            while (node && node !== editorRef.current) {
                if (node.nodeType === 1) { // Element node
                    const className = node.className || '';
                    if (className.includes('block-story')) { onSelectionChange('story'); break; }
                    if (className.includes('block-emotion')) { onSelectionChange('emotion'); break; }
                    if (className.includes('block-logic')) { onSelectionChange('logic'); break; }
                    if (className.includes('block-cta')) { onSelectionChange('cta'); break; }
                    if (className.includes('block-ad')) { onSelectionChange('ad'); break; }
                    if (className.includes('block-misc')) { onSelectionChange('misc'); break; }
                    if (className.includes('highlight-interrupt')) { onSelectionChange('interrupt'); break; }
                    if (className.includes('highlight-loop-open')) { onSelectionChange('loop-open'); break; }
                    if (className.includes('highlight-loop-close')) { onSelectionChange('loop-close'); break; }
                }
                node = node.parentNode;
            }
        }

        // 2. Toolbar Logic
        if (!selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Only show if selection is inside editor
            if (editorRef.current && editorRef.current.contains(selection.anchorNode)) {
                setToolbar({
                    show: true,
                    x: rect.left + (rect.width / 2) - 100, // Center approx
                    y: rect.top - 50 // Above
                });
                return;
            }
        }

        // Hide if collapsed or outside
        setToolbar({ ...toolbar, show: false });
    };

    const applyFormat = (tag) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // Bold is simple
        if (tag === 'bold') {
            document.execCommand('bold');
            return;
        }

        // Structural Tags (H1, H2, H3, P)
        // We need to find the specific block-level parent (P, H1, H2, etc) and replace it.
        // AND ensure the SPAN wrapper survives.

        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode; // Get element if text node

        // Find the "Line Element" (H1, H2, H3, P) that is inside a .block-*
        // Or if strictly enforcing structure: .block-* > [TARGET] > span

        // Traverse up until we find an element that is a direct child of a .block-* OR is the .block-* itself?
        // Actually, our CSS expects .block-* > h1|p > span

        // Let's find the current block tag (h1, h2, h3, p, div)
        let currentBlock = node;
        while (currentBlock && currentBlock.parentElement && !currentBlock.parentElement.className.includes('block-')) {
            if (currentBlock === editorRef.current) break;
            currentBlock = currentBlock.parentElement;
        }

        // Safety: If we couldn't find a block parent, or we are at root, fallback to execCommand
        if (!currentBlock || currentBlock === editorRef.current) {
            document.execCommand('formatBlock', false, tag);
            return;
        }

        // If we found the element (e.g. <p>...</p>) inside .block-story
        // We replace it with <tag>...</tag>

        const newElement = document.createElement(tag);

        // Move children. 
        // We must check if children utilize the SPAN.
        // If the innerHTML is just text, we wrap it.
        // If it already has span, we keep it.

        // Simplest strategy: Clone children.
        // Check if "span" exists in innerHTML.
        const innerHTML = currentBlock.innerHTML;

        if (!innerHTML.includes('<span')) {
            // Missing span? Wrap it.
            newElement.innerHTML = `<span>${innerHTML}</span>`;
        } else {
            newElement.innerHTML = innerHTML;
        }

        currentBlock.replaceWith(newElement);

        // Restore selection? (Tricky after DOM replacement, but user usually re-selects or clicks away)
        // For smoother UX, we might try to suppress menu close, but simple is fine for now.
    };

    return (
        <main style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            backgroundColor: '#e5e7eb'
        }}>
            {/* Floating Toolbar */}
            {toolbar.show && (
                <div style={{
                    position: 'fixed',
                    top: `${toolbar.y}px`,
                    left: `${toolbar.x}px`,
                    background: '#1f2937',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '0.4rem',
                    display: 'flex',
                    gap: '0.4rem',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <button onClick={() => applyFormat('h1')} className="toolbar-btn" title="Heading 1"><Heading1 size={18} /></button>
                    <button onClick={() => applyFormat('h2')} className="toolbar-btn" title="Heading 2"><Heading2 size={18} /></button>
                    <button onClick={() => applyFormat('h3')} className="toolbar-btn" title="Heading 3"><Heading3 size={18} /></button>
                    <button onClick={() => applyFormat('p')} className="toolbar-btn" title="Body Text"><Type size={18} /></button>
                    <div style={{ width: 1, background: '#4b5563', margin: '0 2px' }}></div>
                    <button onClick={() => applyFormat('bold')} className="toolbar-btn" title="Bold"><Bold size={18} /></button>

                    <style>{`
                        .toolbar-btn {
                            background: transparent;
                        border: none;
                        color: #d1d5db;
                        border-radius: 4px;
                        padding: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        }
                        .toolbar-btn:hover {
                            background: rgba(255,255,255,0.1);
                        color: #fff;
                        }
                        @keyframes fadeIn {from {opacity: 0; transform: translateY(5px); } to {opacity: 1; transform: translateY(0); } }
                    `}</style>
                </div>
            )
            }

            <div style={{
                flexGrow: 1,
                padding: '2rem',
                paddingBottom: '50vh',
                overflowY: 'auto',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div
                    ref={editorRef}
                    className="editor-content"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onClick={handleSelection}
                    onKeyUp={handleSelection}
                    onMouseUp={handleSelection} // Added MouseUp for text selection end
                    style={{
                        width: '100%',
                        maxWidth: '850px',
                        minHeight: 'auto',
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                        padding: '2rem 3rem',
                        outline: 'none',
                        fontSize: '1.125rem',
                        lineHeight: '1.8',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        borderRadius: '2px'
                    }}
                >
                </div>
            </div>

            <div style={{
                position: 'fixed',
                top: '6rem',
                right: '2rem',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch', // Full width for buttons
                gap: '0.75rem',
                width: '180px' // consistent width
            }}>
                <button
                    onClick={async () => {
                        if (!apiKey || loading) return;
                        const text = editorRef.current.innerText;
                        if (!text.trim()) return;

                        setLoading(true);
                        try {
                            const newContent = await analyzeCopy(apiKey, text);
                            setContent(newContent);
                        } catch (e) {
                            alert("Error analyzing text.");
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={!apiKey || loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        border: '1px solid var(--border-color)',
                        opacity: !apiKey || loading ? 0.6 : 1,
                        cursor: !apiKey || loading ? 'not-allowed' : 'pointer',
                        padding: '0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                    {loading ? 'Thinking...' : 'Analyze / Color'}
                </button>

                <button
                    onClick={() => onFeedback(targetAudience, docType)}
                    disabled={!apiKey || !targetAudience}
                    style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: !apiKey || !targetAudience ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        padding: '0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        opacity: !apiKey || !targetAudience ? 0.6 : 1,
                        transition: 'all 0.2s'
                    }}
                    title={!targetAudience ? "Enter Target Audience in Sidebar first" : "Get Audience Feedback"}
                >
                    <MessageCircle size={16} />
                    Thoughts?
                </button>

                <button
                    onClick={() => onBalance(targetAudience)}
                    disabled={!apiKey || !targetAudience}
                    style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: !apiKey || !targetAudience ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        padding: '0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        opacity: !apiKey || !targetAudience ? 0.6 : 1,
                        transition: 'all 0.2s'
                    }}
                    title="Check Color Balance"
                >
                    <Scale size={16} />
                    Balance
                </button>
            </div>
        </main >
    );
};

export default Editor;
