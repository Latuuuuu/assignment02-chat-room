import { Route, Routes } from "react-router-dom";
import Intro from "./pages/Intro.jsx";
import Feature from "./pages/Feature.jsx";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Intro />} />
            <Route path="/feature" element={<Feature />} />
            <Route path="*" element={<Intro />} />
        </Routes>
    );
}

export default App;
