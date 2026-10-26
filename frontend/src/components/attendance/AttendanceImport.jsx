import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Fingerprint, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import attendanceService from '../../services/attendanceService';
import biometricService from '../../services/biometricService';
import toast from 'react-hot-toast';

const AttendanceImport = () => {
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null); // { type, summary, errors }

    // Refs for file inputs
    const dailyInputRef = useRef(null);
    const biomInputRef = useRef(null);

    const handleUpload = async (type, file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setResult(null);

        try {
            let res;
            if (type === 'DAILY') {
                res = await attendanceService.importDailyAttendance(formData);
                toast.success('Daily Attendance Imported');
            } else {
                res = await biometricService.importBiometricLogs(formData);
                toast.success('Biometric Logs Imported');
            }

            setResult({
                type,
                summary: res.data.summary,
                errors: res.data.errors
            });
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            // Reset inputs
            if (dailyInputRef.current) dailyInputRef.current.value = '';
            if (biomInputRef.current) biomInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DAILY ATTENDANCE CARD */}
                <div
                    onClick={() => dailyInputRef.current?.click()}
                    className={`
                        relative overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer group
                        ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-emerald-400 border-slate-200 bg-white hover:bg-emerald-50/30'}
                    `}
                >
                    <input
                        type="file"
                        ref={dailyInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={(e) => handleUpload('DAILY', e.target.files[0])}
                    />

                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                            <FileSpreadsheet size={32} />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Daily Attendance</h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Import confirmed attendance/leave data. (Manual/Excel Source)
                    </p>
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                        <UploadCloud size={14} /> Select Excel File
                    </span>
                </div>

                {/* BIOMETRIC LOGS CARD */}
                <div
                    onClick={() => biomInputRef.current?.click()}
                    className={`
                        relative overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer group
                        ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400 border-slate-200 bg-white hover:bg-blue-50/30'}
                    `}
                >
                    <input
                        type="file"
                        ref={biomInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={(e) => handleUpload('BIOMETRIC', e.target.files[0])}
                    />

                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                            <Fingerprint size={32} />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Biometric Logs</h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Import raw punch data from machine. (Staging Area)
                    </p>
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        <UploadCloud size={14} /> Select Excel File
                    </span>
                </div>
            </div>

            {/* RESULTS SECTION */}
            {uploading && (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border border-slate-200 animate-pulse">
                    <RefreshCw size={32} className="animate-spin text-primary-500 mb-4" />
                    <p className="text-slate-600 font-medium">Processing File...</p>
                </div>
            )}

            {result && !uploading && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className={`px-6 py-4 border-b ${result.summary?.failed > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'} flex justify-between items-center`}>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            {result.summary?.failed === 0 ? <CheckCircle className="text-green-500" /> : <AlertCircle className="text-amber-500" />}
                            Import Summary ({result.type})
                        </h3>
                        <button onClick={() => setResult(null)} className="text-sm text-slate-500 hover:text-slate-800">Close</button>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-slate-700">{result.summary?.total_processed}</span>
                            <span className="text-xs text-slate-500 uppercase font-semibold">Total Rows</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-green-600">{result.summary?.successful}</span>
                            <span className="text-xs text-green-600 uppercase font-semibold">Successful</span>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-amber-600">{result.summary?.failed}</span>
                            <span className="text-xs text-amber-600 uppercase font-semibold">Failed</span>
                        </div>
                    </div>

                    {/* Error Log Table */}
                    {result.errors && result.errors.length > 0 && (
                        <div className="border-t border-slate-100">
                            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                                <h4 className="text-sm font-semibold text-slate-700">Error Log</h4>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-2">Row</th>
                                            <th className="px-6 py-2">Employee</th>
                                            <th className="px-6 py-2">Error</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {result.errors.map((err, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-2 font-mono text-slate-600">{err.row}</td>
                                                <td className="px-6 py-2 font-medium text-slate-800">{err.employee_code}</td>
                                                <td className="px-6 py-2 text-red-500">{err.message}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceImport;
