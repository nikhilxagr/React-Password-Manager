const Navbar = () => {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand-wrap">
          <div className="brand-title-row">
            <div className="brand-logo" aria-hidden="true">
              VG
            </div>
            <div>
              <p className="brand-kicker">Secure Password Vault</p>
              <h1>VoultGaurd Password Manager</h1>
            </div>
          </div>
          <p className="topbar-note">
            A simple and secure home for your daily passwords.
          </p>
        </div>

        <a
          className="topbar-link"
          href="https://github.com/nikhilxagr/React-Password-Manager"
          target="_blank"
          rel="noreferrer"
        >
          <img src="/icons/github.svg" alt="GitHub" />
          Repository
        </a>
      </div>
    </header>
  );
};

export default Navbar;
