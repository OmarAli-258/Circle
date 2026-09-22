import { useState } from "react"
import { Link } from "react-router-dom"

function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    const response = await fetch("http://localhost:8000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    if (response.ok) {
      setMessage(`Account created for ${data.email}`)
    } else {
      setMessage(data.detail)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Circle</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button type="submit">Sign up</button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <p><Link to="/login">Already have an account? Log in</Link></p>
      </div>
    </div>
  )
}

export default SignupPage
