// React is installed in the studio and should be treated as a peer dependency
import React from "react";
import logo from "./logo.png";

const Logo = () => {
  if (process.env.NODE_ENV === "development") {
    return (
      <div style={{ color: "yellow" }}>STAGING</div>
    )
  }

  return (
    <div>
      <img style={{ position: "relative", top: "3px" }} alt="fhfh logo" width="18px" height="18px" src={logo} />
    </div>
  );
};

export default Logo;
