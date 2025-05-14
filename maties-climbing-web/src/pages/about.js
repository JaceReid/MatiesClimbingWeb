// export default AboutPage;
import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";
import gymRules from "../docs/MatiesRulesPoster.png";

function AboutPage() {
  const background = {
    // backgroundImage: `url(${require("../docs/DSCF8141.jpg")})`,
    // backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    width: "100%",
    height: "400px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "3rem",
  };

  // Add this style for the page background
  const pageBackground = {
    backgroundImage: `url(${require("../docs/Rocklands-bouldering-sky-Lumos-Photography.jpg")})`, // Change to your preferred background image
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    minHeight: "100vh",
  };

  // Add this style for content containers to ensure readability
  const contentStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.9)", // Semi-transparent white
    borderRadius: "0.5rem",
    padding: "2rem",
    marginBottom: "2rem",
  };

  return (
    <div style={pageBackground}>
      <div className="container-fluid px-0">
        {/* Hero Section */}
        <div style={background}>
          <div className="text-center text-white p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <h1 className="display-4 fw-bold mb-4">Maties Climbing</h1>
            <p className="lead">The home of rock climbing in Stellenbosch</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="container py-4">
          {/* Introduction */}
          <section className="mb-5" style={contentStyle}>
            <h2 className="text-primary mb-4 text-center">Welcome to Maties Climbing</h2>
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <ul className="list-group list-group-flush">
                  <li className="list-group-item">Open to anyone interested in Rock Climbing</li>
                  <li className="list-group-item">Registered sport at the University for all skill levels</li>
                  <li className="list-group-item">24/7 wall access for members</li>
                  <li className="list-group-item">Guests welcome Mon-Thurs (16:30-19:00)</li>
                  <li className="list-group-item">Climbers under 18 must be supervised</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Fees Section */}
          <section className="mb-5" style={contentStyle}>
            <h2 className="text-primary mb-4 text-center">Fees</h2>
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <ul className="list-unstyled">
                      <li className="mb-2">💰 <strong>Membership:</strong> R600/year (students), R800 (non-students)</li>
                      <li className="mb-2">🎟️ <strong>Day pass:</strong> R50 (shoes included)</li>
                      <li className="mb-0">💳 Payments via EFT or snapscan</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* All other sections... */}
          {/* Make sure to add style={contentStyle} to each section */}
         {/* Location Section */}
         <section className="mb-5">
           <h2 className="text-primary mb-4 text-center">Getting There</h2>
           <div className="row">
             <div className="col-md-6 mb-4 mb-md-0">
               <div className="card h-100 shadow-sm">
                 <div className="card-body">
                   <p>The bouldering cave (climbing wall) is located at the far eastern side of the Coetzenberg sports grounds (past the underwater club and the last cricket field).</p>
                   <a href="https://www.google.com/maps/place/Maties+Rock+Climbing+Wall/@-33.9390587,18.8795416,17z/data=!3m1!4b1!4m6!3m5!1s0x1dcdb356f7d64ee9:0x9b190fbd784be7d4!8m2!3d-33.9390587!4d18.8821165!16s%2Fg%2F11j8m3gw4p?entry=ttu" 
                     className="btn btn-primary">
                    View on Google Maps
                  </a>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="ratio ratio-16x9">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3310.0804571921617!2d18.882116500000002!3d-33.9390587!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1dcdb356f7d64ee9%3A0x9b190fbd784be7d4!2sMaties%20Rock%20Climbing%20Wall!5e0!3m2!1sen!2sza!4v1705846206758!5m2!1sen!2sza" 
                  style={{ border: 0 }} 
                  allowFullScreen="" 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade">
                </iframe>
              </div>
            </div>
          </div>
        </section>

        {/* Gear Rental */}
        <section className="mb-5">
          <h2 className="text-primary mb-4 text-center">Gear Rental</h2>
          <div className="text-center">
            <a href="https://forms.gle/Kxwq3JsuegHBv1iq5" className="btn btn-primary btn-lg">
              Rent Gear Online
            </a>
          </div>
        </section>

        {/* Useful Websites */}
        <section className="mb-5">
          <h2 className="text-primary mb-4 text-center">Useful Websites</h2>
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="list-group">
                <a href="https://www.rocklands.africa/" className="list-group-item list-group-item-action">Rocklands</a>
                <a href="https://www.climbing.co.za/wiki/Stellenbosch" className="list-group-item list-group-item-action">ClimbingZA Stellenbosch</a>
                <a href="https://stellenbosch.mcsa.org.za/" className="list-group-item list-group-item-action">MSCA</a>
                <a href="https://www.thecrag.com/en/home" className="list-group-item list-group-item-action">The Crag</a>
                <a href="https://chat.whatsapp.com/0t2Bk40PjqO5rsbYWNRpNf" className="list-group-item list-group-item-action">Stellenbosch Crew Climbing WhatsApp Group</a>
              </div>
            </div>
          </div>
        </section>

        {/* Gym Rules */}
        <section className="mb-5">
          <h2 className="text-primary mb-4 text-center">Gym Rules</h2>
          <div className="text-center">
            <img 
              src={gymRules} 
              alt="Gym Rules Poster" 
              className="img-fluid rounded shadow"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
        </section>
          
        </div>
      </div>
    </div>
  );
}

export default AboutPage;