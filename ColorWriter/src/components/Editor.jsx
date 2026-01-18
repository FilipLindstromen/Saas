import React, { useRef, useEffect, useState } from 'react';
import { Wand2, Loader2, Scale, MessageCircle, Bold, Heading1, Heading2, Heading3, Type } from 'lucide-react';
import { analyzeCopy } from '../services/openai';

const Editor = ({ content, setContent, onSelectionChange }) => {
    const editorRef = useRef(null);

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
            let foundType = null;

            // Traverse up to find a block, highlight, or content-row
            while (node && node !== editorRef.current && !foundType) {
                if (node.nodeType === 1) { // Element node
                    const className = node.className || '';

                    // Check for Block Types
                    if (className.includes('block-hook')) { foundType = 'hook'; }
                    else if (className.includes('block-story')) { foundType = 'story'; }
                    else if (className.includes('block-emotion')) { foundType = 'emotion'; }
                    else if (className.includes('block-logic')) { foundType = 'logic'; }
                    else if (className.includes('block-proof')) { foundType = 'proof'; }
                    else if (className.includes('block-cta')) { foundType = 'cta'; }
                    else if (className.includes('block-ad')) { foundType = 'ad'; }
                    else if (className.includes('block-misc')) { foundType = 'misc'; }

                    // Check for Mechanics (Highlights) - these take priority
                    else if (className.includes('highlight-interrupt')) { foundType = 'interrupt'; }
                    else if (className.includes('highlight-loop-open')) { foundType = 'loop-open'; }
                    else if (className.includes('highlight-loop-close')) { foundType = 'loop-close'; }

                    // If we found a content-row, check for persona icons in its gutter
                    if (className.includes('content-row')) {
                        const gutter = node.querySelector('.gutter');
                        if (gutter) {
                            const personaIcons = gutter.querySelectorAll('i[type]');
                            for (let icon of personaIcons) {
                                const iconType = icon.getAttribute('type');
                                if (['homer', 'bart', 'marge', 'lisa'].includes(iconType)) {
                                    foundType = iconType;
                                    break;
                                }
                            }
                        }
                    }

                    // If we're directly on a persona icon
                    if (node.tagName === 'I' && node.hasAttribute('type')) {
                        const iconType = node.getAttribute('type');
                        if (['homer', 'bart', 'marge', 'lisa', 'interrupt', 'loop-open', 'loop-close'].includes(iconType)) {
                            foundType = iconType;
                        }
                    }
                }
                node = node.parentNode;
            }

            if (foundType) {
                onSelectionChange(foundType);
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
            backgroundColor: 'var(--bg-tertiary)'
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

        </main >
    );
};

export default Editor;
