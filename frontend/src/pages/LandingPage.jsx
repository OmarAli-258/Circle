import { useState } from "react"
import { Link } from "react-router-dom"

function LandingPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"))

    function handleSignOut() {
        localStorage.removeItem("token")
        setIsLoggedIn(false)
    }

    return (
        <div>
            <nav>
                <Link to="/" className="nav-logo"><span>Circle</span></Link>
                <div>
                    {isLoggedIn ? (
                        <Link to="/dashboard">Dashboard</Link>
                    ) : (
                        <>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Sign up</Link>
                        </>
                    )}
                </div>
            </nav>
            <section className="hero">
                <div className="hero-split"> 
                    <div className="hero-text"> 
                        <h1>Stop planning hangouts over 50-message-long group chats</h1>
                        <p>Circle shows you the moment your free time and your friend's overlap — no back
                            and forth, no one left on read.</p>
                        {isLoggedIn ? (
                            <button onClick={handleSignOut}>Sign out</button>
                        ) : (
                            <Link to="/signup">Sign up</Link>
                        )}
                    </div>
                    <div className="hero-image">
                        <div className="match-card">
                            <p className="match-card-label">You're both free</p>
                            <div className="match-card-avatars">
                                <div className="avatar avatar-coral">Y</div>
                                <div className="avatar avatar-plum">J</div>
                            </div>
                            <p className="match-card-title">You and Jordan are free</p>
                            <p className="match-card-time">Saturday, 6-8pm</p>
                        </div>
                    </div>
                </div>
            </section>
            <section className="how-it-works">
                <h2>How it works</h2>
                <div className="how-it-works-steps">
                    <div className="how-it-works-step">
                        <div className="step-number">1</div>
                        <h3>Add your friends</h3>
                        <p>Send a friend request by email. Once they accept, you're connected — no group chats to manage.</p>
                    </div>
                    <div className="how-it-works-step">
                        <div className="step-number">2</div>
                        <h3>Share when you're free</h3>
                        <p>Post a quick time window whenever your plans open up. Nobody sees it — yet.</p>
                    </div>
                    <div className="how-it-works-step">
                        <div className="step-number">3</div>
                        <h3>Get matched automatically</h3>
                        <p>The moment your free time overlaps with a friend's, you both find out at the same time.</p>
                    </div>
                    <div className="how-it-works-step">
                        <div className="step-number">4</div>
                        <h3>Plan the outing</h3>
                        <p>Turn a match into a real invite, and see who's actually confirmed before you show up.</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
export default LandingPage