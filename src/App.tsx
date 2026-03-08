import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TimelinePage from "./pages/TimelinePage";
import EventPage from "./pages/EventPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/topic/ww2" replace />} />
        <Route path="/topic/:topicId" element={<TimelinePage />} />
        <Route path="/topic/:topicId/event/:eventId" element={<EventPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
