import React from "react";
import {CheckCircle2, AlertTriangle, AlertCircle, Info, X} from "lucide-react";

const typeConfig = {
  success: {
    accent: "text-green",
    badge: "bg-green/10",
    border: "border-green",
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    accent: "text-red",
    badge: "bg-red/10",
    border: "border-red",
    icon: <AlertCircle size={18} />,
  },
  warning: {
    accent: "text-pending",
    badge: "bg-pending/10",
    border: "border-pending",
    icon: <AlertTriangle size={18} />,
  },
  info: {
    accent: "text-primary",
    badge: "bg-primary/10",
    border: "border-primary",
    icon: <Info size={18} />,
  },
};

const Toast = ({message, type = "info", onClose}) => {
  const cfg = typeConfig[type] || typeConfig.info;

  return (
    <div className="w-full max-w-xl">
      <div
        className={`flex items-start gap-3 rounded-md border ${cfg.border} bg-secondarybg shadow-md px-4 py-3`}
      >
        <span className={`p-2 rounded-md ${cfg.badge} ${cfg.accent}`}>
          {cfg.icon}
        </span>
        <div className="text-sm text-primarytext leading-relaxed flex-1">
          {message}
        </div>
        <button
          type="button"
          aria-label="Close alert"
          onClick={onClose}
          className="text-secondarytext hover:text-primary p-1 rounded-md transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
