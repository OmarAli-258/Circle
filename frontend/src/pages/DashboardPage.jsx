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
  return (
    <div>
      <h2>Dashboard</h2>
      {currentUser && <p>Logged in as {currentUser.email}</p>}
      <h3>Friends</h3>
      {friends.map(friend => <p key ={friend.id}> {friend.email} </p>)}
      <h3>Friend Requests</h3>
      {friendsList.map(friend_request => ( <p key = {friend_request.id}> 
        {friend_request.requester_email}
        <button onClick={() => handleAccept(friend_request.id)}>Accept</button>
      </p>
    ))}
    </div>
  )
}
export default DashboardPage
