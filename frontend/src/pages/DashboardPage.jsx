import {useState, useEffect} from "react"
function DashboardPage() {
  const [currentUser, setCurrentUser] = useState(null)
  useEffect(() => {
    async function fetchUser() {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:8000/me", {
      headers : {"Authorization": `Bearer ${token}`},
      })
      const data = await response.json()
      setCurrentUser(data)
    } 
    fetchUser() 
  }, [])
  const [friends, setFriends] = useState([])
  useEffect(() => {
    async function displayFriends(){
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:8000/friends", {
        headers: {"Authorization": `Bearer ${token}` },
      })
      const data = await response.json()
      setFriends(data)
    }
    displayFriends()
  }, [])
  const [friendsList, setFriendsList] = useState([])
  async function displayFriendsList(){
    const token= localStorage.getItem("token")
    const response = await fetch("http://localhost:8000/friend_requests/pending", {
      headers: {"Authorization" : `Bearer ${token}` },
    })
    const data = await response.json()
    setFriendsList(data)
  }
  useEffect(() => {
    displayFriendsList()
  },[])
  async function handleAccept(id){
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/friend_requests/${id}/accept`, {
      method : "POST",
      headers: {"Authorization" : `Bearer ${token}` }
    })
    displayFriendsList()
  }
  async function handleDecline(id){
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/friend_requests/${id}/decline`, {
      method : "POST",
      headers: {"Authorization" : `Bearer ${token}`}
    })
    displayFriendsList()
  }
  const [requestEmail, setRequestEmail] = useState("")
  const [message ,setMessage] = useState("")
  async function handleSentInformation(e){
    e.preventDefault()
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/friend_requests`, {
      method : "POST",
      headers : {
        "Content-Type": "application/json", 
        "Authorization" : `Bearer ${token}`
    },
    body : JSON.stringify({recipient_email: requestEmail})
  })
    const data = await response.json()
    if (response.ok) {
    setRequestEmail("")
    setMessage("Friend request sent")
    }
    else{ 
    setMessage(data.detail)
    }
  }
  const [availabilityStart,setAvailabilityStart] =useState("")
  const [availabilityEnd, setAvailabilityEnd] = useState("")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  async function handlePostAvailabilty(e){
    e.preventDefault()
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/availability`, {
      method: "POST",
      headers : {
        "Content-Type" : "application/json",
        "Authorization" : `Bearer ${token}`
      },
      body : JSON.stringify({ start_time: availabilityStart, end_time : availabilityEnd})
    })
    const data = await response.json() 
    if (response.ok) {
      setAvailabilityStart("")
      setAvailabilityEnd("")
      setAvailabilityMessage("Availability Set")
    } else {
      setAvailabilityMessage(data.detail)
    }
  }

  return (
    <div>
      <h2>Dashboard</h2>
      {currentUser && <p>Logged in as {currentUser.email}</p>}

      <div className="dashboard-section">
        <h3>Friends</h3>
        {friends.map(friend => <p key ={friend.id}> {friend.email} </p>)}
      </div>

      <div className="dashboard-section">
        <h3>Friend Requests</h3>
        {friendsList.map(friend_request => ( <p key = {friend_request.id}>
          {friend_request.requester_email}
          <button onClick={() => handleAccept(friend_request.id)}>Accept</button>
          <button onClick={() => handleDecline(friend_request.id)}>Decline</button>
        </p>
      ))}
      </div>
      <div className ="dashboard-section">
      <h3>Send Friend Requests</h3>
      <form onSubmit={handleSentInformation}>
        <input type= "email" value= {requestEmail} onChange={(e) => setRequestEmail(e.target.value)}  
        />
        <button type="submit">Send</button>
      </form>
      {message && <p>{message}</p>}
      </div>
      <div className="dashboard-section">
        <h3>Availability</h3>
        <form onSubmit={handlePostAvailabilty}>
          <input type="datetime-local" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} />
          <input type="datetime-local" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} />
          <button type="submit">Post</button>
        </form>
        {availabilityMessage && <p>{availabilityMessage}</p>}
      </div>

    </div>
  )
}
export default DashboardPage
