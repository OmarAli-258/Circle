import { Link } from "react-router-dom"

function LandingPage() {
    
    
    
    return (
        <div>
            <nav>
                <span>Circle</span>
                <div>
                    <Link to="/login">Login</Link>
                    <Link to="/signup">Sign up</Link>
                </div>
            </nav>
            <section className="hero">
                <div className="hero-split"> 
                    <div className="hero-text"> 
                        <h1>Stop planning hangouts over 50-message-long group chats</h1>
                        <p>Circle shows you the moment your free time and your friend's overlap — no back
                            and forth, no one left on read.</p>
                        <Link to="/signup">Sign up</Link>
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
        </div>
    )
}
export default LandingPage