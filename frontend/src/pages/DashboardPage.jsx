import {useState, useEffect, useRef} from "react"
import {useNavigate, Link} from "react-router-dom"
import ThemeToggle from "../components/ThemeToggle"

function formatDateTime(dateInput) {
  const date = new Date(dateInput)
  const diffDays = (date - new Date()) / (1000 * 60 * 60 * 24)
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (diffDays >= 0 && diffDays < 7) {
    return `${date.toLocaleDateString([], { weekday: "long" })}, ${time}`
  }
  return `${date.toLocaleDateString()}, ${time}`
}

function formatRange(startInput, endInput) {
  const start = new Date(startInput)
  const end = new Date(endInput)
  if (start.toDateString() === end.toDateString()) {
    return `${formatDateTime(start)} – ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  }
  return `${formatDateTime(start)} – ${formatDateTime(end)}`
}

function toDatetimeLocalValue(dateInput) {
  const date = new Date(dateInput)
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function DashboardPage() {
  const navigate = useNavigate()
  useEffect(() => {
    async function checkLogin(){
      const token = localStorage.getItem("token")
      if (!token){
        navigate("/login", { state: { from: "/dashboard" } })
      }
    }
    checkLogin()
  },[] )
  const [currentUser, setCurrentUser] = useState(null)
  function handleLogout(){
    localStorage.removeItem("token")
    navigate("/login")
  }

  const [pendingAction, setPendingAction] = useState(null)
  const [actionError, setActionError] = useState("")
  async function runAction(key, url) {
    setPendingAction(key)
    setActionError("")
    const token = localStorage.getItem("token")
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {"Authorization": `Bearer ${token}`}
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setActionError(data.detail || "something went wrong, please try again")
        return false
      }
      return true
    } catch {
      setActionError("network error, please try again")
      return false
    } finally {
      setPendingAction(null)
    }
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
  useEffect(() => {
    displayFriends()
  }, [])
  async function handleRemoveFriend(friendId) {
    const ok = await runAction(`remove-friend-${friendId}`, `http://localhost:8000/friends/${friendId}/remove`)
    if (ok) displayFriends()
  }
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
    const ok = await runAction(`accept-request-${id}`, `http://localhost:8000/friend_requests/${id}/accept`)
    if (ok) { displayFriendsList(); displayFriends() }
  }
  async function handleDecline(id){
    const ok = await runAction(`decline-request-${id}`, `http://localhost:8000/friend_requests/${id}/decline`)
    if (ok) displayFriendsList()
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
  const [myAvailability, setMyAvailability] = useState([])
  async function displayMyAvailability() {
    const token = localStorage.getItem("token")
    if (!token) return
    const response = await fetch(`http://localhost:8000/availability/mine`, {
      headers : {"Authorization" : `Bearer ${token}`}
    })
    if (!response.ok) {
      localStorage.removeItem("token")
      navigate("/login")
      return
    }
    const data = await response.json()
    setMyAvailability(data)
  }
  useEffect(() => {
    displayMyAvailability()
  }, [])
  async function handleDeleteAvailability(availabilityId) {
    const ok = await runAction(`delete-availability-${availabilityId}`, `http://localhost:8000/availability/${availabilityId}/delete`)
    if (ok) displayMyAvailability()
  }
  async function handlePostAvailabilty(e){
    e.preventDefault()
    if (!availabilityStart || !availabilityEnd) {
      setAvailabilityMessage("Please fill in both start and end times")
      setAvailabilityMessageIsError(true)
      return
    }
    setPostingAvailability(true)
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/availability`, {
      method: "POST",
      headers : {
        "Content-Type" : "application/json",
        "Authorization" : `Bearer ${token}`
      },
      body : JSON.stringify({ start_time: new Date(availabilityStart).toISOString(), end_time: new Date(availabilityEnd).toISOString() })
    })
    const data = await response.json()
    if (response.ok) {
      setAvailabilityStart("")
      setAvailabilityEnd("")
      setAvailabilityMessage("Availability Set")
      setAvailabilityMessageIsError(false)
      displayMatched()
      displayMyAvailability()
    } else {
      setAvailabilityMessage(data.detail)
      setAvailabilityMessageIsError(true)
    }
    setPostingAvailability(false)
  }

  const [matchedFriends, setMatchedFriends] =useState([])
  const [newMatchIds, setNewMatchIds] = useState([])
  const [visibleMatchIds, setVisibleMatchIds] = useState([])
  const seenAtLoadRef = useRef(null)
  const matchObserverRef = useRef(null)

  useEffect(() => {
    matchObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = Number(entry.target.dataset.friendId)
          setVisibleMatchIds(prev => prev.includes(id) ? prev : [...prev, id])
          matchObserverRef.current.unobserve(entry.target)
        }
      })
    }, { threshold: 0.5 })
    return () => matchObserverRef.current.disconnect()
  }, [])

  function observeMatchCard(el) {
    if (el && matchObserverRef.current) {
      matchObserverRef.current.observe(el)
    }
  }
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
  useEffect(()=>{
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

  const [currentOutings, setCurrentOutings] = useState([])
  async function displayCurrentOutings() {
    const token = localStorage.getItem("token")
    if (!token) return
    const response = await fetch(`http://localhost:8000/outings/current`, {
      headers : {"Authorization" : `Bearer ${token}`}
    })
    if (!response.ok) {
      localStorage.removeItem("token")
      navigate("/login")
      return
    }
    const data = await response.json()
    setCurrentOutings(data)
  }
  useEffect(()=>{
    displayCurrentOutings()
  }, [])

  async function handleLeaveOuting(outingId) {
    const ok = await runAction(`leave-outing-${outingId}`, `http://localhost:8000/outings/${outingId}/leave`)
    if (ok) displayCurrentOutings()
  }

  async function handleDeleteOuting(outingId) {
    const ok = await runAction(`delete-outing-${outingId}`, `http://localhost:8000/outings/${outingId}/delete`)
    if (ok) displayCurrentOutings()
  }

  async function handleAcceptOuting(id) {
    const ok = await runAction(`accept-outing-${id}`, `http://localhost:8000/outing_invites/${id}/accept`)
    if (ok) { displayOutingInvites(); displayCurrentOutings() }
  }

  async function handleDeclineOuting(id) {
    const ok = await runAction(`decline-outing-${id}`, `http://localhost:8000/outing_invites/${id}/decline`)
    if (ok) displayOutingInvites()
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
  function handlePlanFromMatch(friend) {
    setInvitedFriends([friend.id])
    setProposedTime(toDatetimeLocalValue(friend.overlap_start))
    document.getElementById("outing-title")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }
  const [outingLocation,setOutingLocation] = useState("")
  const [outingTitle, setOutingTitle] = useState("")
  const [outingMessage, setOutingMessage] = useState("")
  const [outingMessageIsError, setOutingMessageIsError] = useState(false)
  const [creatingOuting, setCreatingOuting] = useState(false)
  async function handleCreateOuting(e) {
    e.preventDefault()
    if (!proposedTime) {
      setOutingMessage("Please choose a time")
      setOutingMessageIsError(true)
      return
    }
    setCreatingOuting(true)
    const token = localStorage.getItem("token")
    const response = await fetch(`http://localhost:8000/outings`, {
      method : "POST",
      headers : {
        "Content-Type" : "application/json",
        "Authorization" : `Bearer ${token}`},
      body : JSON.stringify({title : outingTitle ,location : outingLocation , proposed_time : new Date(proposedTime).toISOString(),
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
      displayCurrentOutings()
    } else{
      setOutingMessage(data.detail)
      setOutingMessageIsError(true)
    }
    setCreatingOuting(false)
  }

  return (
    <>
    <nav>
      <Link to="/" className="nav-logo"><span>Circle</span></Link>
      <div>
        <ThemeToggle />
      </div>
    </nav>
    <div className="page-container">
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="page-header-right">
          {currentUser && <p>Logged in as {currentUser.display_name}</p>}
          <button className="btn-secondary" onClick = {() => handleLogout()}>Logout</button>
        </div>
      </div>
      {actionError && <p className="form-message">{actionError}</p>}

      <div className="dashboard-layout">
        <div className="dashboard-section dashboard-sidebar">
          <div className="dashboard-sidebar-section">
            <h3>Friends</h3>
            {friends.length === 0 && <p className="empty-state">No friends yet — send a request below to get started.</p>}
            {friends.map(friend => (
              <p className="list-row" key ={friend.id}>
                <span title={friend.display_name}>{friend.display_name}</span>
                <button className="btn-secondary" disabled={pendingAction === `remove-friend-${friend.id}`} onClick={() => handleRemoveFriend(friend.id)}>Remove</button>
              </p>
            ))}
          </div>

          {friendsList.length > 0 && (
          <div className="dashboard-sidebar-section dashboard-sidebar-section--divider">
            <h3>Friend Requests</h3>
            {friendsList.map(friend_request => ( <p className="list-row" key = {friend_request.id}>
              <span title={friend_request.requester_display_name}>{friend_request.requester_display_name}</span>
              <span className="row-actions">
                <button disabled={pendingAction === `accept-request-${friend_request.id}`} onClick={() => handleAccept(friend_request.id)}>Accept</button>
                <button className="btn-secondary" disabled={pendingAction === `decline-request-${friend_request.id}`} onClick={() => handleDecline(friend_request.id)}>Decline</button>
              </span>
            </p>
          ))}
          </div>
          )}
        </div>

        <div className="dashboard-center">
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
            {myAvailability.length > 0 && (
              <div className="availability-reminder">
                <p className="empty-state">You're currently marked as free:</p>
                {myAvailability.map(window => (
                  <p className="list-row" key={window.id}>
                    <span>{formatRange(window.start_time, window.end_time)}</span>
                    <span className="row-actions">
                      <button className="btn-secondary" disabled={pendingAction === `delete-availability-${window.id}`} onClick={() => handleDeleteAvailability(window.id)}>Remove</button>
                    </span>
                  </p>
                ))}
              </div>
            )}
            <form onSubmit={handlePostAvailabilty}>
              <label htmlFor="availability-start">Available from</label>
              <input id="availability-start" type="datetime-local" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} required />
              <label htmlFor="availability-end">Available until</label>
              <input id="availability-end" type="datetime-local" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} required />
              <button type="submit" disabled={postingAvailability}>{postingAvailability ? "Posting..." : "Post"}</button>
            </form>
            {availabilityMessage && <p className={availabilityMessageIsError ? "form-message" : "form-message form-message--success"}>{availabilityMessage}</p>}
          </div>
          {matchedFriends.length > 0 && (
          <div className="dashboard-section dashboard-section--plum">
            <h3>Matches</h3>
            {matchedFriends.map(friend => (
              <div key={friend.id} data-friend-id={friend.id} ref={observeMatchCard} className={newMatchIds.includes(friend.id) && visibleMatchIds.includes(friend.id) ? "match-card match-card--animate" : "match-card match-card--settled"}>
                <p className="match-card-label">You're both free</p>
                <div className="match-card-avatars">
                  <div className="avatar avatar-coral match-avatar-left">{currentUser?.display_name?.[0]?.toUpperCase()}</div>
                  <div className="avatar avatar-plum match-avatar-right">{friend.display_name[0].toUpperCase()}</div>
                </div>
                <p className="match-card-title">You and {friend.display_name} are free</p>
                <p className="match-card-time">{formatRange(friend.overlap_start, friend.overlap_end)}</p>
                <button className="match-card-plan-button" onClick={() => handlePlanFromMatch(friend)}>Plan something</button>
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
                <button disabled={pendingAction === `accept-outing-${invite.id}`} onClick={() => handleAcceptOuting(invite.id)}>Accept</button>
                <button className="btn-secondary" disabled={pendingAction === `decline-outing-${invite.id}`} onClick={() => handleDeclineOuting(invite.id)}>Decline</button>
              </span>
            </p>
          ))}
          </div>
          )}
          {currentOutings.length > 0 && (
          <div className="dashboard-section">
          <h3>Current Outings</h3>
          {currentOutings.map(outing => (
            <div className="list-row list-row--stacked" key={outing.id}>
              <strong>{outing.title}</strong>
              <span>{outing.location} — {formatDateTime(outing.proposed_time)}</span>
              <span className="empty-state">
                With {[
                  { email: outing.creator_email, name: outing.creator_display_name },
                  ...outing.accepted_invitee_emails.map((email, i) => ({ email, name: outing.accepted_invitee_display_names[i] })),
                ].filter((person, i, all) => all.findIndex(p => p.email === person.email) === i && person.email !== currentUser?.email)
                 .map(person => person.name)
                 .join(", ") || "just you so far"}
              </span>
              <span className="row-actions">
                {outing.creator_email === currentUser?.email ? (
                  <button className="btn-secondary" disabled={pendingAction === `delete-outing-${outing.id}`} onClick={() => handleDeleteOuting(outing.id)}>Delete</button>
                ) : (
                  <button className="btn-secondary" disabled={pendingAction === `leave-outing-${outing.id}`} onClick={() => handleLeaveOuting(outing.id)}>Leave</button>
                )}
              </span>
            </div>
          ))}
          </div>
          )}
          <div className="dashboard-section dashboard-section--plum">
            <h3>Create Outing</h3>
            <form onSubmit={handleCreateOuting}>
              <label htmlFor="outing-title">Title</label>
              <input id="outing-title" type="text" value={outingTitle} onChange={(e) => setOutingTitle(e.target.value)} />
              <label htmlFor="outing-time">When</label>
              <input id="outing-time" type="datetime-local" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} required />
              <label htmlFor="outing-location">Location</label>
              <input id="outing-location" type="text" value={outingLocation} onChange={(e) => setOutingLocation(e.target.value)} />
              <div className="invite-friends-grid">
                {friends.map(friend => (
                  <label key={friend.id}>
                    <input type="checkbox" checked={invitedFriends.includes(friend.id)} onChange={() => toggleInvitedFriends(friend.id)} />
                    {friend.display_name}
                  </label>
                ))}
              </div>
              <button type="submit" disabled={creatingOuting}>{creatingOuting ? "Creating..." : "Create Outing"}</button>
            </form>
            {outingMessage && <p className={outingMessageIsError ? "form-message" : "form-message form-message--success"}>{outingMessage}</p>}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
export default DashboardPage
