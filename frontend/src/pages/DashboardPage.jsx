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
  return (
    <div>
      <h2>Dashboard</h2>
      {currentUser && <p>Logged in as {currentUser.email}</p>}
      {friends.map(friend => <p key ={friend.id}> {friend.email} </p>)}
    </div>
  )
}

export default DashboardPage
