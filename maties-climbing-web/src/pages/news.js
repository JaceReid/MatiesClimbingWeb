import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";

function NewsPage() {
    const background = {
        backgroundImage: `url(${require("../docs/A7R0316.jpg")})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0
    }

    const title = {
        width: '20%',
        marginLeft: '40%',
        color: 'white',
        textAlign: 'center',
        fontSize: '2rem',
        marginTop: '2%',
        marginBottom: '2%',
        fontWeight: "bold"
    }

    const contentPanel = {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '10px',
        padding: '20px',
        margin: '0 auto',
        width: '80%',
        maxHeight: '70vh',
        overflowY: 'auto',
        color: 'white'
    }

    const columnStyle = {
        padding: '20px'
    }

    const linkStyle = {
        color: 'white',
        textDecoration: 'none',
        fontSize: '1.2rem',
        margin: '10px 0',
        padding: '10px',
        display: 'block',
        transition: 'all 0.3s ease',
        borderLeft: '3px solid transparent'
    }

    const reports = [
        { title: "Annual Report 2023", url: "../docs/4octnews.pdf" },
        { title: "Quarterly Report Q1 2023", url: "/reports/q1-2023" },
        { title: "Quarterly Report Q2 2023", url: "/reports/q2-2023" },
        { title: "Quarterly Report Q3 2023", url: "/reports/q3-2023" }
    ];

    const eventReports = [
        { title: "Tech Conference 2023", url: "/events/tech-conf-2023" },
        { title: "Product Launch Event", url: "/events/product-launch" },
        { title: "Community Outreach", url: "/events/community-outreach" },
        { title: "Annual Gala", url: "/events/annual-gala" }
    ];

    return (
        <div style={background}>
            {/* <div className="container" style={{ height: '100vh', overflow: 'hidden' }}>
                <h2 className="d-flex justify-content-center" style={title}>Our reports</h2>
                <div style={contentPanel}>
                    <div className="row">
                        <div className="col-md-6" style={columnStyle}>
                            <h3 style={{ borderBottom: '1px solid white', paddingBottom: '10px' }}>Reports</h3>
                            {reports.map((report, index) => (
                                <a key={index} href={report.url} style={linkStyle} 
                                   onMouseOver={(e) => {
                                       e.target.style.borderLeft = '3px solid white';
                                       e.target.style.paddingLeft = '15px';
                                   }} 
                                   onMouseOut={(e) => {
                                       e.target.style.borderLeft = '3px solid transparent';
                                       e.target.style.paddingLeft = '10px';
                                   }}>
                                    {report.title}
                                </a>
                            ))}
                        </div>
                        <div className="col-md-6" style={columnStyle}>
                            <h3 style={{ borderBottom: '1px solid white', paddingBottom: '10px' }}>Event Reports</h3>
                            {eventReports.map((event, index) => (
                                <a key={index} href={event.url} style={linkStyle} 
                                   onMouseOver={(e) => {
                                       e.target.style.borderLeft = '3px solid white';
                                       e.target.style.paddingLeft = '15px';
                                   }} 
                                   onMouseOut={(e) => {
                                       e.target.style.borderLeft = '3px solid transparent';
                                       e.target.style.paddingLeft = '10px';
                                   }}>
                                    {event.title}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div> */}
        </div>
    );
}

export default NewsPage;