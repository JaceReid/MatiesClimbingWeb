import React from 'react';

function SignupPage() {
  const formUrl = 'https://forms.gle/neKyxP3QSHGTzk5TA';

  const pageStyles = {
    backgroundImage: `url(${require("../docs/wall-shed.jpg")})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'fixed', // This prevents scrolling
    top: 0,
    left: 0,
    overflow: 'hidden', // Ensures no scrollbars appear
    margin: 0,
    padding: 0,
  };

  const boxStyles = {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '2rem',
    borderRadius: '12px',
    textAlign: 'center',
    maxWidth: '90%',
  };

  const linkStyles = {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '1.2rem',
  };

  return (
    <div style={pageStyles}>
      <div style={boxStyles}>
        <h1>Sign Up</h1>
        <p>Please click the link below to sign up:</p>
        <a href={formUrl} style={linkStyles} target="_blank" rel="noopener noreferrer">
          Sign Up Here
        </a>
      </div>
    </div>
  );
}

export default SignupPage;