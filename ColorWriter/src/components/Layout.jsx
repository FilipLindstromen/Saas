import React from 'react';

const Layout = ({ children }) => {
    return (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {children}
        </div>
    );
};

export default Layout;
