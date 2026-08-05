import { useState } from "react"

function App() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

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
  
  async function handleLogin(e) {
    e.preventDefault()
    const response = await fetch("http://localhost:8000/login", { method : "POST", headers:{"Content-type": "application/json"},
    body : JSON.stringify({email : loginEmail, password : loginPassword})})
  const data = await response.json()
  if (response.ok) {
    localStorage.setItem("token", data.access_token)
    setMessage("valid token")
  } else{
    setMessage(data.detail)

    }
  }
  return (
    <div>
      <h2>Circle</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit">Sign up</button>
      </form>
      {message && <p>{message}</p>}

      <form onSubmit={handleLogin}>
        <input type= "email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="email"/>
        <input type= "password" value ={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="password"/>
        <button type= "submit ">Log in</button>
      </form>
    </div>


  )
}

export default App
