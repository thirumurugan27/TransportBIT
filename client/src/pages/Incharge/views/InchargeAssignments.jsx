import React, {useState, useEffect} from "react";
import {apiGet, getToday} from "../../../utils/api";

export default function InchargeAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(getToday());

  useEffect(() => {
    fetchAssignments();
  }, [date]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/incharge/assignments?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primarytext">
          Cluster Assignments
        </h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-secondarytext"
        />
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-secondarytext animate-pulse">
            Loading assignments...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primarybg border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Shift
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Vehicle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((assignment) => (
                  <tr
                    key={assignment.id || Math.random()}
                    className="hover:bg-primarybg/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-primarytext">
                        {assignment.driver_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${
                          ["present", "completed", "assigned"].includes(
                            assignment.driver_status?.toLowerCase() ||
                              assignment.status?.toLowerCase()
                          )
                            ? "bg-green/10 text-green border-green/20"
                            : ["absent", "on_leave"].includes(
                                assignment.driver_status?.toLowerCase()
                              )
                            ? "bg-red/10 text-red border-red/20"
                            : "bg-pending/10 text-pending border-pending/20"
                        }`}
                      >
                        {assignment.driver_status || assignment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondarytext">
                      <div className="text-primarytext text-xs">
                        {assignment.start_date === assignment.end_date
                          ? assignment.start_date
                          : `${assignment.start_date} to ${assignment.end_date}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondarytext">
                      <div className="text-primarytext font-medium">
                        {assignment.shift_name}
                      </div>
                      <div className="text-xs text-secondarytext">
                        {assignment.start_time} - {assignment.end_time}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.vehicle_number}
                      <span className="text-xs text-gray-500 ml-1">
                        ({assignment.vehicle_type})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assignments.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No assignments found for this date.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
