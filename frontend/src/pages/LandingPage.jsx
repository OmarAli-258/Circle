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
                        <img src="/dashboard-preview.png" alt="Dashboard preview showing matching with friends"/>
                    </div>
                </div>
            </section>
        </div>
    )
}
export default LandingPage