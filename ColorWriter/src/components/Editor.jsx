import React, { useRef, useEffect, useState } from 'react';
import { Wand2, Loader2, Scale, MessageCircle, Bold, Heading1, Heading2, Heading3, Type } from 'lucide-react';
import { analyzeCopy } from '../services/openai';

const Editor = ({ content, setContent, onSelectionChange, showColors = true, selectedBlockType = null }) => {
    const editorRef = useRef(null);

    // Toolbar State
    const [toolbar, setToolbar] = useState({ show: false, x: 0, y: 0 });

    // Sync content prop to editorRef
    useEffect(() => {
        if (editorRef.current && content !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = content;
        }
    }, [content]);

    // Apply block type filtering - mark selected blocks and fade others
    useEffect(() => {
        if (!editorRef.current) return;

        const editor = editorRef.current;

        if (selectedBlockType) {
            // Mark all blocks with data-selected attribute
            const allBlocks = editor.querySelectorAll('[class*="block-"]');
            allBlocks.forEach(block => {
                const blockClass = Array.from(block.classList).find(cls => cls.startsWith('block-'));
                if (blockClass) {
                    const blockType = blockClass.replace('block-', '');
                    if (blockType === selectedBlockType) {
                        block.setAttribute('data-selected', 'true');
                    } else {
                        block.removeAttribute('data-selected');
                    }
                }
            });
        } else {
            // Remove all data-selected attributes
            const allBlocks = editor.querySelectorAll('[data-selected]');
            allBlocks.forEach(block => block.removeAttribute('data-selected'));
        }
    }, [selectedBlockType, content]);

    const handleInput = (e) => {
        // We handle content updates primarily through generation, but manual edits exist.
        // If we want to persist manual edits, we should debounce setContent here or on blur.
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML);
        }
    };

    const handleKeyDown = (e) => {
        // Handle Shift+Enter for line breaks within same paragraph
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                
                // Create and insert a <br> tag
                const br = document.createElement('br');
                range.deleteContents();
                range.insertNode(br);
                
                // Move cursor after the <br>
                range.setStartAfter(br);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Update content
            if (editorRef.current) {
                setContent(editorRef.current.innerHTML);
            }
            return;
        }
        
        // Handle Enter key for new paragraphs (default behavior with span wrapper check)
        if (e.key === 'Enter' && !e.shiftKey) {
            // Let the default Enter behavior happen, then ensure proper structure
            // We'll handle this in handleInput after the DOM updates
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();

        // Get plain text from clipboard
        const text = e.clipboardData.getData('text/plain');

        if (!text) return;

        // Split by line breaks and create paragraphs
        const lines = text.split(/\r?\n/);

        // Create HTML with proper paragraph structure
        const html = lines
            .filter(line => line.trim()) // Remove empty lines
            .map(line => `<p><span>${line.trim()}</span></p>`)
            .join('');

        // Insert at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const fragment = range.createContextualFragment(html);
            range.insertNode(fragment);

            // Move cursor to end of inserted content
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Update content
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
            let blockType = null;
            let mechanicType = null;

            // Traverse up to find block and mechanics
            while (node && node !== editorRef.current) {
                if (node.nodeType === 1) { // Element node
                    const className = node.className || '';

                    // Check for Block Types (only if not found yet)
                    if (!blockType) {
                        if (className.includes('block-hook')) blockType = 'hook';
                        else if (className.includes('block-story')) blockType = 'story';
                        else if (className.includes('block-emotion')) blockType = 'emotion';
                        else if (className.includes('block-logic')) blockType = 'logic';
                        else if (className.includes('block-proof')) blockType = 'proof';
                        else if (className.includes('block-cta')) blockType = 'cta';
                        else if (className.includes('block-ad')) blockType = 'ad';
                        else if (className.includes('block-misc')) blockType = 'misc';
                    }

                    // Check for Mechanics (Highlights) - these can override
                    if (!mechanicType) {
                        if (className.includes('highlight-interrupt')) mechanicType = 'interrupt';
                        else if (className.includes('highlight-loop-open')) mechanicType = 'loop-open';
                        else if (className.includes('highlight-loop-close')) mechanicType = 'loop-close';
                    }

                    // If directly on a mechanic icon
                    if (node.tagName === 'I' && node.hasAttribute('type')) {
                        const iconType = node.getAttribute('type');
                        if (['interrupt', 'loop-open', 'loop-close'].includes(iconType)) {
                            mechanicType = iconType;
                        }
                    }
                }
                node = node.parentNode;
            }

            // Prioritize: mechanic > block
            const foundType = mechanicType || blockType;

            if (foundType) {
                onSelectionChange(foundType);
            } else {
                // Clear selection if nothing found
                onSelectionChange(null);
            }
        } else {
            // Clear selection if collapsed
            onSelectionChange(null);
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
            backgroundColor: 'var(--bg-tertiary)',
            overflow: 'hidden'
        }}>
            {/* Floating Toolbar */}
            {toolbar.show && (
                <div style={{
                    position: 'fixed',
                    top: `${toolbar.y}px`,
                    left: `${toolbar.x}px`,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--button-radius)',
                    border: '1px solid var(--border-default)',
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
                    <div style={{ width: 1, background: 'var(--border-default)', margin: '0 2px' }}></div>
                    <button onClick={() => applyFormat('bold')} className="toolbar-btn" title="Bold"><Bold size={18} /></button>

                    <style>{`
                        .toolbar-btn {
                            background: transparent;
                            border: none;
                            color: var(--text-tertiary);
                            border-radius: 4px;
                            padding: 4px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .toolbar-btn:hover {
                            background: var(--bg-hover);
                            color: var(--text-primary);
                        }
                        @keyframes fadeIn {from {opacity: 0; transform: translateY(5px); } to {opacity: 1; transform: translateY(0); } }
                    `}</style>
                </div>
            )
            }

            <div 
                className={selectedBlockType ? 'editor-filter-active' : ''}
                style={{
                flexGrow: 1,
                padding: '2rem',
                paddingBottom: '50vh',
                overflowY: 'auto',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div
                    ref={editorRef}
                    className={`editor-content ${showColors ? '' : 'hide-colors'}`}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
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
