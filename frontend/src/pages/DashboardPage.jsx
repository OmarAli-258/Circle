import {useState, useEffect} from "react"
import {useNavigate} from "react-router-dom"
function DashboardPage() {
  useEffect(() => {
    async function checkLogin(){
      const token = localStorage.getItem("token")
      if (!token){
        navigate("/login")
      }
    }
    checkLogin()
  },[] )
  const [currentUser, setCurrentUser] = useState(null)
  const navigate = useNavigate()
  function handleLogout(){
    localStorage.removeItem("token")
    navigate("/login")
  }

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

  const [matchedFriends, setMatchedFriends] =useState([])
  useEffect(()=>{
    async function displayMatched() {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:8000/availability/matches`, {
        headers : { "Authorization" : `Bearer ${token}`}
      })
      const data = await response.json()
      setMatchedFriends(data)
    } 
    displayMatched()
    }, [])
  
  const [outingInvites, setOutinginvites] = useState([])
  async function displayOutingInvites() {
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/outing_invites/pending`, {
      headers : {"Authorization" : `Bearer ${token} `}
    })
    const data = await response.json()
    setOutinginvites(data)
  }
  useEffect(()=>{
    displayOutingInvites()
  }, [])

  async function handleAcceptOuting(id) {
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/outing_invites/${id}/accept`,{
      method : "POST",
      headers : {"Authorization" : `Bearer ${token}`} 
    })
    displayOutingInvites()
  }

  async function handleDeclineOuting(id) {
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/outing_invites/${id}/decline`,{
      method : "POST",
      headers : {"Authorization" : `Bearer ${token}`} 
    })
    displayOutingInvites()
  }

  const [invitedFriends, setInvitedFriends ] = useState([])
  function toggleInvitedFriends(id) {
    if (invitedFriends.includes(id)) {
      setInvitedFriends(invitedFriends.filter(i => i !==id ))
    } else {
      setInvitedFriends([...invitedFriends,id])
    }
  } 

  const [proposedTime, setProposedTime] = useState("")
  const [outingLocation,setOutingLocation] = useState("")
  const [outingTitle, setOutingTitle] = useState("")
  const [outingMessage, setOutingMessage] = useState("")
  async function handleCreateOuting(e) {
    e.preventDefault()
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/outings`, {
      method : "POST",
      headers : {
        "Content-Type" : "application/json",
        "Authorization" : `Bearer ${token}`},
      body : JSON.stringify({title : outingTitle ,location : outingLocation , proposed_time :proposedTime, 
        invitee_ids : invitedFriends})
    })
    const data = await response.json()
    if (response.ok) {
      setOutingTitle("")
      setProposedTime("")
      setOutingLocation("")
      setInvitedFriends([])
      setOutingMessage("Outing created")
    } else{
      setOutingMessage(data.detail)
    }
  }

  return (
    <div>
      <h2>Dashboard</h2>
      {currentUser && <p>Logged in as {currentUser.email}</p>}
      <button onClick = {() => handleLogout()}>Logout</button>

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
      <div className="dashboard-section">
        <h3>Matches</h3>
        {matchedFriends.map(friend => <p key={friend.id}>{friend.email}</p>)}
      </div>
      <div className="dashboard-section">
      <h3>OutingInvites</h3>
      {outingInvites.map(invite => (
        <p key={invite.id}>
          {invite.outing_title}, {invite.outing_location}, {invite.outing_time}
          <button onClick={() => handleAcceptOuting(invite.id)}>Accept</button>
          <button onClick={() => handleDeclineOuting(invite.id)}>Decline</button>
        </p>
      ))}
      </div>
      <div className="dashboard-section">
        <h3>Create Outing</h3>
        <form onSubmit={handleCreateOuting}>
          <input type="text" value={outingTitle} onChange={(e) => setOutingTitle(e.target.value)} placeholder="Title" />
          <input type="datetime-local" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} />
          <input type="text" value={outingLocation} onChange={(e) => setOutingLocation(e.target.value)} placeholder="Location" />
          {friends.map(friend => (
            <label key={friend.id}>
              <input type="checkbox" checked={invitedFriends.includes(friend.id)} onChange={() => toggleInvitedFriends(friend.id)} />
              {friend.email}
            </label>
          ))}
          <button type="submit">Create Outing</button>
        </form>
        {outingMessage && <p>{outingMessage}</p>}
      </div>
    </div>
  )
}
export default DashboardPage
