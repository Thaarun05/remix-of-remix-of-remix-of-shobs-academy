import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home page and scroll to about section
    navigate("/", { replace: true });
    setTimeout(() => {
      document.getElementById("about-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [navigate]);

  return null;
};

export default About;
