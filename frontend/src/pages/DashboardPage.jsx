import {useState, useEffect, useRef} from "react"
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
      if (!token) return
      const response = await fetch("http://localhost:8000/me", {
      headers : {"Authorization": `Bearer ${token}`},
      })
      if (!response.ok) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }
      const data = await response.json()
      setCurrentUser(data)
    } 
    fetchUser() 
  }, [])

  const [friends, setFriends] = useState([])
  useEffect(() => {
    async function displayFriends(){
      const token = localStorage.getItem("token")
      if (!token) return
      const response = await fetch("http://localhost:8000/friends", {
        headers: {"Authorization": `Bearer ${token}` },
      })
      if (!response.ok) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }
      const data = await response.json()
      setFriends(data)
    }
    displayFriends()
  }, []) 
  const [friendsList, setFriendsList] = useState([])
  async function displayFriendsList(){
    const token= localStorage.getItem("token")
    if (!token) return
    const response = await fetch("http://localhost:8000/friend_requests/pending", {
      headers: {"Authorization" : `Bearer ${token}` },
    })
    if (!response.ok) {
      localStorage.removeItem("token")
      navigate("/login")
      return
    }
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
  const [messageIsError, setMessageIsError] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)
  async function handleSentInformation(e){
    e.preventDefault()
    setSendingRequest(true)
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
    setMessageIsError(false)
    }
    else{
    setMessage(data.detail)
    setMessageIsError(true)
    }
    setSendingRequest(false)
  }
  const [availabilityStart,setAvailabilityStart] =useState("")
  const [availabilityEnd, setAvailabilityEnd] = useState("")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const [availabilityMessageIsError, setAvailabilityMessageIsError] = useState(false)
  const [postingAvailability, setPostingAvailability] = useState(false)
  async function handlePostAvailabilty(e){
    e.preventDefault()
    setPostingAvailability(true)
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
      setAvailabilityMessageIsError(false)
    } else {
      setAvailabilityMessage(data.detail)
      setAvailabilityMessageIsError(true)
    }
    setPostingAvailability(false)
  }

  const [matchedFriends, setMatchedFriends] =useState([])
  const [newMatchIds, setNewMatchIds] = useState([])
  const seenAtLoadRef = useRef(null)
  useEffect(()=>{
    async function displayMatched() {
      const token = localStorage.getItem("token")
      if (!token) return
      const response = await fetch(`http://localhost:8000/availability/matches`, {
        headers : { "Authorization" : `Bearer ${token}`}
      })
      if (!response.ok) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }
      const data = await response.json()
      setMatchedFriends(data)

      if (seenAtLoadRef.current === null) {
        seenAtLoadRef.current = JSON.parse(localStorage.getItem("seenMatchIds") || "[]")
      }
      const seenMatchIds = seenAtLoadRef.current
      const newIds = data.filter(friend => !seenMatchIds.includes(friend.id)).map(friend => friend.id)
      setNewMatchIds(newIds)
      localStorage.setItem("seenMatchIds", JSON.stringify([...seenMatchIds, ...newIds]))
    }
    displayMatched()
    }, [])
  
  const [outingInvites, setOutinginvites] = useState([])
  async function displayOutingInvites() {
    const token = localStorage.getItem("token")
    if (!token) return
    const response = await fetch(`http://localhost:8000/outing_invites/pending`, {
      headers : {"Authorization" : `Bearer ${token} `}
    })
    if (!response.ok) {
      localStorage.removeItem("token")
      navigate("/login")
      return
    }
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
  const [outingMessageIsError, setOutingMessageIsError] = useState(false)
  const [creatingOuting, setCreatingOuting] = useState(false)
  async function handleCreateOuting(e) {
    e.preventDefault()
    setCreatingOuting(true)
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
      setOutingMessageIsError(false)
    } else{
      setOutingMessage(data.detail)
      setOutingMessageIsError(true)
    }
    setCreatingOuting(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="page-header-right">
          {currentUser && <p>Logged in as {currentUser.email}</p>}
          <button className="btn-secondary" onClick = {() => handleLogout()}>Logout</button>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Friends</h3>
        {friends.length === 0 && <p className="empty-state">No friends yet — send a request below to get started.</p>}
        {friends.map(friend => <p className="list-row" key ={friend.id}> {friend.email} </p>)}
      </div>

      {friendsList.length > 0 && (
      <div className="dashboard-section">
        <h3>Friend Requests</h3>
        {friendsList.map(friend_request => ( <p className="list-row" key = {friend_request.id}>
          <span>{friend_request.requester_email}</span>
          <span className="row-actions">
            <button onClick={() => handleAccept(friend_request.id)}>Accept</button>
            <button className="btn-secondary" onClick={() => handleDecline(friend_request.id)}>Decline</button>
          </span>
        </p>
      ))}
      </div>
      )}
      <div className ="dashboard-section">
      <h3>Send Friend Requests</h3>
      <form onSubmit={handleSentInformation}>
        <label htmlFor="request-email">Friend's email</label>
        <input id="request-email" type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} />
        <button type="submit" disabled={sendingRequest}>{sendingRequest ? "Sending..." : "Send"}</button>
      </form>
      {message && <p className={messageIsError ? "form-message" : "form-message form-message--success"}>{message}</p>}
      </div>
      <div className="dashboard-section">
        <h3>Availability</h3>
        <form onSubmit={handlePostAvailabilty}>
          <label htmlFor="availability-start">Available from</label>
          <input id="availability-start" type="datetime-local" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} />
          <label htmlFor="availability-end">Available until</label>
          <input id="availability-end" type="datetime-local" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} />
          <button type="submit" disabled={postingAvailability}>{postingAvailability ? "Posting..." : "Post"}</button>
        </form>
        {availabilityMessage && <p className={availabilityMessageIsError ? "form-message" : "form-message form-message--success"}>{availabilityMessage}</p>}
      </div>
      {matchedFriends.length > 0 && (
      <div className="dashboard-section dashboard-section--plum">
        <h3>Matches</h3>
        {matchedFriends.map(friend => (
          <div key={friend.id} className={newMatchIds.includes(friend.id) ? "match-card match-card--animate" : "match-card match-card--settled"}>
            <p className="match-card-label">You're both free</p>
            <div className="match-card-avatars">
              <div className="avatar avatar-coral match-avatar-left">{currentUser?.email?.[0]?.toUpperCase()}</div>
              <div className="avatar avatar-plum match-avatar-right">{friend.email[0].toUpperCase()}</div>
            </div>
            <p className="match-card-title">You and {friend.email} are free</p>
          </div>
        ))}
      </div>
      )}
      {outingInvites.length > 0 && (
      <div className="dashboard-section">
      <h3>Outing Invites</h3>
      {outingInvites.map(invite => (
        <p className="list-row" key={invite.id}>
          <span>{invite.outing_title}, {invite.outing_location}, {invite.outing_time}</span>
          <span className="row-actions">
            <button onClick={() => handleAcceptOuting(invite.id)}>Accept</button>
            <button className="btn-secondary" onClick={() => handleDeclineOuting(invite.id)}>Decline</button>
          </span>
        </p>
      ))}
      </div>
      )}
      <div className="dashboard-section dashboard-section--plum">
        <h3>Create Outing</h3>
        <form onSubmit={handleCreateOuting}>
          <label htmlFor="outing-title">Title</label>
          <input id="outing-title" type="text" value={outingTitle} onChange={(e) => setOutingTitle(e.target.value)} />
          <label htmlFor="outing-time">When</label>
          <input id="outing-time" type="datetime-local" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} />
          <label htmlFor="outing-location">Location</label>
          <input id="outing-location" type="text" value={outingLocation} onChange={(e) => setOutingLocation(e.target.value)} />
          {friends.map(friend => (
            <label key={friend.id}>
              <input type="checkbox" checked={invitedFriends.includes(friend.id)} onChange={() => toggleInvitedFriends(friend.id)} />
              {friend.email}
            </label>
          ))}
          <button type="submit" disabled={creatingOuting}>{creatingOuting ? "Creating..." : "Create Outing"}</button>
        </form>
        {outingMessage && <p className={outingMessageIsError ? "form-message" : "form-message form-message--success"}>{outingMessage}</p>}
      </div>
    </div>
  )
}
export default DashboardPage
