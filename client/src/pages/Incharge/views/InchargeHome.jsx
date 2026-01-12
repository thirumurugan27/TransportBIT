import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, getToday} from "../../../utils/api";

export default function InchargeHome() {
  const [stats, setStats] = useState({
    total_drivers: 0,
    on_duty: 0,
    pending_leaves: 0,
  });

  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch pending leaves count
        const res = await apiGet("/api/admin/leave/pending?status=pending");
        const leaves = await res.json();

        // Fetch all assignments for today
        const today = getToday();
        const assignRes = await apiGet(
          `/api/incharge/assignments?date=${today}`
        );
        const assignments = await assignRes.json();

        setStats({
          total_drivers: assignments?.length || 0,
          on_duty:
            assignments?.filter((a) =>
              ["assigned", "scheduled", "ongoing"].includes(
                a.status?.toLowerCase()
              )
            )?.length || 0,
          pending_leaves: leaves?.length || 0,
        });
      } catch (err) {
        console.error(err);
      }
    };

    if (inchargeId) {
      fetchStats();
    }
  }, [inchargeId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                Total Assignments
              </p>
              <h3 className="text-3xl font-bold text-primarytext mt-2">
                {stats.total_drivers}
              </h3>
            </div>
            <div className="bg-primarybg p-3 rounded-md text-primary">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                On Duty
              </p>
              <h3 className="text-3xl font-bold text-green mt-2">
                {stats.on_duty}
              </h3>
            </div>
            <div className="bg-green/10 p-3 rounded-md text-green">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                Pending Leaves
              </p>
              <h3 className="text-3xl font-bold text-pending mt-2">
                {stats.pending_leaves}
              </h3>
            </div>
            <div className="bg-pending/10 p-3 rounded-md text-pending">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
