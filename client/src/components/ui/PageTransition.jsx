import React, {useState, useEffect, useRef} from "react";

const PageTransition = ({children, className = "", transitionKey}) => {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const prevKey = useRef(transitionKey);

  useEffect(() => {
    if (prevKey.current !== transitionKey) {
      setTransitioning(true);
      const t = setTimeout(() => {
        setDisplayChildren(children);
        setTransitioning(false);
        prevKey.current = transitionKey;
      }, 100);
      return () => clearTimeout(t);
    } else {
      setDisplayChildren(children);
    }
  }, [transitionKey, children]);

  return (
    <div
      className={className}
      style={{
        opacity: transitioning ? 0 : 1,
        transition: "opacity 0.12s ease",
        willChange: "opacity",
      }}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
