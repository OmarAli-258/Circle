import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

function LoginPage() {
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const response = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    })
    const data = await response.json()
    if (response.ok) {
      localStorage.setItem("token", data.access_token)
      navigate("/")
    } else {
      setMessage(data.detail)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Circle</h2>
        <form onSubmit={handleLogin}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" />
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Log in"}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <p><Link to="/signup">Need an account? Sign up</Link></p>
      </div>
    </div>
  )
}

export default LoginPage
