import { SolanaProvider } from "./contexts/SolanaProvider";
import { Game } from "./components/Game";

function App() {
  return (
    <SolanaProvider>
      <Game />
    </SolanaProvider>
  );
}
export default App;
