import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import SignupPage from "./pages/SignupPage"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import { getPreferredTheme } from "./theme"
import { wakeBackend } from "./api"

function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = getPreferredTheme()
    wakeBackend()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
