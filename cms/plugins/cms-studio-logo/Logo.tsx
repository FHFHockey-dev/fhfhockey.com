import logo from "./logo.png";

const Logo = () => {
  if (process.env.SANITY_STUDIO_API_DATASET === "staging") {
    return <div style={{ color: "yellow" }}>STAGING</div>;
  }

  return (
    <div>
      <img
        style={{ position: "relative", top: "3px" }}
        alt="fhfh logo"
        width="18px"
        height="18px"
        src={logo}
      />
    </div>
  );
};

export default Logo;
