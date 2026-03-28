import { SolanaProvider } from "./contexts/SolanaProvider";
import { Game } from "./components/Game";
import "./App.css";

function App() {
  return (
    <SolanaProvider>
      <Game />
    </SolanaProvider>
  );
}

export default App;
