import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet} from "../../../utils/api";
import Loading from "../../../components/ui/Loading";

// Check if date is expired
const isExpired = (dateStr) => {
  if (!dateStr) return false;
  // Parse dd-mm-yyyy format
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    const d = new Date(dateStr);
    return !isNaN(d) && d < new Date();
  }
  const [, day, month, year] = match;
  const expiry = new Date(year, month - 1, day);
  if (isNaN(expiry)) return false;
  return expiry < new Date();
};

export default function DriverProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const {user} = useAuth();
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchProfile();
    }
  }, [driverId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/driver/profile?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading fullScreen={false} text="Loading profile..." />;
  if (!profile)
    return <div className="p-8 text-center text-red">Profile not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header Card */}
      <div className="bg-white rounded-md p-4 sm:p-6 lg:p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 lg:gap-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-tr from-primary to-primarydull rounded-md flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-4 border-white shadow-lg shrink-0">
          {profile.full_name?.charAt(0)}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-primarytext">
            {profile.full_name}
          </h2>
          <p className="text-secondarytext">{profile.email}</p>
          <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
            <span className="px-3 py-1 bg-primarybg text-secondarytext text-xs font-semibold rounded-md border border-gray-200">
              {profile.experience_years} Years Exp
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-secondarytext mb-1">Current Status</div>
          <span
            className={`px-4 py-2 rounded-md text-sm font-bold border ${
              profile.status === "present"
                ? "bg-green/10 text-green border-green/20"
                : profile.status === "on_leave"
                  ? "bg-red/10 text-red border-red/20"
                  : "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {profile.status?.toUpperCase().replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* License Details */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-bold text-primarytext mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
            License Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                License Number
              </label>
              <p className="font-mono text-primarytext font-medium text-lg">
                {profile.license_number}
              </p>
            </div>
            <div className="flex justify-between">
              <div>
                <label className="text-xs font-semibold text-secondarytext uppercase">
                  Type
                </label>
                <p className="text-primarytext font-medium">
                  {profile.license_type}
                </p>
              </div>
              <div className="text-right">
                <label className="text-xs font-semibold text-secondarytext uppercase">
                  Expires On
                </label>
                <p
                  className={`font-medium ${
                    isExpired(profile.license_expiry)
                      ? "text-red"
                      : "text-primarytext"
                  }`}
                >
                  {profile.license_expiry || "-"}
                </p>
              </div>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-3">
              <div>
                <label className="text-xs font-semibold text-secondarytext uppercase">
                  Date of Joining
                </label>
                <p className="text-primarytext font-medium">
                  {profile.date_of_joining || "-"}
                </p>
              </div>
              <div className="text-right">
                <label className="text-xs font-semibold text-secondarytext uppercase">
                  Date of Relieving
                </label>
                <p className="text-primarytext font-medium">
                  {profile.date_of_relieving || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="text-lg font-bold text-primarytext mb-4 flex items-center gap-2">
            <span className="text-xl">📞</span> Contact Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-secondarytext uppercase">
                Phone Number
              </label>
              <p className="text-primarytext font-medium text-lg">
                {profile.phone}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-secondarytext uppercase">
                Email Address
              </label>
              <p className="text-primarytext font-medium">{profile.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
