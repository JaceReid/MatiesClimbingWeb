"use client";
import React from "react";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import HomePage from "../pages/home";
import NewsPage from "../pages/news";
import GalleryPage from "../pages/gallery";

const Navbar = () => {
  const navStyles = {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    position: "fixed",
    width: "100%",
    top: "0",
    zIndex: 1000,
    backdropFilter: "blur(5px)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  };

  return (
    <>
      {/* Background image that will stay fixed */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        zIndex: -1,
        opacity: 0.7
      }} />
      
      <header style={navStyles}>
        <div className="collapse bg-dark" id="navbarHeader">
          <div className="container">
            <div className="row">
              <div className="col-sm-8 col-md-7 py-4">
                <h4 className="text-white">Upcoming Events</h4>
                <ul className="text-white">
                  <li>Next Skud in die Shack (start of next term)</li>
                  <li>Rocklands beginners weekend (TBC)</li>
                </ul>
              </div>
              <div className="col-sm-4 offset-md-1 py-4">
                <h4 className="text-white">Contact</h4>
                <ul className="list-unstyled">
                  <li>
                    <a href="https://www.instagram.com/matiesclimbing/?hl=en" className="text-white">
                      Our Instagram
                    </a>
                  </li>
                  <li>
                    <a href="https://chat.whatsapp.com/JNiZrsnaWuhHxDGYydHWq1" className="text-white">
                      Our WhatsApp Group
                    </a>
                  </li>
                  <li>
                    <a href="https://arcadebouldering.page.link?apn=com.arcadebouldering.system_wall&ibi=com.arcadebouldering.systemWall&imv=1.0.0&isi=1519582483&link=https%3A%2F%2Fwww.arcadebouldering.com%2Fgym%3Fid%3DVKLlIRpvUcGXiWkSoBHZ" className="text-white">
                      Retroflash
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="navbar navbar-dark bg-dark box-shadow">
          <div className="container d-flex justify-content-between">
            <a href="/" className="navbar-brand d-flex align-items-center">
              <strong>Maties Climbing</strong>
            </a>
            <ul className="navbar-nav mx-auto d-flex flex-row">
              <li className="nav-item px-2">
                <a className="nav-link" href="/home">Home</a>
              </li>
              <li className="nav-item px-2">
                <a className="nav-link" href="/news">News</a>
              </li>
              <li className="nav-item px-2">
                <a className="nav-link" href="/about">About</a>
              </li>
              <li className="nav-item px-2">
                <a className="nav-link" href="/signup">Signup</a>
              </li>
            </ul>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarHeader"
              aria-controls="navbarHeader"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;