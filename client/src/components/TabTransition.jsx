import React, {useState, useEffect} from "react";

const TabTransition = ({children, activeKey}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Reset animation on tab change
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => clearTimeout(timer);
  }, [activeKey]);

  return (
    <div
      className={`tab-transition ${isVisible ? "tab-transition-enter" : ""}`}
    >
      {children}
    </div>
  );
};

export default TabTransition;
