import React from "react";
import Toast from "./Toast";

const ToastContainer = ({toasts, removeToast}) => {
  return (
    <div className="fixed top-5 right-5 z-[999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
