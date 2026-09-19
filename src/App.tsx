import { StructurePanel } from "./panels/StructurePanel";
import { Viewport } from "./scene/Viewport";

export function App() {
  return (
    <div className="app">
      <main className="viewport">
        <Viewport />
      </main>
      <StructurePanel />
    </div>
  );
}
