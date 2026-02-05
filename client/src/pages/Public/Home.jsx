import React from "react";
import {useNavigate} from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const roles = [
    {
      name: "Admin",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      gradient: "from-blue-500 to-blue-600",
      shadow: "shadow-blue-500/25",
    },
    {
      name: "In-Charge",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      gradient: "from-emerald-500 to-emerald-600",
      shadow: "shadow-emerald-500/25",
    },
    {
      name: "Driver",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      ),
      gradient: "from-orange-500 to-orange-600",
      shadow: "shadow-orange-500/25",
    },
    {
      name: "Student",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
      gradient: "from-purple-500 to-purple-600",
      shadow: "shadow-purple-500/25",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-primarybg via-white to-primarybg flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-md blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-primarydull/20 rounded-md blur-3xl animate-float"
          style={{animationDelay: "1s"}}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-md blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo/Icon */}
        <div className="mb-8 animate-slideDown">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-md border border-gray-100 shadow-xl shadow-primary/10">
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 17h.01M16 17h.01M9 17h6M5 8h14M5 8a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-4xl md:text-5xl font-bold text-primarytext mb-4 animate-slideDown"
          style={{animationDelay: "0.1s"}}
        >
          Transport Management
        </h1>
        <p
          className="text-lg text-secondarytext mb-12 animate-slideDown"
          style={{animationDelay: "0.2s"}}
        >
          Unified login portal for all users
        </p>

        {/* Role Cards Grid */}
        <div
          className="grid grid-cols-2 gap-4 max-w-md mx-auto animate-slideUp"
          style={{animationDelay: "0.3s"}}
        >
          {roles.map((role, index) => (
            <button
              key={role.name}
              onClick={() => navigate("/login")}
              className="group relative bg-white p-6 rounded-md text-primarytext font-semibold shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 transition-all duration-300 overflow-hidden border border-gray-100 hover:border-primary/30"
              style={{animationDelay: `${0.4 + index * 0.1}s`}}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="p-3 bg-primarybg rounded-md text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  {role.icon}
                </div>
                <span className="text-lg">{role.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p
          className="mt-12 text-sm text-secondarytext animate-fadeIn"
          style={{animationDelay: "0.8s"}}
        >
          All users login through a single secure portal
        </p>
      </div>
    </div>
  );
}
