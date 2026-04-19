import "./App.css";
import Navbar from "./components/Navbar";
import Manager from "./components/Manager";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Manager />
      </main>
      <Footer />
    </div>
  );
}

export default App;
