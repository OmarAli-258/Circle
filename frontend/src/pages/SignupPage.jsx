import { useState } from "react"
import { Link } from "react-router-dom"

function SignupPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [messageIsError, setMessageIsError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const response = await fetch("http://localhost:8000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    })
    const data = await response.json()
    if (response.ok) {
      setMessage(`Account created for ${data.email}`)
      setMessageIsError(false)
    } else {
      setMessage(data.detail)
      setMessageIsError(true)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Circle</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="signup-username">Username</label>
          <input id="signup-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing up..." : "Sign up"}</button>
        </form>
        {message && <p className={messageIsError ? "form-message" : "form-message form-message--success"}>{message}</p>}
        <p><Link to="/login">Already have an account? Log in</Link></p>
      </div>
    </div>
  )
}

export default SignupPage
