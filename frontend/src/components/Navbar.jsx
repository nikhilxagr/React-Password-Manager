const Navbar = () => {
    return (
        <header className="topbar">
            <div className="topbar-inner">
                <div>
                    <p className="brand-kicker">PassManager Studio</p>
                    <h1>
                        <span>Credential</span> Vault
                    </h1>
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
