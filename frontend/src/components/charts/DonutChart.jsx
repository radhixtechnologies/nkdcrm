import { useState } from 'react';

const PALETTE = [
    '#4f46e5', // Indigo
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
];

const DonutChart = ({ data = [], size = 200, title = 'Total', subtitle = '' }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

    if (!data || data.length === 0 || total === 0) {
        return (
            <div className="flex h-56 items-center justify-center text-slate-400 text-sm">
                No breakdown data available
            </div>
        );
    }

    const strokeWidth = 24;
    const radius = 70;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    const slices = data.map((item, idx) => {
        const val = Number(item.value) || 0;
        const percentage = total > 0 ? (val / total) * 100 : 0;
        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -accumulatedAngle;
        accumulatedAngle += (percentage / 100) * circumference;

        return {
            ...item,
            val,
            percentage: Math.round(percentage),
            color: item.color || PALETTE[idx % PALETTE.length],
            strokeDasharray,
            strokeDashoffset,
        };
    });

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-2">
            {/* Donut SVG */}
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    {/* Background Ring */}
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth={strokeWidth}
                    />

                    {/* Colored Slices */}
                    {slices.map((slice, idx) => (
                        <circle
                            key={idx}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
                            strokeDasharray={slice.strokeDasharray}
                            strokeDashoffset={slice.strokeDashoffset}
                            strokeLinecap="butt"
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        />
                    ))}
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    {hoveredIdx !== null ? (
                        <>
                            <span className="text-2xl font-bold text-slate-800">{slices[hoveredIdx].val}</span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {slices[hoveredIdx].percentage}%
                            </span>
                            <span className="text-[11px] text-slate-400 max-w-[80px] truncate">
                                {slices[hoveredIdx].label}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl font-bold text-slate-800">{total}</span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
                            {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
                        </>
                    )}
                </div>
            </div>

            {/* Legend List */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
                {slices.map((slice, idx) => (
                    <div
                        key={idx}
                        className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                            hoveredIdx === idx ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                        }`}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: slice.color }}
                            />
                            <span className="text-slate-700 truncate">{slice.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-slate-500 shrink-0">
                            <span>{slice.val}</span>
                            <span className="text-slate-400 text-[11px]">({slice.percentage}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DonutChart;

