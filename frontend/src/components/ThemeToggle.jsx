import { useEffect, useState } from "react"
import { getPreferredTheme } from "../theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getPreferredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    localStorage.setItem("theme", next)
    setTheme(next)
  }

  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  )
}
