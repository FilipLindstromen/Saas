import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const TabBar = ({ tabs, activeTabId, onTabSelect, onTabAdd, onTabDelete, onTabRename }) => {
    const [editingTabId, setEditingTabId] = useState(null);
    const [editName, setEditName] = useState('');

    const handleDoubleClick = (tab) => {
        setEditingTabId(tab.id);
        setEditName(tab.name);
    };

    const handleRename = (tabId) => {
        if (editName.trim()) {
            onTabRename(tabId, editName.trim());
        }
        setEditingTabId(null);
        setEditName('');
    };

    const handleKeyDown = (e, tabId) => {
        if (e.key === 'Enter') {
            handleRename(tabId);
        } else if (e.key === 'Escape') {
            setEditingTabId(null);
            setEditName('');
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0 0.5rem',
            gap: '0.25rem',
            overflowX: 'auto',
            minHeight: '36px'
        }}>
            {tabs.map((tab) => (
                <div
                    key={tab.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: activeTabId === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                        backgroundColor: activeTabId === tab.id ? 'var(--bg-secondary)' : 'transparent',
                        color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: activeTabId === tab.id ? 600 : 400,
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        minWidth: '80px',
                        maxWidth: '200px'
                    }}
                    onClick={() => onTabSelect(tab.id)}
                    onDoubleClick={() => handleDoubleClick(tab)}
                    title="Double-click to rename"
                >
                    {editingTabId === tab.id ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleRename(tab.id)}
                            onKeyDown={(e) => handleKeyDown(e, tab.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                border: '1px solid var(--accent)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.875rem',
                                width: '100%',
                                outline: 'none',
                                borderRadius: 'var(--button-radius, 12px)'
                            }}
                            autoFocus
                        />
                    ) : (
                        <>
                            <span style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1
                            }}>
                                {tab.name}
                            </span>
                            {tabs.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabDelete(tab.id);
                                    }}
                                    style={{
                                        marginLeft: '0.5rem',
                                        padding: '0.125rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--text-tertiary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: '4px'
                                    }}
                                    title="Delete tab"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-tertiary)';
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            ))}
            <button
                onClick={onTabAdd}
                style={{
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    borderRadius: '4px',
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap'
                }}
                title="Add new tab"
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
            >
                <Plus size={16} />
                <span>New Tab</span>
            </button>
        </div>
    );
};

export default TabBar;
