import React from "react";
import Toast from "./Toast";

const ToastContainer = ({alert, clearAlert}) => {
  if (!alert) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-[80] px-4 flex justify-center">
      <Toast {...alert} onClose={clearAlert} />
    </div>
  );
};

export default ToastContainer;
