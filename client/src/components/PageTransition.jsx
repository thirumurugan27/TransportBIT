import React, {useState, useEffect} from "react";

const PageTransition = ({children}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger the fade-in animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`page-transition ${isVisible ? "page-transition-enter" : ""}`}
    >
      {children}
    </div>
  );
};

export default PageTransition;
