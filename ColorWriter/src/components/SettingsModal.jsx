import React, { useState } from 'react';
import { X } from 'lucide-react';

const SettingsModal = ({ apiKey, onSave, onClose }) => {
    const [key, setKey] = useState(apiKey);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                width: '400px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Settings</h2>
                    <button onClick={onClose} style={{ border: 'none', padding: 0 }}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        OpenAI API Key
                    </label>
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="sk-..."
                        style={{ width: '100%' }}
                    />
                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-tertiary)' }}>
                        Stored once and shared across all Saas apps.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none' }}>Cancel</button>
                    <button
                        onClick={() => onSave(key)}
                        style={{ backgroundColor: '#111827', color: 'white', border: 'none' }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
