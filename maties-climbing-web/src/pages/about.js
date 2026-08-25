// export default AboutPage;
import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";
import comm from "../docs/comm-2026.jpeg";

// Wall rules and fees. Edit these two lists to change what the About page
// shows - they replace the old MatiesRulesPoster.png, which meant re-exporting
// an image every time a price changed.
const WALL_RULES = [
  "Your safety requires your focus. Use the mats, make sure there are no gaps, and don't walk under people climbing.",
  "Do not set climbs or change/add holds on the wall.",
  "No climbing on the wall without climbing shoes.",
  "No climbing on the wall while maintenance or route setting is taking place.",
  "Turn off the lights and lock the door if you are the last person to leave.",
  "Respect your fellow climbers, just be a lekker ou.",
  "Respect the venue. Don't leave your bag on the couch, and don't leave rubbish on the floor.",
];

const FEES = [
  { label: "Day pass (includes shoes)", price: "R50" },
  { label: "Membership (half year, students)", price: "R450" },
  { label: "Non-student membership (half year)", price: "R650" },
];

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
                      <li className="mb-2">💰 <strong>Membership:</strong> R450/half year (students), R650 (non-students)</li>
                      <li className="mb-2">🎟️ <strong>Day pass:</strong> R50 (shoes included)</li>
                      <li className="mb-0">💳 Payments via EFT or Student Account</li>
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
            <a href="/gear" className="btn btn-primary btn-lg">
              Book Gear Online
            </a>
            <div className="mt-3">
              {/* Kept as a fallback for one term while people get used to the
                  new page. Remove it after that - anything booked through the
                  form is invisible to the availability calendar. */}
              <a
                href="https://forms.gle/Kxwq3JsuegHBv1iq5"
                className="link-secondary small"
              >
                Or use the old rental form
              </a>
            </div>
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

        {/* Gym Rules
            Was a PNG poster (MatiesRulesPoster.png). Now plain markup so the
            rules and prices can be edited here instead of re-exporting an
            image - and so it stays readable on a phone and to screen readers. */}
        <section className="mb-5" style={contentStyle}>
          <h2 className="text-primary mb-4 text-center">Climbing Wall Rules</h2>
          <div className="row g-4">
            <div className="col-md-7">
              <ol className="mb-0">
                {WALL_RULES.map((rule, i) => (
                  <li key={i} className="mb-3">
                    {rule}
                  </li>
                ))}
              </ol>
            </div>

            <div className="col-md-5">
              <h3 className="h5 text-primary border-bottom pb-2">Fees &amp; Memberships</h3>
              <table className="table table-sm">
                <tbody>
                  {FEES.map((fee) => (
                    <tr key={fee.label}>
                      <td className="ps-0 border-0">{fee.label}</td>
                      <td className="text-end pe-0 border-0 fw-semibold">{fee.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="small">
                Ask a committee member for help with day passes or memberships.
              </p>
              <p className="small">
                Gear rental is also available to members who are experienced and know how to use
                the gear &mdash; <a href="/gear">book it here</a>.
              </p>
              <p className="small mb-0">
                Contact us:{" "}
                <a href="mailto:matiesclimbing@gmail.com">matiesclimbing@gmail.com</a>
              </p>
            </div>
          </div>
        </section>
          
         <section className="mb-5">
          <h2 className="text-primary mb-4 text-center">The 2026 Committee</h2>
          <div className="text-center">
            <img 
              src={comm} 
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