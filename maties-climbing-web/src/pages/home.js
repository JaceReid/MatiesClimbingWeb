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
    width: "60%",
    marginLeft: "20%",
    color: "white",
    textAlign: "center",
    fontSize: "5rem",
    fontWeight: "bold",
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: "rgba(2, 2, 59, 0.9)", // Dark blue with 70% opacity
    padding: "20px", // Add some padding around the text
    borderRadius: "10px", // Optional: rounded corners
    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)", // Optional: text shadow for better contrast
  };

  const separator = {
    width: "60%",
    marginLeft: "20%",
    height: "2px",
    backgroundColor: "white",
    position: "absolute",
    top: "calc(50% + 8rem)", // Adjusted to account for title padding
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