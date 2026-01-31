import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import ToastContainer from "../components/ui/ToastContainer";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({children}) => {
  const [alert, setAlert] = useState(null);
  const timeoutRef = useRef(null);

  const clearAlert = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAlert(null);
  }, []);

  const showToast = useCallback(
    (message, type = "info") => {
      if (!message) return;
      const id = Date.now().toString();
      setAlert({id, message, type});

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        clearAlert();
      }, 3500);
    },
    [clearAlert],
  );

  return (
    <ToastContext.Provider value={{showToast, clearAlert}}>
      {children}
      <ToastContainer alert={alert} clearAlert={clearAlert} />
    </ToastContext.Provider>
  );
};
