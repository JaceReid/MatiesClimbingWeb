import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";

function HomePage() {
  const background = {
    backgroundImage: `url(${require("../docs/homeBG.png")})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    width: "100vw",
    height: "100vh",
    position: "fixed",
    top: 0,
    left: 0,
    overflow: "hidden",
    margin: 0,
    padding: 0,
  };

  const title = {
    width: "90%", // Increased from 60% for mobile
    maxWidth: "800px", // Added max-width for larger screens
    margin: "0 auto", // Centering with auto margins
    color: "white",
    textAlign: "center",
    fontSize: "clamp(2.5rem, 8vw, 5rem)", // Responsive font size
    fontWeight: "bold",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)", // Proper centering
    backgroundColor: "rgba(2, 2, 59, 0.9)",
    padding: "20px",
    borderRadius: "10px",
    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
  };

  const separator = {
    width: "90%", // Match title width
    maxWidth: "800px", // Match title max-width
    margin: "0 auto", // Centering
    height: "2px",
    backgroundColor: "white",
    position: "absolute",
    top: "calc(50% + 8rem)", // Adjusted to account for title padding
    left: "50%",
    transform: "translateX(-50%)", // Center horizontally
  };

  return (
    <div style={background}>
      <div className="container" style={{ height: "100%" }}>
        <div className="row" style={{ height: "100%", position: "relative" }}>
          <h1 style={title} id="welcome">
            Welcome to Maties Climbing
          </h1>
          <div style={separator}></div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;