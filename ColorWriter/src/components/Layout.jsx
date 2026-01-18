import React from 'react';

const Layout = ({ children }) => {
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {children}
        </div>
    );
};

export default Layout;
